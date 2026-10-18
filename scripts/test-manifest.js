'use strict';

const fs = require('fs');

let failed = 0;
const check = (name, ok) => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  if (!ok) failed++;
};

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
check('package.json: version 0.2.0', pkg.version === '0.2.0');
check('package.json: icon 指向 png', pkg.icon === 'media/icon.png');
check('package.json: repository 存在', !!pkg.repository);
check('package.json: 无 activationEvents（自动生成）', !pkg.activationEvents);
check('package.json: 无 smoke 脚本', !pkg.scripts.smoke);
check('media/icon.svg 存在', fs.existsSync('media/icon.svg'));
check('media/icon.png 存在', fs.existsSync('media/icon.png'));
check('LICENSE 存在', fs.existsSync('LICENSE'));

const manager = fs.readFileSync('src/dsh-manager.js', 'utf8');
check('manager: cmd.exe 包装 .cmd', /cmd\.exe/.test(manager) && /\\\.\(cmd\|bat\)\$/.test(manager));
check('manager: 集成 DshProxy', /require\('\.\/proxy'\)/.test(manager));
check('manager: 代理 URL 拼接', /127\.0\.0\.1:\$\{proxyPort\}/.test(manager));
check('manager: dispose 关代理', /_closeProxy/.test(manager));

const provider = fs.readFileSync('src/dsh-provider.js', 'utf8');
check('provider: CSP 允许 frame-src 127.0.0.1', /frame-src http:\/\/127\.0\.0\.1:\*/.test(provider));
check('provider: iframe 渲染', /<iframe src=/.test(provider));
check('provider: URL 属性转义', /_escape\(url\)/.test(provider));

const proxy = fs.readFileSync('src/proxy.js', 'utf8');
check('proxy: WebSocket upgrade 转发', /_forwardUpgrade/.test(proxy));
check('proxy: 仅监听 127.0.0.1', /'127\.0\.0\.1', \(\)/.test(proxy) || /listen\(0, '127\.0\.0\.1'/.test(proxy));
check('proxy: Set-Cookie 改写', /rewriteSetCookie/.test(proxy));

const ext = fs.readFileSync('src/extension.js', 'utf8');
check('extension: openInBrowser 用 dshUrl', /manager\.dshUrl/.test(ext));
check('extension: setContext dsh.running', /setContext/.test(ext));

const readme = fs.readFileSync('README.md', 'utf8');
check('README: 无 smoke 残留', !readme.includes('smoke'));

process.exit(failed ? 1 : 0);