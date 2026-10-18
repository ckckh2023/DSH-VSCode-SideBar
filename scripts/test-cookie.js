'use strict';

const { rewriteSetCookie } = require('../src/proxy.js');

const cases = [
  ['sid=abc; Path=/; HttpOnly', 'sid=abc; Path=/; HttpOnly; SameSite=None; Secure'],
  ['sid=abc; Path=/; SameSite=Lax', 'sid=abc; Path=/; SameSite=None; Secure'],
  ['sid=abc; Secure', 'sid=abc; Secure; SameSite=None'],
  ['sid=abc; SameSite=Strict; Secure', 'sid=abc; SameSite=None; Secure'],
  ['sid=abc', 'sid=abc; SameSite=None; Secure'],
];

let failed = 0;
for (const [input, expected] of cases) {
  const actual = rewriteSetCookie(input);
  const ok = actual === expected;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${input} -> ${actual}`);
  if (!ok) console.log(`  expected: ${expected}`);
}
process.exit(failed ? 1 : 0);