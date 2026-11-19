import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '/Users/xiao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const base='http://127.0.0.1:4219', output=process.env.PLANCHIME_QA_OUTPUT??'/private/tmp/PAY-20261119-H5-F2-browser-final';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const results=[],errors=[],forbidden=[],captures=[];
async function context(width=393) {
 const c=await browser.newContext({viewport:{width,height:900}});
 c.setDefaultTimeout(10000);
 await c.route('**/*',route=>{const r=route.request();if(new URL(r.url()).origin===base&&['GET','HEAD'].includes(r.method()))return route.continue();forbidden.push({url:r.url(),method:r.method()});return route.abort();});
 c.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));return c;
}
async function open(c,params='') {const p=await c.newPage();await p.goto(`${base}/tests/browser/member-services-harness.html${params}`);await p.getByRole('heading',{name:'我的服务',exact:true}).waitFor();return p;}
async function shot(p,name){
 // 首次窄屏截图须等待字体与绘制稳定；保留整页原生截图及单挂载证据，不剪裁或拼图。
 await p.waitForLoadState('networkidle');await p.evaluate(async()=>{document.activeElement?.blur();scrollTo({top:0,behavior:'instant'});await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
 const dom=await p.evaluate(()=>({main:document.querySelectorAll('main').length,h1:document.querySelectorAll('h1').length,header:document.querySelectorAll('.site-header').length,footer:document.querySelectorAll('.site-footer').length,height:document.documentElement.scrollHeight,footerBottom:document.querySelector('.site-footer').getBoundingClientRect().bottom+scrollY}));
 assert.equal(dom.main,1);assert.equal(dom.h1,1);assert.equal(dom.header,1);assert.equal(dom.footer,1);assert.ok(dom.footerBottom<=dom.height+1);captures.push({name,...dom});
 await p.screenshot({path:`${output}/${name}.png`,fullPage:true,animations:'disabled',caret:'hide'});
}
async function fits(p){assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);const clipped=await p.locator('main button,main input,main textarea,main h2').evaluateAll(nodes=>nodes.filter(n=>n.getClientRects().length).filter(n=>{const r=n.getBoundingClientRect();return r.left< -1||r.right>innerWidth+1;}).map(n=>n.tagName));assert.deepEqual(clipped,[]);}
const items=p=>p.evaluate(()=>JSON.parse(localStorage.getItem('planchime.web-planner.v1')??'{"items":[]}').items);
try{
 for(const width of [320,393,1440]){
  const c=await context(width),p=await open(c,'?closed');await p.getByText('会员服务尚未开放',{exact:true}).waitFor();assert.equal(await p.locator('form,input,textarea').count(),0);assert.equal(await p.evaluate(()=>memberQA.fixture.calls.length),0);await fits(p);await shot(p,`closed-${width}`);await c.close();
 }
 results.push('default-closed-zero-api-no-identity-form-320-393-1440');
 const c=await context(),p=await open(c);await p.getByText('当前账号剩余文字整理 300 次。',{exact:true}).waitFor();
 await p.getByLabel('想安排的事情',{exact:true}).fill('合成测试：下周三上午十点去图书馆');
 assert.equal(await p.evaluate(()=>memberQA.fixture.calls.filter(c=>c.path==='/v1/web-pro/text-drafts').length),0);
 await p.getByText('本次使用 1 次文字额度。',{exact:false}).waitFor();await p.getByLabel('我已了解上述说明，同意发送这次文字。',{exact:true}).check();await shot(p,'text-disclosure-393');await p.getByRole('button',{name:'确认发送并整理',exact:true}).click();
 await p.getByText('这次处理结果还在核对，请先查询本次结果。',{exact:true}).waitFor();assert.equal((await items(p)).length,0);await shot(p,'text-queued-393');
 await p.getByRole('button',{name:'查询本次结果',exact:true}).click();await p.getByText('已整理成草稿。确认日期和时间后，再保存到浏览器。',{exact:true}).waitFor();
 assert.equal((await items(p)).length,0);await p.getByLabel('事情',{exact:true}).fill('合成测试：已核对的图书馆安排');await shot(p,'text-editable-393');
 await p.getByLabel('我已核对，保存到当前浏览器；退出账号后仍保留。',{exact:true}).check();await p.getByRole('button',{name:'确认保存到浏览器',exact:true}).click();
 await p.getByText('已保存在当前浏览器。退出账号不会移除这条日程；网页不发送到点提醒。',{exact:true}).waitFor();assert.equal((await items(p)).length,1);
 results.push('text-disclosure-explicit-send-original-query-edit-separate-local-confirm');

 await p.getByRole('button',{name:'云备份',exact:true}).click();await p.getByText('这个账号还没有云备份。',{exact:true}).waitFor();await p.getByRole('button',{name:'预览当前浏览器日程',exact:true}).click();await p.getByRole('region',{name:'云备份上传预览'}).waitFor();
 assert.equal(await p.evaluate(()=>memberQA.fixture.calls.filter(c=>c.path==='/v1/web-pro/backups'&&c.method==='POST').length),0);await shot(p,'backup-preview-393');
 await p.getByRole('button',{name:'确认上传这份日程',exact:true}).click();await p.getByRole('button',{name:'查看恢复预览',exact:true}).waitFor();await p.getByRole('button',{name:'查看恢复预览',exact:true}).click();await p.getByRole('region',{name:'云备份恢复预览'}).waitFor();await shot(p,'backup-restore-393');
 await p.getByText('将新增 0 条，保留当前浏览器中已有的 1 条。',{exact:true}).waitFor();
 await p.evaluate(()=>{const key='planchime.web-planner.v1',doc=JSON.parse(localStorage.getItem(key));doc.items.push({...doc.items[0],id:'synthetic-local-added',revision:'local-added',title:'合成测试：预览后在本机新增'});localStorage.setItem(key,JSON.stringify(doc));});
 await p.getByRole('button',{name:'确认合并到当前浏览器',exact:true}).click();await p.getByText('本机日程已更新，请重新核对恢复预览后确认。尚未写入备份内容。',{exact:true}).waitFor();assert.equal((await items(p)).length,2);await p.getByText('将新增 0 条，保留当前浏览器中已有的 2 条。',{exact:true}).waitFor();await shot(p,'backup-preview-changed-393');
 await p.getByRole('button',{name:'确认合并到当前浏览器',exact:true}).click();await p.getByText('已合并 0 条，保留本机已有的 2 条。网页不登记提醒。',{exact:true}).waitFor();assert.equal((await items(p)).length,2);
 results.push('backup-explicit-preview-upload-read-merge-no-overwrite');

 await p.getByRole('button',{name:'主题',exact:true}).click();await p.getByText('当前账号拥有这款主题。',{exact:true}).waitFor();await p.getByRole('button',{name:'应用到网页日程',exact:true}).click();await p.locator('[data-service-theme=mosslight]').waitFor();await shot(p,'theme-owned-393');
 const planner=await c.newPage();await planner.goto(`${base}/tests/browser/member-services-harness.html?view=planner`);await planner.locator('[data-planner-theme=mosslight]').waitFor();await planner.getByRole('heading',{name:'合成测试：已核对的图书馆安排',exact:true}).waitFor();await shot(planner,'theme-applied-planner-393');
 await planner.evaluate(()=>{const art=document.querySelector('[data-planner-theme] img');window.themeRemoved=0;window.themeArt=art;window.themeObserver=new MutationObserver(rows=>{for(const row of rows)for(const n of row.removedNodes)if(n===art)window.themeRemoved++;});themeObserver.observe(art.parentElement,{childList:true});memberQA.fixture.state.entitlementGate=new Promise(resolve=>window.releaseTheme=resolve);dispatchEvent(new Event('focus'));});
 await planner.waitForTimeout(100);assert.equal(await planner.locator('[data-planner-theme=mosslight]').count(),1);await shot(planner,'theme-refresh-stable-planner-393');
 await planner.evaluate(()=>{memberQA.fixture.state.entitlementGate=null;releaseTheme();});await planner.waitForTimeout(100);assert.equal(await planner.evaluate(()=>themeRemoved),0);assert.equal(await planner.evaluate(()=>themeArt===document.querySelector('[data-planner-theme] img')),true);
 const before=await items(planner);await p.evaluate(async()=>{memberQA.fixture.state.refunded=true;memberQA.fixture.state.revision++;await memberQA.controller.refresh();});await p.getByText('这款主题的权益已撤回，正在使用免费外观。',{exact:true}).waitFor();assert.equal(await p.locator('[data-service-theme=free]').count(),1);
 await planner.evaluate(()=>{memberQA.fixture.state.refunded=true;memberQA.fixture.state.revision++;dispatchEvent(new Event('focus'));});await planner.locator('[data-planner-theme=free]').waitFor();assert.deepEqual(await items(planner),before);await shot(planner,'theme-refunded-planner-393');
 await p.getByRole('button',{name:'退出账号',exact:true}).click();await p.getByRole('heading',{name:'使用原手机号登录',exact:true}).waitFor();assert.deepEqual(await items(p),before);await shot(p,'logged-out-393');results.push('theme-component-stable-refresh-refund-logout-free-local-items-preserved');await c.close();

 const bc=await context(),bp=await open(bc);await bp.getByText('当前账号剩余文字整理 300 次。',{exact:true}).waitFor();
 await bp.evaluate(async()=>{memberQA.fixture.state.balances=[{validUntil:new Date(Date.now()+30*86400000).toISOString(),textRemaining:200,voiceSecondsRemaining:2400},{validUntil:new Date(Date.now()+86400000).toISOString(),textRemaining:100,voiceSecondsRemaining:1200}];await memberQA.controller.refresh();});
 assert.equal(await bp.getByRole('list',{name:'文字额度与到期时间'}).getByRole('listitem').count(),2);assert.match(await bp.getByRole('list',{name:'文字额度与到期时间'}).getByRole('listitem').first().innerText(),/剩余 100 次/);await shot(bp,'text-expiry-batches-393');
 await bp.evaluate(()=>{memberQA.fixture.state.membership='none';});await bp.getByRole('button',{name:'云备份',exact:true}).click();await bp.getByText('这个账号还没有云备份。',{exact:true}).waitFor();assert.equal(await bp.getByRole('button',{name:'预览当前浏览器日程',exact:true}).isDisabled(),true);await shot(bp,'backup-unpurchased-393');
 await bp.evaluate(()=>{const document={format:'planchime-web-planner',version:1,items:[{id:'synthetic-retained',revision:'r1',title:'合成测试：保留期中的云备份',date:'',time:'',notes:'',completed:false,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}]};const metadata={schemaVersion:1,requestId:'synthetic-retained',createdAt:new Date(Date.now()-2*86400000).toISOString(),byteLength:new TextEncoder().encode(JSON.stringify(document)).byteLength,itemCount:1,downloadUntil:new Date(Date.now()+20*86400000).toISOString(),available:true};memberQA.fixture.state.backups.set(metadata.requestId,{metadata,document});memberQA.fixture.state.membership='expired';});
 await bp.getByRole('button',{name:'重新查看备份',exact:true}).click();await bp.getByRole('button',{name:'查看恢复预览',exact:true}).waitFor();assert.equal(await bp.getByRole('button',{name:'预览当前浏览器日程',exact:true}).isDisabled(),true);await shot(bp,'backup-expired-downloadable-393');
 await bp.evaluate(()=>{memberQA.fixture.state.membership='refunded';});await bp.getByRole('button',{name:'重新查看备份',exact:true}).click();await bp.getByText('当前没有可上传的会员有效期。',{exact:true}).waitFor();await bp.getByRole('button',{name:'查看恢复预览',exact:true}).click();await bp.getByText('将新增 1 条，保留当前浏览器中已有的 0 条。',{exact:true}).waitFor();await shot(bp,'backup-refunded-downloadable-393');
 assert.equal(await bp.evaluate(()=>memberQA.fixture.calls.some(c=>c.path==='/v1/web-pro/backups'&&c.method==='POST')),false);
 await bp.getByRole('button',{name:'暂不恢复',exact:true}).click();await bp.getByRole('button',{name:'文字整理',exact:true}).click();await bp.evaluate(()=>{memberQA.fixture.state.backupUnavailable=true;});await bp.getByRole('button',{name:'云备份',exact:true}).click();await bp.getByText('暂时无法查看备份，当前浏览器中的日程未改变。',{exact:true}).waitFor();await shot(bp,'backup-error-393');
 await bp.evaluate(()=>{memberQA.fixture.state.backupUnavailable=false;});await bp.getByRole('button',{name:'重新查看备份',exact:true}).click();await bp.getByRole('button',{name:'查看恢复预览',exact:true}).waitFor();assert.equal(await bp.getByRole('alert').count(),0);await shot(bp,'backup-error-recovered-393');await bc.close();results.push('per-batch-expiry-backup-unpurchased-expired-refunded-error-recovery');

 const tc=await context(),tp=await tc.newPage();await tp.clock.install();await tp.goto(`${base}/tests/browser/member-services-harness.html?view=planner`);
 await tp.evaluate(async()=>{const {saveThemePreference}=await import('/app/lib/services/theme.ts');await saveThemePreference(true,'synthetic-account-a');dispatchEvent(new Event('focus'));});await tp.locator('[data-planner-theme=mosslight]').waitFor();
 await tp.evaluate(()=>{memberQA.fixture.state.entitlementGate=new Promise(resolve=>window.releaseTheme=resolve);dispatchEvent(new Event('focus'));});await tp.waitForTimeout(100);await tp.clock.fastForward(91_000);await tp.locator('[data-planner-theme=free]').waitFor();await tp.evaluate(()=>{memberQA.fixture.state.entitlementGate=null;releaseTheme();});await tp.waitForTimeout(100);assert.equal(await tp.locator('[data-planner-theme=free]').count(),1);
 await tp.evaluate(()=>dispatchEvent(new Event('focus')));await tp.locator('[data-planner-theme=mosslight]').waitFor();await tp.evaluate(()=>{memberQA.fixture.state.unavailable=true;dispatchEvent(new Event('focus'));});await tp.locator('[data-planner-theme=free]').waitFor();
 await tp.evaluate(()=>{memberQA.fixture.state.unavailable=false;dispatchEvent(new Event('focus'));});await tp.locator('[data-planner-theme=mosslight]').waitFor();await tp.evaluate(()=>dispatchEvent(new Event('offline')));await tp.locator('[data-planner-theme=free]').waitFor();
 await tp.evaluate(()=>dispatchEvent(new Event('focus')));await tp.locator('[data-planner-theme=mosslight]').waitFor();await tp.evaluate(()=>{memberQA.fixture.state.account='synthetic-account-b';memberQA.fixture.state.entitlementGate=new Promise(()=>{});dispatchEvent(new Event('focus'));});await tp.locator('[data-planner-theme=free]').waitFor();await tc.close();results.push('theme-bounded-lease-late-result-failure-offline-account-change');

 const uc=await context(1440),up=await open(uc);await up.getByText('当前账号剩余文字整理 300 次。',{exact:true}).waitFor();await up.evaluate(()=>{memberQA.fixture.state.unknownText=true;});
 await up.getByLabel('想安排的事情',{exact:true}).fill('合成测试：未知结果');await up.getByLabel('我已了解上述说明，同意发送这次文字。',{exact:true}).check();await up.getByRole('button',{name:'确认发送并整理',exact:true}).click();await up.getByRole('button',{name:'查询本次结果',exact:true}).waitFor();await shot(up,'text-unknown-1440');
 await up.getByRole('button',{name:'查询本次结果',exact:true}).click();await up.getByLabel('事情',{exact:true}).waitFor();assert.equal(await up.evaluate(()=>memberQA.fixture.calls.filter(c=>c.path==='/v1/web-pro/text-drafts').length),1);
 await up.evaluate(async()=>{memberQA.fixture.state.account='synthetic-account-b';await memberQA.controller.refresh();});assert.equal(await up.getByLabel('事情',{exact:true}).count(),0);await up.getByLabel('想安排的事情',{exact:true}).waitFor();assert.equal(await up.getByLabel('想安排的事情',{exact:true}).inputValue(),'');await shot(up,'account-b-empty-1440');await uc.close();results.push('unknown-only-original-query-account-switch-clears-private-input');

 const large=await context(320),lp=await open(large);await lp.getByText('当前账号剩余文字整理 300 次。',{exact:true}).waitFor();await fits(lp);
 await lp.evaluate(()=>{const sizes=[...document.querySelectorAll('body,body *')].map(node=>[node,parseFloat(getComputedStyle(node).fontSize)]);sizes.forEach(([node,size])=>{if(node instanceof HTMLElement)node.style.setProperty('font-size',`${size*2}px`,'important');});});await fits(lp);await shot(lp,'text-200-percent-320');await large.close();results.push('320-200-percent-font-reflow');
 assert.deepEqual(forbidden,[]);assert.deepEqual(errors,[]);
 await writeFile(`${output}/report.json`,JSON.stringify({results,captures,forbidden,errors,fixtureOnly:true,productionCalls:0,plannerEvidence:'component harness; real /planner/ route pending Local build'},null,2));console.log(JSON.stringify({output,results:results.length,errors,forbidden}));
}finally{await browser.close();}
