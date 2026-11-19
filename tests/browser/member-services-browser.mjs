import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '/Users/xiao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const base='http://127.0.0.1:4219', output=process.env.PLANCHIME_QA_OUTPUT??'/private/tmp/PAY-20261119-H5-F1-browser';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const results=[],errors=[],forbidden=[];
async function context(width=393) {
 const c=await browser.newContext({viewport:{width,height:900}});
 c.setDefaultTimeout(10000);
 await c.route('**/*',route=>{const r=route.request();if(new URL(r.url()).origin===base&&['GET','HEAD'].includes(r.method()))return route.continue();forbidden.push({url:r.url(),method:r.method()});return route.abort();});
 c.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));return c;
}
async function open(c,params='') {const p=await c.newPage();await p.goto(`${base}/tests/browser/member-services-harness.html${params}`);await p.getByRole('heading',{name:'我的服务',exact:true}).waitFor();return p;}
async function shot(p,name){await p.evaluate(()=>{document.activeElement?.blur();scrollTo({top:0,behavior:'instant'});});await p.waitForTimeout(150);await p.screenshot({path:`${output}/${name}.png`,fullPage:true});}
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
 await p.getByLabel('我已了解上述说明，同意发送这次文字。',{exact:true}).check();await shot(p,'text-disclosure-393');await p.getByRole('button',{name:'确认发送并整理',exact:true}).click();
 await p.getByText('这次处理结果还在核对，请先查询本次结果。',{exact:true}).waitFor();assert.equal((await items(p)).length,0);await shot(p,'text-queued-393');
 await p.getByRole('button',{name:'查询本次结果',exact:true}).click();await p.getByText('已整理成草稿。确认日期和时间后，再保存到浏览器。',{exact:true}).waitFor();
 assert.equal((await items(p)).length,0);await p.getByLabel('事情',{exact:true}).fill('合成测试：已核对的图书馆安排');await shot(p,'text-editable-393');
 await p.getByLabel('我已核对，保存到当前浏览器；退出账号后仍保留。',{exact:true}).check();await p.getByRole('button',{name:'确认保存到浏览器',exact:true}).click();
 await p.getByText('已保存在当前浏览器。退出账号不会移除这条日程；网页不发送到点提醒。',{exact:true}).waitFor();assert.equal((await items(p)).length,1);
 results.push('text-disclosure-explicit-send-original-query-edit-separate-local-confirm');

 await p.getByRole('button',{name:'云备份',exact:true}).click();await p.getByText('这个账号还没有云备份。',{exact:true}).waitFor();await p.getByRole('button',{name:'预览当前浏览器日程',exact:true}).click();await p.getByRole('region',{name:'云备份上传预览'}).waitFor();
 assert.equal(await p.evaluate(()=>memberQA.fixture.calls.filter(c=>c.path==='/v1/web-pro/backups'&&c.method==='POST').length),0);await shot(p,'backup-preview-393');
 await p.getByRole('button',{name:'确认上传这份日程',exact:true}).click();await p.getByRole('button',{name:'查看恢复预览',exact:true}).waitFor();await p.getByRole('button',{name:'查看恢复预览',exact:true}).click();await p.getByRole('region',{name:'云备份恢复预览'}).waitFor();await shot(p,'backup-restore-393');
 await p.getByRole('button',{name:'确认合并到当前浏览器',exact:true}).click();await p.getByText('已合并 0 条，保留本机已有的 1 条。网页不登记提醒。',{exact:true}).waitFor();assert.equal((await items(p)).length,1);
 results.push('backup-explicit-preview-upload-read-merge-no-overwrite');

 await p.getByRole('button',{name:'主题',exact:true}).click();await p.getByText('当前账号拥有这款主题。',{exact:true}).waitFor();await p.getByRole('button',{name:'应用到网页日程',exact:true}).click();await p.locator('[data-service-theme=mosslight]').waitFor();await shot(p,'theme-owned-393');
 const planner=await c.newPage();await planner.goto(`${base}/tests/browser/member-services-harness.html?view=planner`);await planner.locator('[data-planner-theme=mosslight]').waitFor();await planner.getByRole('heading',{name:'合成测试：已核对的图书馆安排',exact:true}).waitFor();await shot(planner,'theme-applied-planner-393');
 const before=await items(planner);await p.evaluate(async()=>{memberQA.fixture.state.refunded=true;memberQA.fixture.state.revision++;await memberQA.controller.refresh();});await p.getByText('这款主题的权益已撤回，正在使用免费外观。',{exact:true}).waitFor();assert.equal(await p.locator('[data-service-theme=free]').count(),1);
 await planner.evaluate(()=>{memberQA.fixture.state.refunded=true;memberQA.fixture.state.revision++;dispatchEvent(new Event('focus'));});await planner.locator('[data-planner-theme=free]').waitFor();assert.deepEqual(await items(planner),before);await shot(planner,'theme-refunded-planner-393');
 await p.getByRole('button',{name:'退出账号',exact:true}).click();await p.getByRole('heading',{name:'使用原手机号登录',exact:true}).waitFor();assert.deepEqual(await items(p),before);await shot(p,'logged-out-393');results.push('theme-real-planner-apply-refund-logout-free-local-items-preserved');await c.close();

 const uc=await context(1440),up=await open(uc);await up.getByText('当前账号剩余文字整理 300 次。',{exact:true}).waitFor();await up.evaluate(()=>{memberQA.fixture.state.unknownText=true;});
 await up.getByLabel('想安排的事情',{exact:true}).fill('合成测试：未知结果');await up.getByLabel('我已了解上述说明，同意发送这次文字。',{exact:true}).check();await up.getByRole('button',{name:'确认发送并整理',exact:true}).click();await up.getByRole('button',{name:'查询本次结果',exact:true}).waitFor();await shot(up,'text-unknown-1440');
 await up.getByRole('button',{name:'查询本次结果',exact:true}).click();await up.getByLabel('事情',{exact:true}).waitFor();assert.equal(await up.evaluate(()=>memberQA.fixture.calls.filter(c=>c.path==='/v1/web-pro/text-drafts').length),1);
 await up.evaluate(async()=>{memberQA.fixture.state.account='synthetic-account-b';await memberQA.controller.refresh();});assert.equal(await up.getByLabel('事情',{exact:true}).count(),0);await up.getByLabel('想安排的事情',{exact:true}).waitFor();assert.equal(await up.getByLabel('想安排的事情',{exact:true}).inputValue(),'');await shot(up,'account-b-empty-1440');await uc.close();results.push('unknown-only-original-query-account-switch-clears-private-input');

 const large=await context(320),lp=await open(large);await lp.getByText('当前账号剩余文字整理 300 次。',{exact:true}).waitFor();await fits(lp);
 await lp.evaluate(()=>{const sizes=[...document.querySelectorAll('body,body *')].map(node=>[node,parseFloat(getComputedStyle(node).fontSize)]);sizes.forEach(([node,size])=>{if(node instanceof HTMLElement)node.style.setProperty('font-size',`${size*2}px`,'important');});});await fits(lp);await shot(lp,'text-200-percent-320');await large.close();results.push('320-200-percent-font-reflow');
 assert.deepEqual(forbidden,[]);assert.deepEqual(errors,[]);
 await writeFile(`${output}/report.json`,JSON.stringify({results,forbidden,errors,fixtureOnly:true,productionCalls:0},null,2));console.log(JSON.stringify({output,results:results.length,errors,forbidden}));
}finally{await browser.close();}
