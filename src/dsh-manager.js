'use strict';

const { spawn } = require('child_process');
const readline = require('readline');
const path = require('path');
const { URL } = require('url');
const { DshProxy } = require('./proxy');

const IS_WIN = process.platform === 'win32';
const CREATE_NEW_PROCESS_GROUP = 0x00000200;
const URL_RE = /https?:\/\/\S+/;
const TOKEN_RE = /([?&]token=)[^\s&'"`]+/g;

class DshManager {
  constructor({ logger } = {}) {
    this.logger = logger || { append() {} };
    this.state = 'stopped';
    this.dshUrl = null;
    this.url = null;
    this.error = null;
    this.child = null;
    this.proxy = null;
    this._stopRequested = false;
    this._startupTimer = null;
    this._killTimer = null;
    this._listeners = new Set();
  }

  onDidChange(cb) {
    this._listeners.add(cb);
    return () => this._listeners.delete(cb);
  }

  _emit() {
    const snapshot = { state: this.state, url: this.url, dshUrl: this.dshUrl, error: this.error };
    for (const cb of this._listeners) cb(snapshot);
  }

  _setState(state) {
    if (this.state === state) return;
    this.state = state;
    this._emit();
  }

  _sanitize(line) {
    return line.replace(TOKEN_RE, '$1***');
  }

  _resolveExecutable(configured) {
    if (IS_WIN && !path.extname(configured)) {
      return configured + '.cmd';
    }
    return configured;
  }

  start({ executablePath = 'dsh', startupTimeoutMs = 30000 } = {}) {
    if (this.state !== 'stopped') return;
    this.error = null;
    this.dshUrl = null;
    this.url = null;
    this._stopRequested = false;
    this._setState('starting');

    const exe = this._resolveExecutable(executablePath);
    const args = ['web', '--no-open'];
    this.logger.append(`[dsh] 启动: ${exe} ${args.join(' ')}`);
    const spawnOpts = {
      windowsHide: true,
      detached: !IS_WIN,
      creationFlags: IS_WIN ? CREATE_NEW_PROCESS_GROUP : undefined,
      env: process.env,
    };
    try {
      if (IS_WIN && /\.(cmd|bat)$/i.test(exe)) this.child = spawn('cmd.exe', ['/c', exe.replace(/\//g, '\\'), ...args], spawnOpts);
      else this.child = spawn(exe, args, spawnOpts);
    }
    catch (err) {
      this._fail(`启动 dsh 失败: ${err.message}`);
      return;
    }

    this.child.on('error', err => {
      this._fail(`无法启动 dsh（${err.message}）。请确认已安装 dsh，或在设置中配置 dsh.executablePath。`);
    });
    this.child.on('exit', (code, signal) => this._onExit(code, signal));

    this._pipe(this.child.stdout);
    this._pipe(this.child.stderr);

    this._startupTimer = setTimeout(() => {
      if (this.state === 'starting') {
        this._fail(`等待 dsh web 就绪超时（${startupTimeoutMs}ms），已停止进程。`);
        this.stop();
      }
    }, startupTimeoutMs);
  }

  _pipe(stream) {
    if (!stream) return;
    const rl = readline.createInterface({ input: stream });
    rl.on('line', line => {
      if (!this.dshUrl) {
        const m = line.match(URL_RE);
        if (m && m[0].includes('token=')) {
          this.dshUrl = m[0].replace(/[),.;:'"\u2019\u201d]+$/, '');
          this._startProxy(this.dshUrl);
        }
      }
      this.logger.append(this._sanitize(line));
    });
  }

  _startProxy(dshUrl) {
    let target;
    try {
      target = new URL(dshUrl);
    }
    catch {
      this._fail(`无法解析 dsh 输出的链接: ${this._sanitize(dshUrl)}`);
      return;
    }
    const targetPort = target.port ? Number(target.port) : 80;
    this.proxy = new DshProxy({ targetHost: target.hostname, targetPort, logger: this.logger });
    this.proxy
      .start()
      .then(proxyPort => {
        if (this.state !== 'starting') {
          this._closeProxy();
          return;
        }
        this.url = `http://127.0.0.1:${proxyPort}${target.pathname}${target.search}`;
        clearTimeout(this._startupTimer);
        this._startupTimer = null;
        this._setState('running');
      })
      .catch(err => {
        this._fail(`启动本地反向代理失败: ${err.message}`);
      });
  }

  stop() {
    if (!this.child || this.state === 'stopping' || this.state === 'stopped') return;
    this._stopRequested = true;
    this._setState('stopping');
    this.logger.append('[dsh] 正在停止…');
    const pid = this.child.pid;
    if (pid) {
      try {
        if (IS_WIN) process.kill(pid, 'SIGBREAK');
        else process.kill(-pid, 'SIGINT');
        this._killTimer = setTimeout(() => this._forceKill(pid), 5000);
      }
      catch {
        this.logger.append('[dsh] 无法发送中断信号（无共享控制台），改为强制结束。');
        this._forceKill(pid);
      }
    }
  }

  _fail(message) {
    if (this.state === 'stopped') return;
    this.error = message;
    this.logger.append('[dsh] ' + message);
    this._stopRequested = true;
    if (this.child && this.child.pid) this._forceKill(this.child.pid);
    this._closeProxy();
    this._setState('stopped');
  }

  _onExit(code) {
    clearTimeout(this._startupTimer);
    clearTimeout(this._killTimer);
    this._startupTimer = null;
    this._killTimer = null;
    this.child = null;
    if (!this._stopRequested) {
      this.error = `dsh 进程已退出（${code === null ? '被信号终止' : '退出码 ' + code}），详情见 DSH 输出频道。`;
      this.logger.append('[dsh] ' + this.error);
    }
    this._closeProxy();
    this._setState('stopped');
  }

  _closeProxy() {
    if (this.proxy) {
      this.proxy.stop();
      this.proxy = null;
    }
    this.url = null;
  }

  _forceKill(pid) {
    if (!pid) return;
    this.logger.append('[dsh] 强制结束进程树…');
    if (IS_WIN) {
      try {
        spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true });
      } catch { /* already gone */ }
    }
    else {
      try {
        process.kill(-pid, 'SIGKILL');
      } catch { /* already gone */ }
    }
  }

  dispose() {
    this._stopRequested = true;
    if (this.child && this.child.pid) this._forceKill(this.child.pid);
    clearTimeout(this._startupTimer);
    clearTimeout(this._killTimer);
    this._startupTimer = null;
    this._killTimer = null;
    this.child = null;
    this._closeProxy();
    this._setState('stopped');
  }
}

module.exports = { DshManager };