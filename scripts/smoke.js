'use strict';

const { DshManager } = require('../src/dsh-manager');

const manager = new DshManager({
  logger: { append: line => console.log('[log]', line) },
});

let sawRunning = false;

const globalTimer = setTimeout(() => {
  console.error('SMOKE FAIL: 全局超时（90s）');
  manager.dispose();
  process.exit(1);
}, 90000);

function maskToken(s) {
  return String(s).replace(/token=\S+/, 'token=***');
}

manager.onDidChange(s => {
  console.log(`[state] ${s.state}${s.url ? ' url=' + maskToken(s.url) : ''}${s.error ? ' error=' + s.error : ''}`);
  if (s.state === 'running') {
    sawRunning = true;
    setTimeout(() => manager.stop(), 1000);
  }
  if (s.state === 'stopped') {
    clearTimeout(globalTimer);
    if (sawRunning) {
      console.log('SMOKE PASS');
      process.exit(0);
    }
    console.error('SMOKE FAIL: 未进入 running 状态:', s.error || '未知原因');
    process.exit(1);
  }
});

console.log('starting dsh web...');
manager.start({ executablePath: 'dsh', startupTimeoutMs: 45000 });