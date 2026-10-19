'use strict';

const vscode = require('vscode');
const { DshManager } = require('./dsh-manager');
const { DshProvider } = require('./dsh-provider');

function activate(context) {
  const logger = vscode.window.createOutputChannel('DSH');
  const manager = new DshManager({ logger });

  const config = () => vscode.workspace.getConfiguration('dsh');

  const provider = new DshProvider(manager, {
    logger,
    onFirstResolve() {
      if (config().get('autoStart', false) && manager.state === 'stopped') {
        vscode.commands.executeCommand('dsh.start');
      }
    },
  });

  const setStateContext = state =>
    vscode.commands.executeCommand('setContext', 'dsh.state', state);
  manager.onDidChange(s => setStateContext(s.state));
  setStateContext(manager.state);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('dsh.sidebar', provider),
    vscode.commands.registerCommand('dsh.start', () => {
      if (manager.state !== 'stopped') return;
      manager.start({
        executablePath: config().get('executablePath', 'dsh'),
        startupTimeoutMs: config().get('startupTimeoutMs', 30000),
      });
    }),
    vscode.commands.registerCommand('dsh.stop', () => manager.stop()),
    vscode.commands.registerCommand('dsh.openInBrowser', async () => {
      if (!manager.dshUrl) return;
      await vscode.env.openExternal(vscode.Uri.parse(manager.dshUrl));
    }),
    logger,
    manager
  );
}

function deactivate() {}

module.exports = { activate, deactivate };