import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from '/Users/xiao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

// 只拦截本机空白测试页面；锁本身必须使用浏览器原生实现，不注入 LockManager 替身。
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const context = await browser.newContext();
  await context.route('**/*', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<title>原生锁验收</title>' }));
  const a = await context.newPage(), b = await context.newPage();
  await Promise.all([a.goto('http://127.0.0.1:4219/native-locks'), b.goto('http://127.0.0.1:4219/native-locks')]);
  const name = 'PAY-20261119-H5-F1-native-lock';
  await a.evaluate(name => { window.lockEntered = false; void navigator.locks.request(name, () => { window.lockEntered = true; return new Promise(resolve => { window.releaseNativeLock = resolve; }); }); }, name);
  await a.waitForFunction(() => window.lockEntered);
  await b.evaluate(name => { window.secondEntered = false; void navigator.locks.request(name, () => { window.secondEntered = true; }); }, name);
  await b.waitForFunction(async name => (await navigator.locks.query()).pending.some(lock => lock.name === name), name);
  assert.equal(await b.evaluate(() => window.secondEntered), false);
  await a.evaluate(() => window.releaseNativeLock());
  await b.waitForFunction(() => window.secondEntered);
  await writeFile('/private/tmp/PAY-20261119-H5-F1-browser-final/native-locks.json', JSON.stringify({ browserNativeLocks: true, twoSameOriginTabs: true, secondBlockedUntilFirstReleased: true, externalRequests: 0 }, null, 2));
  console.log('Native Web Locks: two-tab exclusion passed');
} finally { await browser.close(); }
