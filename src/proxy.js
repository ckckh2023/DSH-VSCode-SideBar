'use strict';

const http = require('http');
const https = require('https');

function rewriteSetCookie(cookie) {
  let c = cookie;
  if (/;\s*samesite=/i.test(c)) c = c.replace(/;\s*samesite=[^;]*/i, '; SameSite=None');
  else c += '; SameSite=None';
  if (!/;\s*secure/i.test(c)) c += '; Secure';
  return c;
}

class DshProxy {
  constructor({ targetHost = '127.0.0.1', targetPort, useTls = false, logger } = {}) {
    this._targetHost = targetHost;
    this._targetPort = targetPort;
    this._transport = useTls ? https : http;
    this._extraOpts = useTls ? { rejectUnauthorized: false } : {};
    this._logger = logger || { append() {} };
    this._server = http.createServer((req, res) => this._forward(req, res));
    this._sockets = new Set();
    this._server.on('connection', socket => {
      this._sockets.add(socket);
      socket.on('close', () => this._sockets.delete(socket));
    });
    this._server.on('upgrade', (req, socket, head) => this._forwardUpgrade(req, socket, head));
    this._closed = false;
    this.port = null;
  }

  start() {
    return new Promise((resolve, reject) => {
      if (this._closed) {
        reject(new Error('proxy already stopped'));
        return;
      }
      const onError = err => {
        this._closed = true;
        reject(err);
      };
      this._server.once('error', onError);
      this._server.listen(0, '127.0.0.1', () => {
        this._server.removeListener('error', onError);
        if (this._closed) {
          this._server.close();
          reject(new Error('proxy stopped during startup'));
          return;
        }
        this.port = this._server.address().port;
        this._logger.append(`[proxy] listening on 127.0.0.1:${this.port} -> ${this._targetHost}:${this._targetPort}`);
        resolve(this.port);
      });
    });
  }

  stop() {
    if (this._closed) return;
    this._closed = true;
    const port = this.port;
    this.port = null;
    for (const socket of this._sockets) socket.destroy();
    this._sockets.clear();
    if (this._server.listening) this._server.close();
    this._logger.append(port ? `[proxy] closing 127.0.0.1:${port}` : '[proxy] closing (not yet listening)');
  }

  _forward(clientReq, clientRes) {
    const upReq = this._transport.request(
      {
        host: this._targetHost,
        port: this._targetPort,
        method: clientReq.method,
        path: clientReq.url,
        headers: { ...clientReq.headers },
        ...this._extraOpts,
      },
      upRes => {
        const headers = { ...upRes.headers };
        if (Array.isArray(headers['set-cookie'])) headers['set-cookie'] = headers['set-cookie'].map(rewriteSetCookie);
        clientRes.writeHead(upRes.statusCode, headers);
        upRes.pipe(clientRes);
      }
    );
    upReq.on('error', err => {
      if (!clientRes.headersSent) {
        clientRes.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' });
        clientRes.end(`dsh proxy: upstream unreachable (${err.message})`);
      }
      else clientRes.destroy();
    });
    clientRes.on('close', () => upReq.destroy());
    clientReq.pipe(upReq);
  }

  _forwardUpgrade(clientReq, clientSocket, head) {
    const upReq = this._transport.request({
      host: this._targetHost,
      port: this._targetPort,
      method: clientReq.method,
      path: clientReq.url,
      headers: { ...clientReq.headers },
      ...this._extraOpts,
    });
    upReq.on('upgrade', (upRes, upSocket, upHead) => {
      const lines = ['HTTP/1.1 101 Switching Protocols'];
      for (const [key, value] of Object.entries(upRes.headers)) {
        if (Array.isArray(value)) for (const item of value) lines.push(`${key}: ${item}`);
        else lines.push(`${key}: ${value}`);
      }
      clientSocket.write(lines.join('\r\n') + '\r\n\r\n');
      if (upHead && upHead.length) clientSocket.write(upHead);
      if (head && head.length) upSocket.write(head);
      upSocket.pipe(clientSocket);
      clientSocket.pipe(upSocket);
      const cleanup = () => {
        clientSocket.destroy();
        upSocket.destroy();
      };
      upSocket.on('error', cleanup);
      clientSocket.on('error', cleanup);
      upSocket.on('close', cleanup);
      clientSocket.on('close', cleanup);
    });
    upReq.on('error', () => clientSocket.destroy());
    upReq.on('response', res => {
      if (clientSocket.destroyed) return;
      const lines = [`HTTP/1.1 ${res.statusCode} ${res.statusMessage || ''}`];
      for (const [key, value] of Object.entries(res.headers)) {
        if (Array.isArray(value)) {
          for (const item of value) lines.push(`${key}: ${item}`);
        } else {
          lines.push(`${key}: ${value}`);
        }
      }
      clientSocket.write(lines.join('\r\n') + '\r\n\r\n');
      res.pipe(clientSocket);
      res.on('error', () => clientSocket.destroy());
    });
    clientSocket.on('error', () => upReq.destroy());
    upReq.end();
  }
}

module.exports = { DshProxy, rewriteSetCookie };