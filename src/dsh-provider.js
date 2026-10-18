'use strict';

const vscode = require('vscode');

const CSP_BASE = "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'";


const STYLE = `
  html, body { height: 100%; }
  body {
    margin: 0;
    padding: 0;
    color: var(--vscode-foreground);
    font-family: var(--vscode-font-family);
    background-color: var(--vscode-editor-background);
  }
  .center {
    height: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 24px;
    text-align: center;
  }
  .logo { width: 44px; height: 44px; color: var(--vscode-foreground); opacity: 0.85; }
  h2 { margin: 0; font-size: 15px; font-weight: 600; }
  p { margin: 0; font-size: 12px; color: var(--vscode-descriptionForeground); line-height: 1.6; }
  button {
    padding: 6px 18px;
    font-size: 13px;
    font-family: inherit;
    color: var(--vscode-button-foreground);
    background-color: var(--vscode-button-background);
    border: none;
    border-radius: 2px;
    cursor: pointer;
  }
  button:hover { background-color: var(--vscode-button-hoverBackground); }
  .error {
    max-width: 100%;
    box-sizing: border-box;
    padding: 8px 12px;
    font-size: 12px;
    text-align: left;
    color: var(--vscode-errorForeground);
    border-left: 3px solid var(--vscode-errorForeground);
    background-color: var(--vscode-inputValidation-errorBackground, rgba(255, 0, 0, 0.05));
    word-break: break-all;
    white-space: pre-wrap;
  }
  .spinner {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    border: 3px solid var(--vscode-editorWidget-border, #8884);
    border-top-color: var(--vscode-button-background);
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
`;

const ICON_SVG = `
<svg class="logo" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
  <path d="M8 1a7 7 0 0 0-2.218 13.617c.35.064.471-.152.471-.337 0-.166-.006-.722-.01-1.31-1.919.417-2.324-.815-2.324-.815-.314-.797-.766-1.01-.766-1.01-.626-.428.048-.419.048-.419.692.049 1.057.71 1.057.71.615 1.055 1.614.75 2.007.573.063-.446.241-.75.438-.922-1.531-.174-3.14-.766-3.14-3.41 0-.753.269-1.369.71-1.852-.072-.174-.307-.874.066-1.822 0 0 .578-.185 1.891.708a6.55 6.55 0 0 1 3.464 0c1.312-.893 1.889-.708 1.889-.708.375.948.139 1.648.068 1.822.442.483.71 1.099.71 1.852 0 2.651-1.612 3.234-3.149 3.404.247.213.468.635.468 1.281 0 .923-.008 1.667-.008 1.895 0 .186.118.404.474.335A7 7 0 0 0 8 1z"/>
</svg>`;

class DshProvider {
  constructor(manager, { onFirstResolve } = {}) {
    this._manager = manager;
    this._onFirstResolve = onFirstResolve || null;
    this._view = null;
    this._resolvedOnce = false;
    manager.onDidChange(() => this._render());
  }

  resolveWebviewView(view) {
    this._view = view;
    view.webview.options = { enableScripts: true };
    view.webview.onDidReceiveMessage(msg => {
      switch (msg && msg.command) {
        case 'start':
          vscode.commands.executeCommand('dsh.start');
          break;
        case 'stop':
          vscode.commands.executeCommand('dsh.stop');
          break;
        case 'openBrowser':
          vscode.commands.executeCommand('dsh.openInBrowser');
          break;
      }
    });
    this._render();
    if (!this._resolvedOnce) {
      this._resolvedOnce = true;
      if (this._onFirstResolve) this._onFirstResolve();
    }
  }

  _render() {
    if (!this._view) return;
    const { state, url, error } = this._manager;
    this._view.webview.html = this._html(state, url, error);
  }

  _html(state, url, error) {
    const running = state === 'running' && url;
    let headExtra = '';
    let navScript = '';
    let body;
    if (running) {
      headExtra = `\n  <meta http-equiv="refresh" content="0; url=${this._escape(url)}">`;
      navScript = `\n    location.replace(${JSON.stringify(url)});`;
      body = this._centered('<div class="spinner"></div><p>正在打开 DSH Web UI…</p>');
    } else if (state === 'starting' || state === 'stopping') {
      const text = state === 'starting' ? '正在启动 dsh web…' : '正在停止 dsh…';
      body = this._centered(
        `<div class="spinner"></div><p>${text}</p>`,
        error ? `<div class="error">${this._escape(error)}</div>` : ''
      );
    } else {
      body = this._centered(
        `${ICON_SVG}<h2>DSH Web UI</h2>
         <p>在侧边栏中运行 DeepSeek Harness Web UI<br>（dsh web --no-open）</p>
         <button onclick="send('start')">▶ 启动 DSH</button>`,
        error ? `<div class="error">${this._escape(error)}</div>` : ''
      );
    }
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">${headExtra}
  <meta http-equiv="Content-Security-Policy" content="${CSP_BASE}">
  <style>${STYLE}</style>
</head>
<body>
  ${body}
  <script>
    const api = acquireVsCodeApi();${navScript}
    function send(cmd) { api.postMessage({ command: cmd }); }
  </script>
</body>
</html>`;
  }

  _centered(inner, extra) {
    return `<div class="center">${inner}${extra || ''}</div>`;
  }

  _escape(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }
}

module.exports = { DshProvider };