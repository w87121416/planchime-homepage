import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { WebPurchaseClient } from '../app/lib/purchase/commerce.ts';
import { PurchaseClientError } from '../app/lib/purchase/protocol.ts';
import { disclosureRevisionInput } from '../app/lib/purchase/disclosure.ts';

// 合成响应只在本机内存传递，不创建真实订单、不使用平台凭据。
const now = Date.parse('2026-11-09T08:00:00Z'), instant = new Date(now).toISOString();
const json = (v, status = 200) => new Response(JSON.stringify(v), {status,headers:{'content-type':'application/json'}});
const merchant = '米堆（南京）网络科技有限公司';
const product = { productId:'synthetic-theme',displayName:'合成主题，不可销售',amountMinor:600,currency:'CNY',fulfillment:{schemaVersion:1,kind:'theme',themeId:'synthetic-art',entitlementKey:'theme.synthetic-art.owned',manifestVersion:'synthetic-v1'},
  disclosure:{schemaVersion:1,merchantName:merchant,deliverySummary:'合成测试，不可销售',exclusions:['不包含会员及 AI 额度'],compatibility:[{platform:'android',minimumVersion:'0.0.0-synthetic'}],refundPolicy:{version:'synthetic-v1',summary:'合成退款说明',url:'https://planchime.com/services/purchase-info/'},saleReady:true,fulfillmentReady:true}};
product.catalogRevision = createHash('sha256').update(disclosureRevisionInput(product,product.disclosure)).digest('hex');
const order = (variant,extra={}) => ({orderId:'wx_synthetic',productId:product.productId,amountMinor:600,currency:'CNY',checkoutVariant:variant,merchantDisplayName:merchant,status:'awaiting-user-payment',fulfillmentStatus:'not-requested',revision:1,createdAtUtc:instant,updatedAtUtc:instant,...extra});
const launch = variant => variant === 'wechat-native' ? {schemaVersion:1,type:variant,codeUrl:'weixin://wxpay/bizpayurl?pr=SYNTHETIC_NOT_PAYABLE',expiresAtUtc:new Date(now+60000).toISOString()} :
  {schemaVersion:1,type:variant,method:'GET',url:'https://wx.tenpay.com/cgi-bin/mmpayweb-bin/checkmweb?prepay_id=SYNTHETIC_NOT_PAYABLE',expiresAtUtc:new Date(now+60000).toISOString(),orderExpiresAtUtc:new Date(now+600000).toISOString()};
function fixture(variant='wechat-native') {
  const calls=[],persisted=new Map(); let counter=0,tail=Promise.resolve();
  const state={accountId:'synthetic-a',current:order(variant),created:false,lose:false,status:'created',launch:launch(variant),handler:null};
  const runtime={origin:'https://planchime.com',now:()=>now,randomUUID:()=>`synthetic-key-${++counter}`,digest:async v=>createHash('sha256').update(v).digest('hex'),canUseDesktopPayment:()=>variant==='wechat-native',canUseH5Payment:()=>variant==='wechat-h5',
    locks:{request(_n,_o,action){const next=tail.then(()=>action({}));tail=next.catch(()=>{});return next;}},
    storage:{getItem:k=>persisted.get(k)??null,setItem:(k,v)=>persisted.set(k,v),removeItem:k=>persisted.delete(k)},
    fetch:async(url,options)=>{
      const path=new URL(url).pathname,body=options.body?JSON.parse(options.body):null;calls.push({path,body,...options});
      const overridden=await state.handler?.(path,options,body);if(overridden)return overridden;
      if(path==='/v1/web-auth/session')return json({schemaVersion:1,status:'authenticated',accountId:state.accountId,csrfToken:'a'.repeat(64),phoneOtp:'available'});
      if(path==='/v1/commerce/catalog')return json({schemaVersion:1,status:'available',checkoutEnabled:true,products:[product]});
      if(path==='/v1/commerce/wechat/catalog')return json({schemaVersion:1,checkoutEnabled:true,products:[{...product,checkoutOptions:['wechat-native','wechat-h5'].map(checkoutVariant=>({checkoutVariant,availability:'available',merchantDisplayName:merchant}))}]});
      if(path==='/v1/commerce/entitlements')return json({schemaVersion:1,snapshot:{schemaVersion:1,authority:'commerce-service-verified',accountId:state.accountId,entitlementRevision:1,evaluatedAt:instant,entitlements:[]}});
      if(path.endsWith('/order-intents/recover'))return json(state.created?{schemaVersion:1,status:'found',order:state.current}:{schemaVersion:1,status:'not-found'});
      if(path==='/v1/commerce/orders'&&options.method==='GET')return json({schemaVersion:1,orders:[],hasMore:false});
      if(path==='/v1/commerce/wechat/orders'&&options.method==='GET')return json({schemaVersion:1,orders:state.created?[state.current]:[],hasMore:false});
      if(path==='/v1/commerce/wechat/orders'&&options.method==='POST'){
        state.created=true;if(state.lose){state.lose=false;throw Error('synthetic timeout');}
        return json({schemaVersion:1,status:state.status,order:state.current,...(state.status==='created'?{launchPayload:state.launch}:{})});
      }
      if(path==='/v1/commerce/orders/wx_synthetic')return json({schemaVersion:1,status:'error',code:'COMMERCE_ORDER_NOT_FOUND'},404);
      if(path==='/v1/commerce/wechat/orders/wx_synthetic')return json({schemaVersion:1,order:state.current});
      if(path.endsWith('/launch'))return json({schemaVersion:1,status:'ready',order:state.current,launchPayload:state.launch});
      if(path.endsWith('/reconcile'))return json({schemaVersion:1,status:'not-settled'});
      throw Error('unexpected synthetic endpoint');
    }};
  const config={mode:'sandbox',apiOrigin:'https://api.planchime.com',wechatWebConfigured:true};
  return {client:new WebPurchaseClient(config,runtime),runtime,config,state,calls,persisted};
}
const confirm = (f,variant=f.state.current.checkoutVariant) => f.client.confirmPurchase({productId:product.productId,expectedCatalogRevision:product.catalogRevision,expectedAccountId:'synthetic-a',checkoutVariant:variant,userConfirmed:true});
const rejects=(p,code)=>assert.rejects(p,e=>e instanceof PurchaseClientError&&e.code===code);

test('微信 Native 与 H5 用独立 Cookie/CSRF 契约；合并目录保留两种明确渠道',async()=>{
  for(const variant of ['wechat-native','wechat-h5']){
    const f=fixture(variant);const c=await f.client.getAvailableCatalog();assert.equal(c.products.length,1);assert.deepEqual(c.products[0].checkoutVariants,[variant==='wechat-native'?'alipay-pc-web':'alipay-h5-web',variant]);
    const intent=await confirm(f);const r=await f.client.createOrder(intent);
    assert.equal(r.order.checkoutVariant,variant);assert.equal(r.order.merchantDisplayName,merchant);
    if(variant==='wechat-native'){assert.equal(r.paymentDestination,null);assert.equal(r.qrCode.codeUrl,f.state.launch.codeUrl);}else assert.equal(r.paymentDestination,f.state.launch.url);
    const write=f.calls.find(c=>c.path==='/v1/commerce/wechat/orders'&&c.method==='POST');const body=JSON.parse(write.body);
    assert.equal(body.clientPurchaseIntentId,intent.idempotencyKey);assert.equal(body.checkoutVariant,variant);assert.equal(write.headers['X-Appsch-Commerce-Version'],'2026-11-09');assert.equal(write.headers['X-Planchime-CSRF'],'a'.repeat(64));assert.equal(write.credentials,'include');assert.equal(write.headers.Authorization,undefined);
    assert.equal(JSON.stringify([...f.persisted.values()]).includes('SYNTHETIC_NOT_PAYABLE'),false);
  }
});
test('下单响应丢失只恢复同一微信原单，重载不重新调起、不换单',async()=>{
  const f=fixture();f.state.lose=true;const i=await confirm(f);await rejects(f.client.createOrder(i),'NETWORK_UNAVAILABLE');
  f.client=new WebPurchaseClient(f.config,f.runtime);const restored=await f.client.recoverPurchases('synthetic-a');assert.equal(restored[0].order.orderId,'wx_synthetic');
  assert.equal(f.calls.filter(c=>c.path==='/v1/commerce/wechat/orders'&&c.method==='POST').length,1);
  const r=await f.client.recoverPaymentLink('wx_synthetic','synthetic-a',true);assert.equal(r.qrCode.codeUrl,f.state.launch.codeUrl);
  assert.equal(f.calls.filter(c=>c.path.endsWith('/launch')).length,1);
});
test('新设备先只读查渠道，原码续付不创建意图或改变渠道',async()=>{
  const f=fixture();f.state.created=true;const r=await f.client.recoverPaymentLink('wx_synthetic','synthetic-a',true);
  assert.equal(r.order.checkoutVariant,'wechat-native');assert.equal(f.persisted.size,0);
  assert.deepEqual(f.calls.filter(c=>c.path.includes('/orders/')).map(c=>c.path),['/v1/commerce/orders/wx_synthetic','/v1/commerce/wechat/orders/wx_synthetic','/v1/commerce/wechat/orders/wx_synthetic/launch']);
  assert.ok(f.calls.every(c=>!c.path.endsWith('/orders')||c.method==='GET'));
});
test('新订单换渠道被同一意图阻止；手机不把 Native 原单变成 H5',async()=>{
  const f=fixture();await confirm(f);await rejects(confirm(f,'alipay-pc-web'),'RECOVERY_CHANNEL_CHANGED');
  const mobile=fixture('wechat-h5');mobile.state.current=order('wechat-native');mobile.state.launch=launch('wechat-native');
  assert.equal((await mobile.client.recoverPaymentLink('wx_synthetic','synthetic-a',true)).order.checkoutVariant,'wechat-native');
  assert.equal(mobile.calls.some(c=>JSON.stringify(c.body).includes('"checkoutVariant":"wechat-h5"')),false);
});
test('停用或内置浏览器不能新建微信订单，仍可只读查看历史订单',async()=>{
  const f=fixture();const off=new WebPurchaseClient({...f.config,wechatWebConfigured:false},f.runtime);
  await rejects(off.confirmPurchase({productId:product.productId,expectedCatalogRevision:product.catalogRevision,expectedAccountId:'synthetic-a',checkoutVariant:'wechat-native',userConfirmed:true}),'COMMERCE_CONFIGURATION_REQUIRED');assert.equal(f.calls.length,0);
  const blocked=fixture('wechat-h5');blocked.runtime.canUseH5Payment=()=>false;await rejects(confirm(blocked),'H5_PAYMENT_REQUIRED');assert.equal(blocked.calls.length,0);
});
test('合并列表校验订单所属渠道；核验不能将微信订单替换成支付宝',async()=>{
  const f=fixture();f.state.created=true;assert.equal((await f.client.listOrders('synthetic-a')).orders[0].checkoutVariant,'wechat-native');
  f.state.handler=async path=>path.endsWith('/reconcile')?json({schemaVersion:1,status:'settled',order:order('alipay-h5-web',{status:'settled'})}):null;
  await rejects(f.client.reconcileOrder('wx_synthetic','synthetic-a'),'INVALID_RESPONSE');
  f.state.handler=async path=>path==='/v1/commerce/orders'?json({schemaVersion:1,orders:[f.state.current],hasMore:false}):null;
  await rejects(f.client.listOrders('synthetic-a'),'INVALID_RESPONSE');
});
test('过期、改域名、重复参数和 redirect_url 均不调起 H5',async()=>{
  const changes=[p=>({...p,url:p.url.replace('wx.tenpay.com','evil.invalid')}),p=>({...p,url:p.url+'&redirect_url=https%3A%2F%2Fevil.invalid'}),p=>({...p,url:p.url+'&prepay_id=other'}),p=>({...p,expiresAtUtc:instant}),p=>({...p,orderExpiresAtUtc:instant})];
  for(const change of changes){const f=fixture('wechat-h5');f.state.launch=change(f.state.launch);await rejects(f.client.recoverPaymentLink('wx_synthetic','synthetic-a',true),'PAYMENT_DESTINATION_REJECTED');}
});
test('过期原单和已付待交付只呈现真实状态，不返回另一条支付入口',async()=>{
  const f=fixture('wechat-h5');f.state.status='provider-query-required';const r=await f.client.createOrder(await confirm(f));assert.equal(r.status,'provider-query-required');assert.equal(r.paymentDestination,null);
  f.state.current=order('wechat-h5',{status:'settled',fulfillmentStatus:'pending',revision:2});const paid=await f.client.recoverPaymentLink('wx_synthetic','synthetic-a',true);assert.equal(paid.status,'already-settled');assert.equal(paid.paymentDestination,null);assert.equal(paid.qrCode,undefined);assert.equal(f.calls.filter(c=>c.path.endsWith('/launch')).length,0);
});
test('二维码载荷与渠道不匹配或过期时拒绝；账号切换也不继续付款',async()=>{
  for(const change of [p=>({...p,codeUrl:'https://evil.invalid'}),p=>({...p,type:'wechat-h5'}),p=>({...p,expiresAtUtc:instant})]){const f=fixture();f.state.launch=change(f.state.launch);await rejects(f.client.recoverPaymentLink('wx_synthetic','synthetic-a',true),'PAYMENT_DESTINATION_REJECTED');}
  const f=fixture();f.state.accountId='synthetic-b';await rejects(f.client.recoverPaymentLink('wx_synthetic','synthetic-a',true),'ACCOUNT_CHANGED');assert.equal(f.calls.filter(c=>c.path.endsWith('/launch')).length,0);
});

test('另一渠道原单导致明确拒绝时，不把原单塞进本次错误渠道日志；关闭后可重新确认',async()=>{
  const f=fixture();let old=order('alipay-pc-web',{orderId:'pc_old_synthetic'});
  f.state.handler=async (path,options)=>{
    if(path==='/v1/commerce/wechat/orders'&&options.method==='POST')return json({schemaVersion:1,status:'error',code:'COMMERCE_PURCHASE_IN_PROGRESS',existingOrderId:old.orderId},409);
    if(path==='/v1/commerce/orders/pc_old_synthetic')return json({schemaVersion:1,order:old});
    return null;
  };
  const first=await confirm(f);await rejects(f.client.createOrder(first),'RECOVERY_CHANNEL_CHANGED');
  assert.equal([...f.persisted.values()].some(raw=>JSON.parse(raw).entries.length>0),false);
  assert.equal((await f.client.getOrder(old.orderId,'synthetic-a')).checkoutVariant,undefined);
  await rejects(f.client.createOrder(first),'PURCHASE_RECONFIRMATION_REQUIRED');
  old={...old,status:'closed',revision:2};assert.equal((await f.client.getOrder(old.orderId,'synthetic-a')).status,'closed');
  const next=await confirm(f);assert.notEqual(next.idempotencyKey,first.idempotencyKey);
});
