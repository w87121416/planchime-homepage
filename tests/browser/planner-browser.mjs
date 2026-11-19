import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '/Users/xiao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

// 独立浏览器只访问本机静态产物，全部数据为合成事项；拒绝外站和任何写请求。
const base = process.env.PLANCHIME_QA_BASE ?? 'http://127.0.0.1:4196';
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(base)) throw new Error('local origin required');
const output = process.env.PLANCHIME_QA_OUTPUT ?? '/Users/xiao/Documents/APP日程提醒/tmp/audit/PAY-20261119-H5-SERVICE';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [], errors = [], forbidden = [];
const key = 'planchime.web-planner.v1';
async function context(options = {}) {
  const c = await browser.newContext({ viewport: { width: 1440, height: 1000 }, ...options });
  await c.route('**/*', route => {
    const r = route.request();
    if (new URL(r.url()).origin === base && ['GET', 'HEAD'].includes(r.method())) return route.continue();
    forbidden.push({ url: r.url(), method: r.method() }); return route.abort();
  });
  c.on('page', p => p.on('pageerror', e => errors.push(e.message)));
  return c;
}
async function open(c) {
  const p = await c.newPage(); await p.goto(base + '/planner/');
  await p.getByRole('button', { name: '保存日程', exact: true }).waitFor(); return p;
}
const items = p => p.evaluate(k => JSON.parse(localStorage.getItem(k) ?? '{"items":[]}').items, key);
async function create(p, title, date = '', time = '') {
  await p.getByLabel('事情 必填').fill(title);
  await p.getByLabel('日期 选填', { exact: true }).fill(date);
  await p.getByLabel('时间 选填', { exact: true }).fill(time);
  await p.getByRole('button', { name: '保存日程', exact: true }).click();
  await p.getByRole('heading', { level: 3, name: title, exact: true }).waitFor();
}
const noOverflow = async p => {
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `${p.url()} has overflow`);
  const clipped = await p.locator('main form,main section input,main form input,main form textarea,main button,main h3').evaluateAll(nodes => nodes.filter(n => n.getClientRects().length && n.getBoundingClientRect().width > 0).filter(n => { const r = n.getBoundingClientRect(); return r.left < -1 || r.right > innerWidth + 1; }).map(n => ({tag:n.tagName, text:n.textContent.slice(0,30),width:n.getBoundingClientRect().width})));
  assert.deepEqual(clipped, [], '控件不能依赖全局overflow-x:clip掩盖裁切');
};
const shot = async (p, name) => {
  // 截图前回到真实页面顶部，避免 sticky 页头在 fullPage 拼接中落到页面中段。
  await p.evaluate(() => { document.activeElement?.blur?.(); window.scrollTo({ top: 0, behavior: 'instant' }); });
  await p.waitForTimeout(150);
  return p.screenshot({ path: `${output}/${name}.png`, fullPage: true });
};
try {
  const c = await context(); const p = await c.newPage();
  await p.goto(base + '/'); await p.getByRole('link', { name: '免费开始网页使用', exact: true }).click();
  await p.waitForURL(base + '/planner/'); await p.getByRole('button', { name: '保存日程', exact: true }).waitFor();
  await shot(p, 'planner-empty-1440');
  await create(p, '合成测试：整理本周安排', '2026-11-25', '09:30');
  await p.getByRole('button', { name: '编辑：合成测试：整理本周安排', exact: true }).click();
  await p.getByLabel('日期 选填', { exact: true }).fill('2026-11-26'); await p.getByLabel('备注 选填').fill('仅用于验证：确认时间后再出发');
  assert.equal(await p.getByRole('status').filter({ hasText: '已保存在当前浏览器' }).count(), 0);
  await p.getByText('当前输入尚未保存。', { exact: true }).waitFor();
  await shot(p, 'planner-edit-1440');
  await p.getByRole('button', { name: '保存修改', exact: true }).click(); await p.getByRole('status').filter({ hasText: '已保存在当前浏览器' }).waitFor();
  await p.reload(); await p.getByRole('button', { name: '保存日程', exact: true }).waitFor();
  assert.equal((await items(p))[0].date, '2026-11-26'); assert.equal((await items(p))[0].notes, '仅用于验证：确认时间后再出发');
  await p.getByRole('checkbox', { name: '完成：合成测试：整理本周安排', exact: true }).click();
  await p.getByText('当前列表已全部完成。', { exact: true }).waitFor();
  await p.getByText('已完成（1）', { exact: true }).click();
  await p.getByRole('checkbox', { name: '撤销完成：合成测试：整理本周安排', exact: true }).click();
  await create(p, '合成测试：未定时间的阅读计划');
  await p.getByRole('button', { name: '待安排', exact: true }).click();
  assert.equal(await p.getByRole('heading', { name: '合成测试：整理本周安排', exact: true }).count(), 0);
  await p.getByRole('button', { name: '全部', exact: true }).click();
  await p.getByRole('button', { name: '删除：合成测试：未定时间的阅读计划', exact: true }).click();
  assert.equal(await p.getByRole('button', { name: '保留', exact: true }).evaluate(n => n === document.activeElement), true);
  await shot(p, 'planner-delete-1440'); await p.keyboard.press('Escape'); assert.equal((await items(p)).length, 2);
  await p.getByRole('button', { name: '删除：合成测试：未定时间的阅读计划', exact: true }).click();
  await p.getByRole('button', { name: '删除这条', exact: true }).click();
  await p.getByRole('status').filter({ hasText: '这一条日程已删除' }).waitFor(); assert.equal((await items(p)).length, 1);
  results.push('home-entry-create-edit-refresh-complete-reopen-filter-single-delete');

  await p.getByText('备份与恢复', { exact: false }).filter({ has: p.locator('span') }).click();
  const downloadPromise = p.waitForEvent('download'); await p.getByRole('button', { name: '导出全部日程', exact: true }).click();
  const download = await downloadPromise; await download.saveAs(`${output}/synthetic-backup.json`);
  const exported = await p.getByRole('textbox', { name: '备份文本', exact: true }).inputValue();
  const imported = JSON.parse(exported); imported.items[0].id = 'import-synthetic-only'; imported.items[0].title = '合成测试：恢复的待办';
  await p.locator('input[type=file]').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(imported)) });
  await p.getByRole('region', { name: '恢复预览' }).waitFor(); assert.equal((await items(p)).length, 1);
  await shot(p, 'planner-import-1440');
  await p.getByRole('button', { name: '确认恢复', exact: true }).click();
  await p.getByRole('status').filter({ hasText: '已恢复 1 条' }).waitFor(); assert.equal((await items(p)).length, 2);
  await p.locator('input[type=file]').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(imported)) });
  await p.getByRole('button', { name: '确认恢复', exact: true }).click();
  await p.getByRole('status').filter({ hasText: '没有添加重复记录' }).waitFor(); assert.equal((await items(p)).length, 2);
  await p.locator('input[type=file]').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{bad') });
  await p.getByRole('alert').filter({hasText:'文件不是有效'}).waitFor(); assert.equal((await items(p)).length, 2);
  results.push('download-valid-backup-import-preview-confirm-repeat-bad-file');

  const other = await open(c);
  await p.getByRole('button', { name: '编辑：合成测试：整理本周安排', exact: true }).click();
  await p.getByLabel('事情 必填').fill('合成测试：尚未保存的修改');
  await other.getByRole('button', { name: '编辑：合成测试：整理本周安排', exact: true }).click();
  await other.getByLabel('事情 必填').fill('合成测试：另一页面的新记录');
  await other.getByRole('button', { name: '保存修改', exact: true }).click();
  await other.getByRole('heading', { name: '合成测试：另一页面的新记录' }).waitFor();
  await p.getByRole('button', { name: '保存修改', exact: true }).click();
  await p.getByRole('alert').filter({ hasText: '另一个页面改变' }).waitFor();
  assert.equal(await p.getByLabel('事情 必填').inputValue(), '合成测试：尚未保存的修改');
  assert.equal((await items(p))[0].title, '合成测试：另一页面的新记录');
  p.once('dialog', d => d.accept()); await p.getByRole('button', { name: '取消编辑', exact: true }).click();
  await c.setOffline(true); await create(p, '合成测试：断网后保存'); await c.setOffline(false);
  results.push('cross-tab-no-overwrite-draft-retained-offline-after-load');
  await p.getByLabel('事情 必填').fill('合成测试：退出保护');
  p.once('dialog', d => d.dismiss()); await p.getByRole('navigation', { name: '网站栏目' }).getByRole('link', { name: '首页', exact: true }).click();
  assert.equal(new URL(p.url()).pathname, '/planner/'); assert.equal(await p.getByLabel('事情 必填').inputValue(), '合成测试：退出保护');
  await p.getByLabel('事情 必填').fill(''); results.push('navigation-cancel-preserves-unsaved-draft');
  await c.close();

  for (const width of [1440, 393, 320]) {
    const c = await context({ viewport: { width, height: 900 } }); const p = await open(c);
    await create(p, '合成测试：周末去图书馆', '2026-11-25', '10:00');
    await create(p, '合成测试：先记下阅读清单'); await noOverflow(p); await shot(p, `planner-saved-${width}`);
    await create(p, '合成测试：'.repeat(12)); await noOverflow(p);
    await p.getByRole('button', { name: '编辑：合成测试：先记下阅读清单', exact: true }).click();
    assert.equal(await p.getByLabel('事情 必填').evaluate(n => n === document.activeElement), true);
    assert.equal(await p.getByLabel('事情 必填').evaluate(n => n.getBoundingClientRect().top >= document.querySelector('.site-header').getBoundingClientRect().bottom), true);
    await p.getByRole('button', { name: '取消编辑', exact: true }).click();
    if (width === 320) {
      // 通过 CSS 放大文字到200%做重排压力验证，不作为系统读屏或原生缩放验收。
      await p.evaluate(() => {
        const sizes = [...document.querySelectorAll('body,body *')].map(node => [node, parseFloat(getComputedStyle(node).fontSize)]);
        // 先取全部原始尺寸再统一倍增，避免父子相对单位叠乘成400%或更大。
        sizes.forEach(([node, size]) => { if (node instanceof HTMLElement) node.style.setProperty('font-size', `${size * 2}px`, 'important'); });
      });
      await noOverflow(p); await shot(p, 'planner-text-200');
    }
    results.push(`viewport-${width}-long-text-edit-focus`); await c.close();
  }
  const nojs = await context({ javaScriptEnabled: false, viewport: { width: 393, height: 900 } }); const staticPage = await nojs.newPage();
  await staticPage.goto(base + '/planner/'); assert.match(await staticPage.locator('noscript').innerText(), /启用 JavaScript/);
  assert.equal(await staticPage.locator('form').count(), 0); await noOverflow(staticPage); await nojs.close(); results.push('noscript-honest-fallback');

  const denied = await context();
  await denied.addInitScript(() => { Storage.prototype.setItem = function() { throw new DOMException('synthetic quota exceeded', 'QuotaExceededError'); }; });
  const dp = await open(denied); await dp.getByLabel('事情 必填').fill('合成测试：必须保留的输入');
  await dp.getByRole('button', { name: '保存日程', exact: true }).click();
  await dp.getByRole('alert').filter({ hasText: '还没保存成功' }).waitFor();
  assert.equal(await dp.getByLabel('事情 必填').inputValue(), '合成测试：必须保留的输入'); assert.equal((await items(dp)).length, 0);
  await shot(dp, 'planner-storage-error'); await denied.close(); results.push('write-denied-keeps-draft-no-false-success');

  const corrupt = await context(); await corrupt.addInitScript(({ key, base }) => {
    if (location.origin === base) localStorage.setItem(key, '{synthetic-broken');
  }, { key, base });
  const cp = await open(corrupt); assert.equal(await cp.getByRole('button', { name: '保存日程', exact: true }).isDisabled(), true);
  assert.equal(await cp.evaluate(k => localStorage.getItem(k), key), '{synthetic-broken');
  const rawDownload = cp.waitForEvent('download'); await cp.getByRole('button', { name: '下载原始数据' }).click(); await rawDownload;
  await corrupt.close(); results.push('corrupt-data-readonly-original-export');
  const noRead = await context(); await noRead.addInitScript(() => Object.defineProperty(window, 'localStorage', {get(){throw new DOMException('synthetic access denied', 'SecurityError');}}));
  const rp = await open(noRead); assert.equal(await rp.getByRole('button', {name:'保存日程',exact:true}).isDisabled(), true);
  await rp.getByRole('alert').filter({hasText:'不允许读取'}).waitFor(); await noRead.close(); results.push('storage-unavailable-readonly-recovery');
  assert.deepEqual(errors, []); assert.deepEqual(forbidden, []);
  await writeFile(`${output}/browser-results.json`, JSON.stringify({ passed: results.length, results, errors, forbidden }, null, 2));
  console.log(JSON.stringify({ passed: results.length, results }));
} finally { await browser.close(); }
