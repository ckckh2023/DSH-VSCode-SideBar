'use strict';

const vscode = require('vscode');
const { handleMessage } = require('./dsh-provider');

class DshPanel {
  constructor(manager, provider, { logger } = {}) {
    this._manager = manager;
    this._provider = provider;
    this._logger = logger || { append() {} };
    this._panel = null;
    manager.onDidChange(() => this._render());
  }

  open() {
    if (this._panel) {
      this._panel.reveal();
      return;
    }
    const panel = vscode.window.createWebviewPanel('dsh.panel', 'DSH Web UI', vscode.ViewColumn.Active, {
      enableScripts: true,
      retainContextWhenHidden: true,
    });
    this._panel = panel;
    panel.onDidDispose(() => { this._panel = null; });
    panel.webview.onDidReceiveMessage(handleMessage);
    this._render();
  }

  _render() {
    if (!this._panel) return;
    const { state, url, error } = this._manager;
    this._logger.append(`[panel] render state=${state}`);
    this._panel.webview.html = this._provider.buildHtml(state, url, error);
  }

  dispose() {
    if (this._panel) this._panel.dispose();
    this._panel = null;
  }
}

module.exports = { DshPanel };