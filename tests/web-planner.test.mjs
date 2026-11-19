import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PlannerRepository, parseDocument, validateDraft, validDate, sortItems, emptyDocument, MAX_ITEMS, MAX_BACKUP_BYTES } from '../app/lib/planner/model.ts';

function fixture() {
  let raw = null, count = 0, denied = false, readDenied = false;
  let queue = Promise.resolve();
  const runtime = {
    storage: { getItem: () => { if (readDenied) throw new Error(); return raw; }, setItem: (_, value) => { if (denied) throw new Error(); raw = value; } },
    exclusive: (action) => { const result = queue.then(action); queue = result.catch(() => {}); return result; },
    now: () => '2026-11-19T02:00:00.000Z', uuid: () => `id-${++count}`,
  };
  return { repo: new PlannerRepository(runtime), another: new PlannerRepository(runtime), get raw() { return raw; }, setRaw: value => { raw = value; }, deny: () => { denied = true; }, denyRead: () => { readDenied = true; } };
}
const draft = (title = '合成测试：周末去图书馆', date = '', time = '') => ({ title, date, time, notes: '合成内容，不含真实用户数据' });

test('本地日期不被自动补全或转换，闰年与时间校验完整', () => {
  assert.equal(validDate('2028-02-29'), true); assert.equal(validDate('2026-02-29'), false);
  assert.equal(validDate('2026-04-31'), false); assert.equal(validDate('1899-01-01'), false);
  assert.deepEqual(validateDraft(draft()).date, '');
  assert.throws(() => validateDraft(draft('事项', '', '12:00')), /先选择日期/);
  assert.throws(() => validateDraft(draft('事项', '2026-11-19', '24:00')), /时间无效/);
  assert.throws(() => validateDraft(draft(' ')), /请写下/);
  assert.throws(() => validateDraft({ ...draft(), notes: 'x'.repeat(2001) }), /2000/);
});

test('创建、刷新读取、改期、完成撤销、单条删除保留另一条', async () => {
  const f = fixture(); await f.repo.save(draft()); await f.repo.save(draft('另一条'));
  let item = f.another.read().items[0];
  await f.repo.save(draft('改期', '2026-12-01', '08:30'), item);
  item = f.another.read().items[0]; assert.equal(item.date, '2026-12-01'); assert.equal(item.time, '08:30');
  await f.repo.setCompleted(item, true); item = f.repo.read().items[0]; assert.equal(item.completed, true);
  await f.repo.setCompleted(item, false); item = f.repo.read().items[0]; assert.equal(item.completed, false);
  await f.repo.remove(item); assert.equal(f.repo.read().items.length, 1); assert.equal(f.repo.read().items[0].title, '另一条');
});

test('多个写入读取最新快照；陈旧修改/完成/删除不会覆盖另一页面', async () => {
  const f = fixture(); await Promise.all([f.repo.save(draft('甲')), f.another.save(draft('乙'))]);
  assert.equal(f.repo.read().items.length, 2);
  const stale = f.repo.read().items[0]; await f.another.save(draft('新版'), stale);
  for (const operation of [() => f.repo.save(draft('陈旧'), stale), () => f.repo.setCompleted(stale, true), () => f.repo.remove(stale)]) {
    await assert.rejects(operation, error => error.code === 'conflict');
  }
  assert.equal(f.repo.read().items[0].title, '新版');
});

test('写入失败不丢失旧数据；已有损坏内容不重置', async () => {
  const f = fixture(); await f.repo.save(draft()); const before = f.raw; f.deny();
  await assert.rejects(() => f.repo.save(draft('保存失败')), error => error.code === 'storage'); assert.equal(f.raw, before);
  f.setRaw('{broken'); assert.throws(() => f.repo.read(), error => error.code === 'corrupt');
  await assert.rejects(() => f.repo.save(draft()), error => error.code === 'corrupt'); assert.equal(f.raw, '{broken');
  f.denyRead(); assert.throws(() => f.repo.read(), error => error.code === 'storage');
});

test('导出恢复完整保留数据，导入相同ID不覆盖已修改的内容', async () => {
  const f = fixture(); await f.repo.save(draft('原始', '2026-11-20', '09:00'));
  const backup = parseDocument(f.raw); const other = fixture();
  const result = await other.repo.merge(backup); assert.equal(result.result.added, 1);
  const repeated = await other.repo.merge(backup); assert.deepEqual(repeated.result, { added: 0, skipped: 1 });
  await f.repo.save(draft('新版'), f.repo.read().items[0]);
  await f.repo.merge(backup); assert.equal(f.repo.read().items[0].title, '新版');
});

test('备份拒绝未知版本/重复ID/无效字段/超大内容，不改变数据', async () => {
  const f = fixture(); await f.repo.save(draft()); const doc = f.repo.read(); const before = f.raw;
  for (const value of [{ ...doc, version: 2 }, { ...doc, items: [doc.items[0], doc.items[0]] }, { ...doc, items: [{ ...doc.items[0], date: '2026-02-30' }] }]) {
    assert.throws(() => parseDocument(JSON.stringify(value))); assert.equal(f.raw, before);
  }
  assert.throws(() => parseDocument('x'.repeat(MAX_BACKUP_BYTES + 1)), /2MB/);
  assert.throws(() => parseDocument(JSON.stringify({ ...emptyDocument(), items: Array(MAX_ITEMS + 1).fill(doc.items[0]) })), /500/);
});

test('文字作为纯数据返回，额外导入字段不会进入存储', async () => {
  const f = fixture(); await f.repo.save(draft('<img src=x onerror=alert(1)>'));
  const doc = f.repo.read(); doc.items[0].token = 'synthetic-not-a-secret';
  const checked = parseDocument(JSON.stringify(doc)); assert.equal(checked.items[0].title, '<img src=x onerror=alert(1)>');
  assert.equal('token' in checked.items[0], false);
});

test('数量与UTF8体积限制在写入前阻断，保持旧文档可读', async () => {
  const f = fixture(); await f.repo.save(draft()); const base = f.repo.read().items[0];
  f.setRaw(JSON.stringify({ ...emptyDocument(), items: Array.from({ length: MAX_ITEMS }, (_, i) => ({ ...base, id: `bulk-${i}` })) }));
  const before = f.raw; await assert.rejects(() => f.repo.save(draft()), error => error.code === 'capacity'); assert.equal(f.raw, before);
  const target = fixture(); const big = { ...emptyDocument(), items: Array.from({ length: 340 }, (_, i) => ({ ...base, id: `big-${i}`, notes: '中'.repeat(1800) })) };
  await target.repo.merge(big); const saved = target.raw;
  await assert.rejects(() => target.repo.merge({ ...emptyDocument(), items: Array.from({ length: 40 }, (_, i) => ({ ...base, id: `more-${i}`, notes: '中'.repeat(1800) })) }), error => error.code === 'capacity');
  assert.equal(target.raw, saved); assert.equal(target.repo.read().items.length, 340);
});

test('排列为未完成优先，同日未设时间置后，待安排在最后', async () => {
  const f = fixture(); await f.repo.save(draft('待安排')); await f.repo.save(draft('日期', '2026-11-20')); await f.repo.save(draft('有时间', '2026-11-20', '09:00'));
  assert.deepEqual(sortItems(f.repo.read().items).map(i => i.title), ['有时间', '日期', '待安排']);
});
