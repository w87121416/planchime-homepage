import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { PurchaseTransport } from '../app/lib/purchase/transport.ts';
import { MemberServicesController } from '../app/lib/services/controller.ts';
import { ownsMosslight, mosslightWebManifest } from '../app/lib/services/theme.ts';
import { parseTextDraft } from '../app/lib/services/protocol.ts';
import { confirmedDraftDocument } from '../app/lib/services/planner.ts';
import { PlannerRepository } from '../app/lib/planner/model.ts';
import { memberFixture } from './fixtures/member-services.ts';

test('正式默认关闭服务：不读身份/权益/余额/备份，不调用短信或AI', async () => {
  const f = memberFixture({closed:true}), controller = new MemberServicesController(f.client);
  await controller.refresh(); await controller.sendText('合成内容','Asia/Shanghai',true);
  assert.equal(controller.getSnapshot().phase,'closed'); assert.deepEqual(f.calls,[]);
});
test('services模式完全拒绝目录/交易/微信/未知路径和未审批服务', async () => {
  const f=memberFixture(), t=new PurchaseTransport(f.configuration.transport,f.runtime);
  for (const [path,family,body] of [['/v1/commerce/catalog','commerce'],['/v1/commerce/orders','commerce',{}],['/v1/commerce/orders/synthetic/payment-link','commerce',{}],['/v1/commerce/wechat/catalog','commerce'],['/v1/web-pro/voice','service',{}],['/v1/web-pro/backups?cursor=x&accountId=b','service']]) {
    await assert.rejects(()=>t.request(path,family,{body,csrfToken:'a'.repeat(64)}));
  }
  await assert.rejects(()=>new PurchaseTransport({...f.configuration.transport,servicesApproved:false},f.runtime).request('/v1/web-auth/session','identity'));
  assert.equal(f.calls.length,0);
});
test('web-pro精确双版本头/凭据/CSRF，输入不带账号或客户端计量', async () => {
  const f=memberFixture(), c=new MemberServicesController(f.client); await c.refresh(); await c.sendText('合成安排','Asia/Shanghai',true);
  const posts=f.calls.filter(x=>x.path==='/v1/web-pro/text-drafts'); assert.equal(posts.length,1);
  assert.deepEqual(Object.keys(posts[0].body).sort(),['consentRecordId','referenceInstant','requestId','schemaVersion','sourceText','timeZoneId']);
  for(const call of f.calls.filter(x=>x.path.startsWith('/v1/web-pro/'))) {
    assert.equal(call.credentials,'include'); assert.equal(call.headers['X-Planchime-Web-Version'],'2026-10-19'); assert.equal(call.headers['X-Planchime-Pro-Version'],'2026-11-12');
    assert.equal(call.headers.Authorization,undefined); assert.equal(call.headers['X-Appsch-Commerce-Version'],undefined);
    if(call.method==='POST') assert.equal(call.headers['X-Planchime-CSRF'],'a'.repeat(64));
    else assert.equal(call.headers['X-Planchime-CSRF'],undefined);
  }
});
test('未知结果刷新后仍查原ID，不再次生成/扣量；日志没有正文和账号', async () => {
  const f=memberFixture(); f.state.unknownText=true; const c=new MemberServicesController(f.client); await c.refresh(); await c.sendText('绝不持久化的合成输入','Asia/Shanghai',true);
  const id=c.getSnapshot().requestId; assert.ok(id); await c.sendText('新正文','Asia/Shanghai',true);
  const again=new MemberServicesController(f.client); await again.refresh(); assert.equal(again.getSnapshot().requestId,id); await again.query();
  assert.equal(again.getSnapshot().draft.state,'ready'); assert.equal(f.calls.filter(x=>x.path==='/v1/web-pro/text-drafts').length,1);
  assert.ok(!JSON.stringify([...f.storage]).includes('合成输入')); assert.ok(!JSON.stringify([...f.storage]).includes('synthetic-account-a'));
  assert.equal(f.calls.some(x=>x.path.includes('orders')),false);
});
test('未确认发送、余额耗尽和跨账号结果都不能继续', async () => {
  const f=memberFixture(), c=new MemberServicesController(f.client); await c.refresh(); await c.sendText('合成','Asia/Shanghai',false);
  assert.equal(f.calls.some(x=>x.path==='/v1/web-pro/text-drafts'),false);
  f.state.remaining=0; await c.refresh(); await c.sendText('合成','Asia/Shanghai',true); assert.equal(c.getSnapshot().requestId,null);
  f.state.responseAccount='synthetic-account-b'; await c.refresh(); assert.equal(c.getSnapshot().phase,'unavailable'); assert.equal(c.getSnapshot().entitlements,null);
});
test('退出与同账号新代际都忽略迟到响应，不恢复敏感展示', async () => {
  const f=memberFixture(); let release;
  const waiting=new Promise(resolve=>{release=resolve;}); const original=f.client.getEntitlements.bind(f.client);
  f.client.getEntitlements=async()=>{const snapshot=await original(); await waiting; return snapshot;};
  const c=new MemberServicesController(f.client), first=c.refresh(); await new Promise(r=>setTimeout(r,0));
  c.invalidate(); release(); await first; assert.equal(c.getSnapshot().entitlements,null); assert.equal(c.getSnapshot().session,null);
});
test('主题只接受权威同账号有效grant；退款/失败/退出撤回，原图hash一致', async () => {
  const f=memberFixture(), c=new MemberServicesController(f.client); await c.refresh(); const owned=c.getSnapshot().entitlements;
  assert.equal(ownsMosslight(owned,'synthetic-account-b',Date.now()),false); assert.equal(ownsMosslight(owned,'synthetic-account-a',Date.now()),true);
  f.state.refunded=true; f.state.revision++; await c.refresh(); assert.equal(ownsMosslight(c.getSnapshot().entitlements,'synthetic-account-a',Date.now()),false);
  f.state.unavailable=true; await c.refresh(); assert.equal(c.getSnapshot().entitlements,null);
  const art=await readFile(new URL('../public'+mosslightWebManifest.artworkUrl,import.meta.url)); assert.equal(createHash('sha256').update(art).digest('hex'),mosslightWebManifest.artworkSha256);
});
test('未确认草稿与跨账号提案拒绝；相同请求重复保存不复制、不覆盖本地修改', async () => {
  const f=memberFixture(), value={schemaVersion:1,accountId:'synthetic-account-a',draft:f.ready('synthetic-draft')};
  assert.throws(()=>parseTextDraft(value,'synthetic-account-b','synthetic-draft'));
  value.draft.result.proposal.confirmationRequired=false; assert.throws(()=>parseTextDraft(value,'synthetic-account-a','synthetic-draft'));
  let raw=null,counter=0; const repo=new PlannerRepository({storage:{getItem:()=>raw,setItem:(_,v)=>{raw=v;}},exclusive:async fn=>fn(),uuid:()=>`synthetic-${++counter}`,now:()=>new Date().toISOString()});
  const doc=await confirmedDraftDocument({title:'合成',date:'',time:'',notes:''},'synthetic-a','synthetic-r');
  assert.equal((await repo.merge(doc)).result.added,1); const row=repo.read().items[0]; await repo.save({...row,title:'本地已修改'},row);
  assert.equal((await repo.merge(doc)).result.added,0); assert.equal(repo.read().items[0].title,'本地已修改');
});
test('备份上传精确契约、未知原ID查询及跨账号拒绝；不调用免费日程网络', async () => {
  const f=memberFixture(), signal=new AbortController().signal, document={format:'planchime-web-planner',version:1,items:[]};
  const list=await f.client.backups('synthetic-account-a',signal); assert.equal(list.capacityBytes,100000000);
  f.state.unknownBackup=true; await assert.rejects(()=>f.client.uploadBackup('synthetic-account-a','synthetic-backup',document,signal));
  const recovered=await f.client.downloadBackup('synthetic-account-a','synthetic-backup',signal); assert.deepEqual(recovered.document,document);
  const calls=f.calls.filter(c=>c.path==='/v1/web-pro/backups'&&c.method==='POST'); assert.equal(calls.length,1);
  assert.deepEqual(Object.keys(calls[0].body).sort(),['confirmedUpload','document','requestId','schemaVersion']);
  f.state.responseAccount='synthetic-account-b'; await assert.rejects(()=>f.client.downloadBackup('synthetic-account-a','synthetic-backup',signal));
});
test('跨标签恢复槽不覆盖原请求，旧页清理不移除新任务凭据', async () => {
  const f=memberFixture();
  const results=await Promise.allSettled([f.client.remember('synthetic-account-a','request-a'),f.client.remember('synthetic-account-a','request-b')]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  const id=await f.client.pending('synthetic-account-a'); assert.ok(id);
  await assert.rejects(()=>f.client.remember('synthetic-account-a',null,'text','wrong-request'));
  assert.equal(await f.client.pending('synthetic-account-a'),id);
  await f.client.remember('synthetic-account-a',null,'text',id); assert.equal(await f.client.pending('synthetic-account-a'),null);
});
test('浏览器静默丢写查询凭据时拒绝发送AI正文', async () => {
  const f=memberFixture({storage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}}}),c=new MemberServicesController(f.client);
  await c.refresh(); await c.sendText('不能丢恢复记录的合成内容','Asia/Shanghai',true);
  assert.equal(f.calls.some(x=>x.path==='/v1/web-pro/text-drafts'),false); assert.equal(c.getSnapshot().requestId,null);
});
test('等待本地写锁时退出，迟到保存不能写入新账号页面', async () => {
  const f=memberFixture(),c=new MemberServicesController(f.client); await c.refresh(); await c.sendText('合成安排','Asia/Shanghai',true); await c.query();
  let release,entered; const waiting=new Promise(r=>{release=r;}),started=new Promise(r=>{entered=r;}); let raw=null;
  const saving=c.saveDraft(canSave=>new PlannerRepository({storage:{getItem:()=>raw,setItem:(_,value)=>{if(!canSave())throw new Error('stale');raw=value;}},
    exclusive:async action=>{entered();await waiting;return action();},uuid:()=> 'local-revision',now:()=>new Date().toISOString()}),{title:'合成安排',date:'',time:'',notes:''},true);
  await started;c.invalidate();release();await saving;assert.equal(raw,null);
});
