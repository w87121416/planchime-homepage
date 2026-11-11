import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { disclosureRevisionInput } from "../app/lib/purchase/disclosure.ts";
import { WebPurchaseClient } from "../app/lib/purchase/commerce.ts";
import { PurchaseClientError, orderProgress, parseCatalog, parseOrder } from "../app/lib/purchase/protocol.ts";
import { purchaseRecovery } from "../app/lib/purchase/recovery.ts";
import { PurchaseTransport } from "../app/lib/purchase/transport.ts";

// 全部服务响应都是合成契约夹具，fetch 在进程内注入；不向任何服务器创建订单或发送短信。
const now = Date.parse("2026-10-19T08:00:00.000Z");
const instant = new Date(now).toISOString();
const csrf = "a".repeat(64);
const rotated = "b".repeat(64);
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const auth = (status = "authenticated", token = csrf, accountId = "synthetic-account-a") => ({ schemaVersion: 1, status,
  csrfToken: token, accountId: status === "authenticated" ? accountId : null, phoneOtp: "available" });
const product = { productId: "synthetic-theme", displayName: "合成测试商品，不可销售", amountMinor: 600, currency: "CNY", catalogRevision: "test-v1",
  fulfillment: { schemaVersion: 1, kind: "theme", entitlementKey: "theme.synthetic-art.owned", themeId: "synthetic-art", manifestVersion: "test-v1" } };
const catalog = () => ({ schemaVersion: 1, status: "available", checkoutEnabled: true, products: [structuredClone(product)] });
const order = (extra = {}) => ({ orderId: "pc_synthetic", productId: product.productId, amountMinor: 600, currency: "CNY",
  status: "awaiting-user-payment", fulfillmentStatus: "not-requested", revision: 1, createdAtUtc: instant, updatedAtUtc: instant, ...extra });
const snapshot = (extra = {}) => ({ schemaVersion: 1, snapshot: { schemaVersion: 1, authority: "commerce-service-verified",
  accountId: "synthetic-account-a", entitlementRevision: 1, evaluatedAt: instant, entitlements: [], ...extra } });
function payload(current = order(), host = "https://openapi-sandbox.dl.alipaydev.com") {
  const url = new URL(host + "/gateway.do");
  url.searchParams.set("method", "alipay.trade.page.pay"); url.searchParams.set("sign", "SYNTHETIC_NOT_A_REAL_SIGNATURE");
  url.searchParams.set("biz_content", JSON.stringify({ out_trade_no: current.orderId, product_code: "FAST_INSTANT_TRADE_PAY", total_amount: "6.00" }));
  return { schemaVersion: 1, type: "alipay-pc-web", method: "GET", url: url.toString(), expiresAtUtc: new Date(now + 60000).toISOString() };
}
class SerialLocks {
  tail = Promise.resolve();
  names = [];
  request(name, options, action) {
    this.names.push(name);
    const work = this.tail.then(() => {
      if (options.signal?.aborted) throw new Error("aborted");
      return action({ name, mode: "exclusive" });
    });
    this.tail = work.catch(() => undefined);
    return work;
  }
}
function fixture(overrides = {}) {
  const calls = []; const persisted = new Map(); let sequence = 0;
  const state = { session: auth(), handler: null, currentOrder: order(), currentSnapshot: snapshot() };
  const runtime = { origin: "https://planchime.com", locks: new SerialLocks(), now: () => now, canUseDesktopPayment: () => true,
    storage: { getItem: (key) => persisted.get(key) ?? null, setItem: (key, value) => persisted.set(key, value), removeItem: (key) => persisted.delete(key) },
    randomUUID: () => `synthetic-mutation-${++sequence}`, digest: async (value) => createHash("sha256").update(value).digest("hex"),
    fetch: async (url, options) => {
      const path = new URL(url).pathname; const body = options.body === undefined ? null : JSON.parse(options.body);
      calls.push({ url, path, ...options, body });
      const override = await state.handler?.(path, options, body);
      if (override) return override;
      if (path === "/v1/web-auth/session") return json(state.session);
      if (path === "/v1/web-auth/refresh") { state.session = auth(); return json({ schemaVersion: 1, status: "authenticated", accountId: state.session.accountId, csrfToken: csrf }); }
      if (path === "/v1/web-auth/phone/challenges") return json({ schemaVersion: 1, status: "challenge-accepted", challengeId: "synthetic-challenge", expiresAtUtc: new Date(now + 60000).toISOString() });
      if (path === "/v1/web-auth/phone/verify") { state.session = auth("authenticated", rotated); return json({ schemaVersion: 1, status: "authenticated", accountId: state.session.accountId, csrfToken: rotated }); }
      if (path === "/v1/web-auth/logout") { state.session = auth("anonymous"); return json({ schemaVersion: 1, status: "logged-out" }); }
      if (path === "/v1/commerce/catalog") return json(catalog());
      if (path === "/v1/commerce/entitlements") return json(state.currentSnapshot);
      if (path === "/v1/commerce/order-intents/recover") return json({ schemaVersion: 1, status: "not-found" });
      if (path.endsWith("/payment-link")) return json({ schemaVersion: 1, status: "ready", order: state.currentOrder, launchPayload: payload(state.currentOrder) });
      if (path === "/v1/commerce/orders") return json({ schemaVersion: 1, status: "created", order: state.currentOrder, launchPayload: payload(state.currentOrder) }, 201);
      if (path.endsWith("/reconcile")) return json({ schemaVersion: 1, status: "not-settled" });
      if (path === "/v1/commerce/orders/pc_synthetic") return json({ schemaVersion: 1, order: state.currentOrder });
      throw new Error("UNEXPECTED_NETWORK_REQUEST");
    }, ...overrides };
  const config = { mode: "sandbox", apiOrigin: "https://api.planchime.com" };
  const client = new WebPurchaseClient(config, runtime);
  return { client, config, runtime, calls, state, persisted };
}
const confirm = (client, extra = {}) => client.confirmPurchase({ productId: product.productId,
  expectedCatalogRevision: product.catalogRevision, expectedAccountId: "synthetic-account-a", userConfirmed: true, ...extra });
const rejects = (promise, code) => assert.rejects(promise, (error) => error instanceof PurchaseClientError && error.code === code);

// H5 同样使用本机合成服务，不触达支付宝；沿用 PC 订单号以验证渠道不能偷换原单身份。
function h5Payload(current) {
  const launch = payload(current);
  const url = new URL(launch.url);
  url.searchParams.set("method", "alipay.trade.wap.pay");
  url.searchParams.set("biz_content", JSON.stringify({ out_trade_no: current.orderId, product_code: "QUICK_WAP_WAY",
    total_amount: "6.00", quit_url: "https://planchime.com/services/orders/" }));
  return { ...launch, type: "alipay-h5-web", url: url.toString() };
}
function h5Fixture() {
  const f = fixture({ canUseDesktopPayment: () => false, canUseH5Payment: () => true });
  f.state.currentOrder = order({ checkoutVariant: "alipay-h5-web" });
  f.state.handler = async (path, options) => {
    if (path === "/v1/commerce/orders" && options.method === "POST") return json({ schemaVersion: 1, status: "created", order: f.state.currentOrder, launchPayload: h5Payload(f.state.currentOrder) }, 201);
    if (path.endsWith("/payment-link")) return json({ schemaVersion: 1, status: "ready", order: f.state.currentOrder, launchPayload: h5Payload(f.state.currentOrder) });
  };
  return f;
}
const confirmH5 = (client) => confirm(client, { checkoutVariant: "alipay-h5-web" });

test("H5 手机目录与创建选择相同渠道，默认 PC body 保持原契约", async () => {
  const f = h5Fixture(); await f.client.getCatalog("alipay-h5-web");
  const intent = await confirmH5(f.client);
  const result = await f.client.createOrder(intent);
  assert.equal(intent.body.checkoutVariant, "alipay-h5-web");
  assert.equal(result.order.checkoutVariant, "alipay-h5-web");
  assert.equal(new URL(result.paymentDestination).searchParams.get("method"), "alipay.trade.wap.pay");
  assert.ok(f.calls.filter(c => c.path.endsWith("/catalog")).every(c => c.url.endsWith("?checkoutVariant=alipay-h5-web")));
  const pc = fixture(); const pcIntent = await confirm(pc.client, { checkoutVariant: "alipay-pc-web" });
  assert.equal(Object.hasOwn(pcIntent.body, "checkoutVariant"), false);
  assert.ok(pc.calls.filter(c => c.path.endsWith("/catalog")).every(c => !c.url.includes("?")));
});
test("未知或不支持 H5 的设备不能创建订单，生产商品门禁保持关闭", async () => {
  const f = fixture(); await rejects(confirmH5(f.client), "H5_PAYMENT_REQUIRED");
  const h5 = h5Fixture();
  const production = new WebPurchaseClient({ ...h5.config, mode: "production", productionApproved: true }, h5.runtime);
  await rejects(confirmH5(production), "COMMERCE_METADATA_REQUIRED");
  assert.equal(f.calls.length, 0);
  assert.ok(h5.calls.every((c) => c.method === "GET"));
});
test("H5 下单响应丢失，页面重载后仍复用原键原body且不重复调起", async () => {
  const f = h5Fixture(); let requests = 0;
  f.state.handler = async (path) => {
    if (path === "/v1/commerce/orders") {
      if (++requests === 1) throw new Error("lost response");
      return json({ schemaVersion: 1, status: "replayed", order: f.state.currentOrder, launchPayload: h5Payload(f.state.currentOrder) });
    }
  };
  const first = await confirmH5(f.client);
  await rejects(f.client.createOrder(first), "NETWORK_UNAVAILABLE");
  const reopened = new WebPurchaseClient(f.config, f.runtime);
  const restored = await confirmH5(reopened);
  assert.equal(restored.idempotencyKey, first.idempotencyKey); assert.deepEqual(restored.body, first.body);
  assert.equal((await reopened.createOrder(restored)).paymentDestination, null);
  const writes = f.calls.filter(c => c.path === "/v1/commerce/orders");
  assert.deepEqual(writes[0].body, writes[1].body);
  assert.equal(writes[0].headers["Idempotency-Key"], writes[1].headers["Idempotency-Key"]);
});
test("PC/H5 共用原意图，刷新和切换渠道都不能绕过防重购", async () => {
  const f = fixture({ canUseH5Payment: () => true }); await confirm(f.client);
  await rejects(confirmH5(f.client), "RECOVERY_CHANNEL_CHANGED");
  await rejects(confirmH5(new WebPurchaseClient(f.config, f.runtime)), "RECOVERY_CHANNEL_CHANGED");
  assert.equal(f.calls.filter(c => c.path === "/v1/commerce/orders").length, 0);
  assert.equal(f.persisted.size, 1);
});
test("服务器明确关闭旧 PC 原单后才能重新确认 H5 意图", async () => {
  const f = fixture({ canUseH5Payment: () => true }); const old = await confirm(f.client);
  f.state.handler = async path => path.endsWith("/order-intents/recover") ? json({ schemaVersion: 1, status: "found", order: order({ status: "closed" }) }) : null;
  const reopened = new WebPurchaseClient(f.config, f.runtime);
  const next = await confirmH5(reopened);
  assert.notEqual(next.idempotencyKey, old.idempotencyKey); assert.equal(next.body.checkoutVariant, "alipay-h5-web");
  assert.equal(f.calls.filter(c => c.path === "/v1/commerce/orders").length, 0);
});
test("H5 新设备从服务端原单恢复付款，不创建新意图", async () => {
  const f = h5Fixture(); const r = await f.client.recoverPaymentLink("pc_synthetic", "synthetic-account-a", true);
  assert.equal(new URL(r.paymentDestination).searchParams.get("method"), "alipay.trade.wap.pay");
  assert.equal(f.persisted.size, 0);
  assert.equal(f.calls.filter(c => c.path === "/v1/commerce/orders").length, 0);
  assert.deepEqual(f.calls.find(c => c.path.endsWith("/payment-link")).body, { schemaVersion: 1 });
});
test("新设备不能把旧 PC 原单改成 H5，查单和终态展示仍可用", async () => {
  const f = h5Fixture(); f.state.currentOrder = order();
  await rejects(f.client.recoverPaymentLink("pc_synthetic", "synthetic-account-a", true), "DESKTOP_PAYMENT_REQUIRED");
  assert.equal(f.calls.filter(c => c.path.endsWith("/payment-link")).length, 0);
  f.state.currentOrder = order({ status: "settled", fulfillmentStatus: "delivered" });
  const r = await f.client.recoverPaymentLink("pc_synthetic", "synthetic-account-a", true);
  assert.equal(r.status, "already-settled"); assert.equal(r.paymentDestination, null);
});
test("H5 订单响应、继续付款与本机恢复均拒绝渠道偷换", async () => {
  const f = h5Fixture(); const intent = await confirmH5(f.client);
  f.state.currentOrder = order();
  await rejects(f.client.createOrder(intent), "INVALID_RESPONSE");
  f.state.handler = async path => path.endsWith("/order-intents/recover") ? json({ schemaVersion: 1, status: "found", order: order() }) : null;
  await rejects(new WebPurchaseClient(f.config, f.runtime).recoverPurchases("synthetic-account-a"), "RECOVERY_LOG_CHANGED");
  const other = h5Fixture();
  other.state.handler = async path => path.endsWith("/payment-link") ? json({ schemaVersion: 1, status: "ready", order: order(), launchPayload: payload() }) : null;
  await rejects(other.client.recoverPaymentLink("pc_synthetic", "synthetic-account-a", true), "INVALID_RESPONSE");
});
test("H5 原地址校验拒绝 PC 收银台、错误金额和外部退出网址", async () => {
  for (const change of [
    p => ({ ...p, type: "alipay-pc-web" }),
    p => { const u = new URL(p.url); u.searchParams.set("method", "alipay.trade.page.pay"); return { ...p, url: String(u) }; },
    ...[{ product_code: "FAST_INSTANT_TRADE_PAY" }, { total_amount: "0.01" }, { out_trade_no: "other" },
      { quit_url: "https://evil.test" }, { quit_url: "https://planchime.com/services/orders/?paid=1" }].map(extra => p => {
      const u = new URL(p.url); u.searchParams.set("biz_content", JSON.stringify({ ...JSON.parse(u.searchParams.get("biz_content")), ...extra }));
      return { ...p, url: String(u) };
    })
  ]) {
    const f = h5Fixture(); f.state.handler = async path => path.endsWith("/payment-link") ? json({ schemaVersion: 1, status: "ready", order: f.state.currentOrder, launchPayload: change(h5Payload(f.state.currentOrder)) }) : null;
    await rejects(f.client.recoverPaymentLink("pc_synthetic", "synthetic-account-a", true), "PAYMENT_DESTINATION_REJECTED");
  }
});
test("H5 日志不接受未知渠道；原账户日志不能被另一个账户恢复", async () => {
  const f = h5Fixture(); await confirmH5(f.client);
  const [key, raw] = [...f.persisted.entries()][0]; const data = JSON.parse(raw);
  data.entries[0].body.checkoutVariant = "unsupported-pay"; f.persisted.set(key, JSON.stringify(data));
  await rejects(f.client.recoverPurchases("synthetic-account-a"), "RECOVERY_LOG_INVALID");
  f.persisted.set(key, raw); f.state.session = auth("authenticated", csrf, "synthetic-account-b");
  assert.deepEqual(await f.client.recoverPurchases("synthetic-account-b"), []);
});
test("H5 关闭后续付不返回地址，已付订单仍以服务端交付状态为准", async () => {
  const f = h5Fixture(); f.state.handler = async path => path.endsWith("/payment-link") ? json({ schemaVersion: 1, status: "checkout-disabled", order: f.state.currentOrder }) : null;
  const r = await f.client.recoverPaymentLink("pc_synthetic", "synthetic-account-a", true);
  assert.equal(r.paymentDestination, null); assert.equal(r.status, "checkout-disabled");
  assert.equal(orderProgress(parseOrder({ ...f.state.currentOrder, status: "settled", fulfillmentStatus: "pending" })), "paid-delivery-pending");
  assert.throws(() => parseOrder(order({ checkoutVariant: "unsupported-pay" })));
});
test("仅允许固定 H5 目录 GET，不开放任意查询参数或付费开关", async () => {
  const f = fixture(); const transport = new PurchaseTransport(f.config, f.runtime);
  for (const path of ["/v1/commerce/catalog?checkoutVariant=alipay-h5-web&enabled=true", "/v1/commerce/orders?checkoutVariant=alipay-h5-web", "/v1/commerce/catalog?checkoutVariant=alipay-h5-web#ok"]) {
    await rejects(transport.request(path, "commerce"), "INVALID_REQUEST");
  }
  await rejects(transport.request("/v1/commerce/catalog?checkoutVariant=alipay-h5-web", "commerce", { body: {}, csrfToken: csrf }), "INVALID_REQUEST");
  assert.equal(f.calls.length, 0);
});

test("显式关闭和未批准的生产配置不发送请求", async () => {
  const f = fixture();
  await rejects(new WebPurchaseClient({ mode: "disabled" }, f.runtime).getCatalog(), "PURCHASE_DISABLED");
  await rejects(new WebPurchaseClient({ ...f.config, mode: "production" }, f.runtime).getCatalog(), "PURCHASE_DISABLED");
  assert.equal(f.calls.length, 0);
});
test("HTTPS 精确来源校验拒绝外站、端口、路径、凭据和 www 协调分裂", async () => {
  const f = fixture();
  for (const apiOrigin of ["http://api.planchime.com", "https://api.planchime.com.evil.test", "https://api.planchime.com/", "https://u:p@api.planchime.com", "https://api.planchime.com:8443"]) {
    await rejects(new WebPurchaseClient({ ...f.config, apiOrigin }, f.runtime).getCatalog(), "ORIGIN_CONFIGURATION_REQUIRED");
  }
  await rejects(new WebPurchaseClient(f.config, { ...f.runtime, origin: "https://www.planchime.com" }).getCatalog(), "ORIGIN_CONFIGURATION_REQUIRED");
  assert.equal(f.calls.length, 0);
});
test("请求只使用 Cookie、版本头和 no-store，禁止 Bearer 与重定向", async () => {
  const f = fixture(); await f.client.getCatalog(); await f.client.identity.getSession();
  for (const call of f.calls) {
    assert.equal(call.credentials, "include"); assert.equal(call.redirect, "error"); assert.equal(call.cache, "no-store");
    assert.equal(call.headers.Authorization, undefined); assert.equal(call.headers["X-Planchime-Web-Version"], "2026-10-19");
  }
  assert.equal(f.calls[0].headers["X-Appsch-Commerce-Version"], "2026-10-19");
});
test("同标签 single-flight，跨标签只刷新一次并共用锁", async () => {
  const f = fixture(); f.state.session = auth("refresh-required");
  const second = new WebPurchaseClient(f.config, f.runtime);
  const first = f.client.identity.refreshSession();
  assert.equal(first, f.client.identity.refreshSession());
  const result = await Promise.all([first, second.identity.refreshSession()]);
  assert.ok(result.every((item) => item.status === "authenticated"));
  assert.equal(f.calls.filter((call) => call.path.endsWith("/refresh")).length, 1);
  assert.equal(new Set(f.runtime.locks.names).size, 1); assert.equal(f.persisted.size, 0);
});
test("刷新网络结果不明后另一标签复用原 mutation，不持久化令牌", async () => {
  const f = fixture(); f.state.session = auth("refresh-required"); let first = true;
  f.state.handler = async (path) => { if (path.endsWith("/refresh") && first) { first = false; throw new Error("SENSITIVE_TRANSPORT_TEXT"); } };
  await rejects(f.client.identity.refreshSession(), "NETWORK_UNAVAILABLE");
  const saved = [...f.persisted.values()].join("");
  assert.ok(saved.includes("clientMutationId")); assert.ok(!saved.includes(csrf)); assert.ok(!saved.includes("account"));
  await new WebPurchaseClient(f.config, f.runtime).identity.refreshSession();
  const calls = f.calls.filter((call) => call.path.endsWith("/refresh"));
  assert.deepEqual(calls[0].body, calls[1].body); assert.equal(f.persisted.size, 0);
});
test("协调能力缺失时安全关闭，不竞争刷新", async () => {
  const f = fixture({ locks: undefined }); await rejects(f.client.identity.refreshSession(), "SESSION_COORDINATION_UNAVAILABLE");
  assert.equal(f.calls.length, 0);
  const other = fixture({ storage: undefined }); other.state.session = auth("refresh-required");
  await rejects(other.client.identity.refreshSession(), "SESSION_COORDINATION_UNAVAILABLE");
  assert.equal(other.calls.filter((call) => call.method === "POST").length, 0);
});
test("匿名过期会话不续命，刷新不自动延长寿命", async () => {
  const f = fixture(); f.state.session = auth("anonymous");
  assert.equal((await f.client.identity.refreshSession()).status, "anonymous");
  assert.equal(f.calls.filter((call) => call.method === "POST").length, 0);
});
test("短信一次操作去重，结果不明也不自动重发", async () => {
  const f = fixture(); f.state.session = auth("anonymous");
  const input = { clientMutationId: "send-1", phoneNumber: "+12025550123" };
  await Promise.all([f.client.identity.requestPhoneChallenge(input), f.client.identity.requestPhoneChallenge(input)]);
  assert.equal(f.calls.filter((call) => call.path.endsWith("/challenges")).length, 1);
  await rejects(f.client.identity.requestPhoneChallenge({ ...input, phoneNumber: "+12025550124" }), "MUTATION_CONFLICT");
  const other = fixture(); other.state.session = auth("anonymous");
  other.state.handler = async (path) => { if (path.endsWith("/challenges")) throw new Error("lost response"); };
  await rejects(other.client.identity.requestPhoneChallenge(input), "NETWORK_UNAVAILABLE");
  await rejects(other.client.identity.requestPhoneChallenge(input), "NETWORK_UNAVAILABLE");
  assert.equal(other.calls.filter((call) => call.path.endsWith("/challenges")).length, 1);
});
test("未配置短信不会请求供应商；陌生手机号不伪造注册成功", async () => {
  const f = fixture(); f.state.session = { ...auth("anonymous"), phoneOtp: "configuration-required" };
  await rejects(f.client.identity.requestPhoneChallenge({ clientMutationId: "send-1", phoneNumber: "+12025550123" }), "PHONE_LOGIN_NOT_CONFIGURED");
  assert.equal(f.calls.filter((call) => call.method === "POST").length, 0);
  f.state.session = auth("anonymous");
  f.state.handler = async (path) => path.endsWith("/verify") ? json({ schemaVersion: 1, status: "error", code: "TEMPORARILY_UNAVAILABLE" }, 503) : null;
  await rejects(f.client.identity.verifyPhone({ clientMutationId: "verify-1", challengeId: "synthetic-challenge", code: "123456" }), "TEMPORARILY_UNAVAILABLE");
  assert.match(purchaseRecovery(new PurchaseClientError("TEMPORARILY_UNAVAILABLE")).message, /不会自动注册/);
});
test("登录使用轮换后 CSRF，退出后回匿名，不请求同步接口", async () => {
  const f = fixture(); f.state.session = auth("anonymous");
  const session = await f.client.identity.verifyPhone({ clientMutationId: "verify-1", challengeId: "synthetic-challenge", code: "123456" });
  assert.equal(session.csrfToken, rotated);
  await f.client.identity.logout({ clientMutationId: "logout-1" });
  assert.equal(f.calls.find((call) => call.path.endsWith("/logout")).headers["X-Planchime-CSRF"], rotated);
  assert.equal((await f.client.identity.getSession()).status, "anonymous");
  assert.ok(f.calls.every((call) => !call.path.includes("sync")));
});
test("目录空、缺配置、非法价格和免费主题均不可变成可售商品", () => {
  assert.equal(parseCatalog({ ...catalog(), products: [] }).checkoutEnabled, false);
  assert.deepEqual(parseCatalog({ ...catalog(), status: "configuration-required" }).products, []);
  for (const amountMinor of [0, -1, 1.2, "600"]) assert.throws(() => parseCatalog({ ...catalog(), products: [{ ...product, amountMinor }] }));
  assert.throws(() => parseCatalog({ ...catalog(), products: [{ ...product, fulfillment: { ...product.fulfillment, themeId: "sea-salt-island.day", entitlementKey: "theme.sea-salt-island.day.owned" } }] }));
});
test("确认只准备意图；下单不传价格/账号，重复点击 single-flight", async () => {
  const f = fixture(); const intent = await confirm(f.client);
  assert.equal(f.calls.filter((call) => call.method === "POST").length, 0);
  assert.ok(Object.isFrozen(intent) && Object.isFrozen(intent.body));
  const first = f.client.createOrder(intent); assert.equal(first, f.client.createOrder(intent));
  const result = await first; assert.equal(result.status, "created"); assert.ok(result.paymentDestination.includes("alipaydev.com"));
  const call = f.calls.find((call) => call.path === "/v1/commerce/orders");
  assert.deepEqual(Object.keys(call.body).sort(), ["confirmedAtUtc", "expectedCatalogRevision", "productId", "schemaVersion"]);
  assert.equal(call.headers["Idempotency-Key"], intent.idempotencyKey); assert.equal(call.headers["X-Planchime-CSRF"], csrf);
  const retry = await f.client.createOrder(intent); assert.equal(retry.paymentDestination, null);
  assert.equal(f.calls.filter((call) => call.path === "/v1/commerce/orders").length, 1);
});
test("未知下单结果只以原确认内容和键重试，重放不重新调起付款", async () => {
  const f = fixture(); const intent = await confirm(f.client); let fail = true;
  f.state.handler = async (path) => {
    if (path === "/v1/commerce/orders") {
      if (fail) { fail = false; throw new Error("connection lost"); }
      return json({ schemaVersion: 1, status: "replayed", order: order(), launchPayload: payload() });
    }
  };
  await rejects(f.client.createOrder(intent), "NETWORK_UNAVAILABLE");
  assert.equal(await confirm(f.client), intent);
  assert.equal((await f.client.createOrder(intent)).paymentDestination, null);
  const calls = f.calls.filter((call) => call.path === "/v1/commerce/orders");
  assert.deepEqual(calls[0].body, calls[1].body); assert.equal(calls[0].headers["Idempotency-Key"], calls[1].headers["Idempotency-Key"]);
});
test("账号变化、伪造确认和旧目录均不能下单", async () => {
  const f = fixture(); await rejects(confirm(f.client, { userConfirmed: false }), "CONFIRMATION_REQUIRED");
  await rejects(confirm(f.client, { expectedCatalogRevision: "old" }), "COMMERCE_CATALOG_REVISION_CONFLICT");
  const intent = await confirm(f.client); f.state.session = auth("authenticated", csrf, "synthetic-account-b");
  await rejects(f.client.createOrder(intent), "ACCOUNT_CHANGED");
  await rejects(f.client.createOrder({ ...intent }), "CONFIRMATION_REQUIRED");
  assert.equal(f.calls.filter((call) => call.path === "/v1/commerce/orders").length, 0);
});
test("主题或当前会员已拥有时阻止重复购买", async () => {
  const f = fixture(); f.state.currentSnapshot = snapshot({ entitlements: [{ schemaVersion: 1, authority: "commerce-service-verified", entitlementKey: product.fulfillment.entitlementKey,
    productId: product.productId, lifecycleState: "active-non-renewing", accessGranted: true, validUntil: null }] });
  await rejects(confirm(f.client), "COMMERCE_ALREADY_OWNED");
  assert.equal(f.calls.filter((call) => call.method === "POST").length, 0);
});
test("服务端防重购返回原单时只查该单，不创建另一笔", async () => {
  const f = fixture(); const intent = await confirm(f.client);
  f.state.handler = async (path) => path === "/v1/commerce/orders" ? json({ schemaVersion: 1, status: "error", code: "COMMERCE_PURCHASE_IN_PROGRESS", existingOrderId: "pc_synthetic" }, 409) : null;
  await rejects(f.client.createOrder(intent), "COMMERCE_PURCHASE_IN_PROGRESS");
  assert.equal((await f.client.createOrder(intent)).paymentDestination, null);
  assert.equal(f.calls.filter((call) => call.path === "/v1/commerce/orders").length, 1);
});
test("paid 与 delivered 分开；退款撤回和关闭不显示仍拥有", () => {
  assert.equal(orderProgress(parseOrder(order({ status: "settled", fulfillmentStatus: "pending" }))), "paid-delivery-pending");
  assert.equal(orderProgress(parseOrder(order({ status: "settled", fulfillmentStatus: "delivered" }))), "delivered");
  assert.equal(orderProgress(parseOrder(order({ status: "settled", fulfillmentStatus: "revoked" }))), "revoked");
  assert.equal(orderProgress(parseOrder(order({ status: "closed" }))), "closed");
  assert.throws(() => parseOrder(order({ fulfillmentStatus: "delivered" })));
});
test("查单只发送空对象且按归属验证，不接受返回页成功参数", async () => {
  const f = fixture();
  f.state.handler = async (path) => path.endsWith("/reconcile") ? json({ schemaVersion: 1, status: "closed", order: order({ status: "closed" }) }) : null;
  assert.equal((await f.client.reconcileOrder("pc_synthetic", "synthetic-account-a")).status, "closed");
  assert.deepEqual(f.calls.find((call) => call.path.endsWith("/reconcile")).body, {});
  await rejects(f.client.getOrder("pc_synthetic?paid=true", "synthetic-account-a"), "INVALID_RESPONSE");
  assert.ok(f.calls.every((call) => !call.url.includes("paid=")));
});
test("支付URL必须匹配环境、官方主机、原单与金额", async () => {
  for (const mutate of [
    (p) => ({ ...p, url: p.url.replace("openapi-sandbox.dl.alipaydev.com", "evil.test") }),
    (p) => ({ ...p, url: p.url.replace("openapi-sandbox.dl.alipaydev.com", "openapi.alipay.com") }),
    (p) => ({ ...p, expiresAtUtc: instant }),
    (p) => ({ ...p, url: p.url.replace("pc_synthetic", "pc_other") }),
  ]) {
    const f = fixture(); const intent = await confirm(f.client);
    f.state.handler = async (path) => path === "/v1/commerce/orders" ? json({ schemaVersion: 1, status: "created", order: order(), launchPayload: mutate(payload()) }, 201) : null;
    await rejects(f.client.createOrder(intent), "PAYMENT_DESTINATION_REJECTED");
  }
});
test("响应 HTML、错误正文和网络错误不会泄漏到恢复文案", async () => {
  const f = fixture(); f.state.handler = async () => new Response("SECRET", { headers: { "content-type": "text/html" } });
  await rejects(f.client.getCatalog(), "INVALID_RESPONSE");
  f.state.handler = async () => { throw new Error("TOKEN_AND_PHONE"); };
  await assert.rejects(f.client.getCatalog(), (error) => !String(error).includes("TOKEN_AND_PHONE"));
});
test("权益必须属于当前账号，旧修订不能覆盖新快照", async () => {
  const f = fixture(); await f.client.getEntitlements();
  f.state.currentSnapshot = snapshot({ entitlementRevision: 0 });
  await rejects(f.client.getEntitlements(), "ENTITLEMENT_REVISION_CONFLICT");
  f.state.currentSnapshot = snapshot({ accountId: "synthetic-account-b" });
  await rejects(f.client.getEntitlements(), "INVALID_RESPONSE");
});

test("HTTP 200 order-closed 释放原购买锁，但必须再次明确确认才产生新意图", async () => {
  const f = fixture(); const original = await confirm(f.client);
  f.state.handler = async (path) => path === "/v1/commerce/orders"
    ? json({ schemaVersion: 1, status: "order-closed", order: order({ status: "closed" }) }) : null;
  const result = await f.client.createOrder(original);
  assert.equal(result.status, "order-closed"); assert.equal(result.paymentDestination, null);
  assert.equal(f.calls.filter((call) => call.path === "/v1/commerce/orders").length, 1);
  const next = await confirm(f.client);
  assert.notEqual(next.idempotencyKey, original.idempotencyKey);
  assert.equal(f.calls.filter((call) => call.path === "/v1/commerce/orders").length, 1);
});
test("只有查到同一原单已关闭才释放锁，本地过期或其他订单关闭都不能代替", async () => {
  for (const via of ["get", "reconcile"]) {
    const f = fixture(); const original = await confirm(f.client); await f.client.createOrder(original);
    f.runtime.now = () => now + 86400000;
    await rejects(confirm(f.client), "COMMERCE_PURCHASE_IN_PROGRESS");
    f.state.handler = async (path) => path.endsWith("/pc_other")
      ? json({ schemaVersion: 1, order: order({ orderId: "pc_other", status: "closed" }) }) : null;
    await f.client.getOrder("pc_other", "synthetic-account-a");
    await rejects(confirm(f.client), "COMMERCE_PURCHASE_IN_PROGRESS");
    f.state.currentOrder = order({ status: "closed", revision: 2 });
    if (via === "get") await f.client.getOrder("pc_synthetic", "synthetic-account-a");
    else {
      f.state.handler = async (path) => path.endsWith("/reconcile")
        ? json({ schemaVersion: 1, status: "closed", order: f.state.currentOrder }) : null;
      await f.client.reconcileOrder("pc_synthetic", "synthetic-account-a");
    }
    const next = await confirm(f.client); assert.notEqual(next.idempotencyKey, original.idempotencyKey);
    await f.client.createOrder(original); // 旧意图只允许查旧单，不能清掉新的确认。
    assert.equal(await confirm(f.client), next);
  }
});
test("丢失响应后的 replayed 不自动支付，明确继续才以同键同内容恢复原单地址", async () => {
  const f = fixture(); const intent = await confirm(f.client); let lost = true;
  f.state.handler = async (path) => {
    if (path !== "/v1/commerce/orders") return null;
    if (lost) { lost = false; throw new Error("synthetic lost response"); }
    return json({ schemaVersion: 1, status: "replayed", order: order(), launchPayload: payload() });
  };
  await rejects(f.client.createOrder(intent), "NETWORK_UNAVAILABLE");
  assert.equal((await f.client.createOrder(intent)).paymentDestination, null);
  await rejects(f.client.continuePayment(intent, { expectedOrderId: "pc_synthetic", userConfirmed: false }), "CONFIRMATION_REQUIRED");
  const first = f.client.continuePayment(intent, { expectedOrderId: "pc_synthetic", userConfirmed: true });
  assert.equal(first, f.client.continuePayment(intent, { expectedOrderId: "pc_synthetic", userConfirmed: true }));
  const continued = await first; assert.equal(continued.status, "replayed"); assert.equal(continued.paymentDestination, payload().url);
  const writes = f.calls.filter((call) => call.path === "/v1/commerce/orders");
  assert.equal(writes.length, 2);
  assert.deepEqual(f.calls.find((call) => call.path.endsWith("/payment-link")).body, { schemaVersion: 1 });
  assert.ok(writes.every((call) => call.headers["Idempotency-Key"] === intent.idempotencyKey));
  assert.ok(writes.every((call) => JSON.stringify(call.body) === JSON.stringify(intent.body)));
});
test("继续支付拒绝换单、过期地址和非官方网关，不放行新购买", async () => {
  for (const mutate of [
    () => ({ schemaVersion: 1, status: "ready", order: order({ orderId: "pc_other" }), launchPayload: payload(order({ orderId: "pc_other" })) }),
    () => ({ schemaVersion: 1, status: "ready", order: order(), launchPayload: { ...payload(), expiresAtUtc: instant } }),
    () => ({ schemaVersion: 1, status: "ready", order: order(), launchPayload: payload(order(), "https://evil.test") }),
  ]) {
    const f = fixture(); const intent = await confirm(f.client); await f.client.createOrder(intent);
    f.state.handler = async (path) => path.endsWith("/payment-link") ? json(mutate()) : null;
    await assert.rejects(f.client.continuePayment(intent, { expectedOrderId: "pc_synthetic", userConfirmed: true }), PurchaseClientError);
    await rejects(confirm(f.client), "COMMERCE_PURCHASE_IN_PROGRESS");
  }
});
test("原单已付、待核验或关闭时，继续支付只返回状态，不再次请求支付地址", async () => {
  for (const status of ["settled", "provider-query-required", "closed"]) {
    const f = fixture(); const intent = await confirm(f.client); await f.client.createOrder(intent);
    f.state.currentOrder = order({ status, revision: 2, fulfillmentStatus: status === "settled" ? "pending" : "not-requested" });
    const result = await f.client.continuePayment(intent, { expectedOrderId: "pc_synthetic", userConfirmed: true });
    assert.equal(result.paymentDestination, null); assert.equal(result.order.status, status);
    assert.equal(f.calls.filter((call) => call.path === "/v1/commerce/orders").length, 1);
  }
});
test("当前有效固定期限会员阻止重购，退款撤回不显示仍拥有", async () => {
  const f = fixture();
  const membership = { ...product, productId: "synthetic-membership", amountMinor: 1200, fulfillment: { schemaVersion: 1,
    kind: "fixed-term-membership", entitlementKey: "pro.core", durationSeconds: 2592000, startsAt: "first-delivery", autoRenews: false,
    benefitManifest: { version: "synthetic-v1", capabilityKeys: ["pro.ai.text-parsing"] } } };
  f.state.handler = async (path) => path.endsWith("/catalog") ? json({ ...catalog(), products: [membership] }) : null;
  f.state.currentSnapshot = snapshot({ entitlements: [{ schemaVersion: 1, authority: "commerce-service-verified", entitlementKey: "pro.core",
    productId: membership.productId, lifecycleState: "active-fixed-term", accessGranted: true, validUntil: new Date(now + 2592000000).toISOString() }] });
  await rejects(confirm(f.client, { productId: membership.productId }), "COMMERCE_ALREADY_OWNED");
  f.state.currentSnapshot.snapshot.entitlementRevision = 2;
  f.state.currentSnapshot.snapshot.entitlements[0] = { ...f.state.currentSnapshot.snapshot.entitlements[0], lifecycleState: "revoked", accessGranted: false };
  assert.equal((await f.client.getEntitlements()).entitlements[0].accessGranted, false);
  assert.equal(f.calls.filter((call) => call.method === "POST").length, 0);
});

test("订单同 revision 支持延后发放和退款撤权，但拒绝交付状态倒退或付款字段冲突", async () => {
  const f = fixture(); const intent = await confirm(f.client); await f.client.createOrder(intent);
  f.state.currentOrder = order({ status: "settled", revision: 2, fulfillmentStatus: "pending" });
  assert.equal(orderProgress(await f.client.getOrder("pc_synthetic", "synthetic-account-a")), "paid-delivery-pending");
  f.state.currentOrder = { ...f.state.currentOrder, fulfillmentStatus: "delivered" };
  assert.equal(orderProgress(await f.client.getOrder("pc_synthetic", "synthetic-account-a")), "delivered");
  f.state.currentOrder = { ...f.state.currentOrder, fulfillmentStatus: "revoked" };
  assert.equal(orderProgress(await f.client.getOrder("pc_synthetic", "synthetic-account-a")), "revoked");
  f.state.currentOrder = { ...f.state.currentOrder, fulfillmentStatus: "delivered" };
  await rejects(f.client.getOrder("pc_synthetic", "synthetic-account-a"), "INVALID_RESPONSE");
  f.state.currentOrder = { ...f.state.currentOrder, fulfillmentStatus: "revoked", updatedAtUtc: new Date(now + 1000).toISOString() };
  await rejects(f.client.getOrder("pc_synthetic", "synthetic-account-a"), "INVALID_RESPONSE");
});
test("订单写入超时结果保持未知，不自动重试", async () => {
  const f = fixture(); const client = new WebPurchaseClient({ ...f.config, timeoutMilliseconds: 100 }, f.runtime);
  const intent = await confirm(client);
  f.state.handler = async (path, options) => path === "/v1/commerce/orders"
    ? new Promise((resolve, reject) => options.signal.addEventListener("abort", () => reject(new Error("synthetic abort")), { once: true })) : null;
  await assert.rejects(client.createOrder(intent), (error) => error.code === "REQUEST_TIMEOUT" && error.outcome === "unknown");
  assert.equal(f.calls.filter((call) => call.path === "/v1/commerce/orders").length, 1);
  assert.equal(await confirm(client), intent);
});
test("重载不恢复内存购买意图，只能查服务器原单，不能伪造继续付款确认", async () => {
  const f = fixture(); const intent = await confirm(f.client); await f.client.createOrder(intent);
  const reloaded = new WebPurchaseClient(f.config, f.runtime);
  await rejects(reloaded.continuePayment(intent, { expectedOrderId: "pc_synthetic", userConfirmed: true }), "CONFIRMATION_REQUIRED");
  assert.equal((await reloaded.getOrder("pc_synthetic", "synthetic-account-a")).orderId, "pc_synthetic");
  assert.equal(f.calls.filter((call) => call.path === "/v1/commerce/orders").length, 1);
});

test("后台变价明确拒绝且未创建订单后，可以重新确认新目录，旧意图永久失效", async () => {
  const f = fixture(); const old = await confirm(f.client);
  f.state.handler = async (path) => {
    if (path === "/v1/commerce/orders") return json({ schemaVersion: 1, status: "error", code: "COMMERCE_CATALOG_REVISION_CONFLICT" }, 409);
  };
  await rejects(f.client.createOrder(old), "COMMERCE_CATALOG_REVISION_CONFLICT");
  f.state.handler = async (path) => path === "/v1/commerce/catalog" ? json({ ...catalog(), products: [{ ...product, catalogRevision: "test-v2", amountMinor: 800 }] }) : null;
  const before = f.calls.length;
  await rejects(f.client.createOrder(old), "PURCHASE_RECONFIRMATION_REQUIRED");
  assert.equal(f.calls.length, before);
  await rejects(confirm(f.client), "COMMERCE_CATALOG_REVISION_CONFLICT");
  const fresh = await confirm(f.client, { expectedCatalogRevision: "test-v2" });
  assert.equal(fresh.product.amountMinor, 800); assert.notEqual(fresh.idempotencyKey, old.idempotencyKey);
  assert.deepEqual(f.calls.slice(-3).map((call) => call.path), ["/v1/web-auth/session", "/v1/commerce/catalog", "/v1/commerce/entitlements"]);
  assert.equal(f.calls.filter((call) => call.path === "/v1/commerce/orders").length, 1);
});
test("幂等冲突或带有原单的目录拒绝不允许解除旧意图", async () => {
  for (const error of [
    { code: "COMMERCE_IDEMPOTENCY_CONFLICT" },
    { code: "COMMERCE_CATALOG_REVISION_CONFLICT", existingOrderId: "pc_synthetic" },
  ]) {
    const f = fixture(); const intent = await confirm(f.client);
    f.state.handler = async (path) => path === "/v1/commerce/orders" ? json({ schemaVersion: 1, status: "error", ...error }, 409) : null;
    await rejects(f.client.createOrder(intent), error.code);
    await rejects(confirm(f.client, { expectedCatalogRevision: "test-v2" }), "COMMERCE_PURCHASE_IN_PROGRESS");
    assert.equal(f.calls.filter((call) => call.path === "/v1/commerce/orders").length, 1);
  }
});

test("R4 新实例/响应丢失按原意图恢复，加载不创建、不取付款地址", async () => {
  const f = fixture(); const intent = await confirm(f.client);
  f.state.handler = async (path) => { if (path === "/v1/commerce/orders") throw new Error("lost"); };
  await rejects(f.client.createOrder(intent), "NETWORK_UNAVAILABLE");
  f.state.handler = async (path) => path.endsWith("/recover") ? json({ schemaVersion: 1, status: "found", order: order() }) : null;
  const client = new WebPurchaseClient(f.config, f.runtime), before = f.calls.length;
  const result = await client.recoverPurchases("synthetic-account-a");
  assert.equal(result[0].order.orderId, "pc_synthetic");
  assert.equal(result[0].entry.idempotencyKey, intent.idempotencyKey);
  assert.ok(f.calls.slice(before).every((call) => !["/v1/commerce/orders", "/v1/web-auth/phone/challenges"].includes(call.path) && !call.path.endsWith("/payment-link")));
  const saved = [...f.persisted.values()].join("");
  for (const secret of [csrf, "synthetic-account-a", "sign", "+1202", "launchPayload", "gateway.do"]) assert.ok(!saved.includes(secret));
});
test("R4 not-found 不释放在途意图，跨实例明确重试同键同body", async () => {
  const f = fixture(); const original = await confirm(f.client);
  f.state.handler = async (path) => { if (path === "/v1/commerce/orders") throw new Error("inflight"); };
  await rejects(f.client.createOrder(original), "NETWORK_UNAVAILABLE");
  const next = new WebPurchaseClient(f.config, f.runtime);
  assert.equal((await next.recoverPurchases("synthetic-account-a"))[0].order, null);
  const retry = await confirm(next); assert.equal(retry.idempotencyKey, original.idempotencyKey); assert.deepEqual(retry.body, original.body);
  f.state.handler = null; await next.createOrder(retry);
  const writes = f.calls.filter((call) => call.path === "/v1/commerce/orders");
  assert.equal(writes.length, 2); assert.deepEqual(writes[0].body, writes[1].body); assert.equal(writes[0].headers["Idempotency-Key"], writes[1].headers["Idempotency-Key"]);
});
test("R4 两个标签独立内存状态使用同一日志与锁，只创建一单", async () => {
  const f = fixture(), second = new WebPurchaseClient(f.config, f.runtime);
  const [one, two] = await Promise.all([confirm(f.client), confirm(second)]);
  assert.equal(one.idempotencyKey, two.idempotencyKey);
  const results = await Promise.all([f.client.createOrder(one), second.createOrder(two)]);
  assert.equal(f.calls.filter((call) => call.path === "/v1/commerce/orders").length, 1);
  assert.equal(results[1].paymentDestination, null);
});
test("R4 无存储/静默丢写/配额失败在创建前全部阻断", async () => {
  for (const storage of [undefined, { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    { getItem: () => null, setItem: () => { throw new Error("quota"); }, removeItem: () => {} }]) {
    const f = fixture({ storage }); await rejects(confirm(f.client), "RECOVERY_STORAGE_UNAVAILABLE");
    assert.equal(f.calls.filter((call) => call.method === "POST").length, 0);
  }
});
test("R4 创建成功后本机更新失败保留原单事实，不谎报未发送", async () => {
  const f = fixture(); const intent = await confirm(f.client);
  f.state.handler = async (path) => { if (path === "/v1/commerce/orders") f.runtime.storage.setItem = () => { throw new Error("quota after create"); }; };
  await assert.rejects(f.client.createOrder(intent), (error) => error.code === "RECOVERY_RECORD_UPDATE_FAILED" && error.outcome === "unknown" && error.existingOrderId === "pc_synthetic");
  assert.match(purchaseRecovery(new PurchaseClientError("RECOVERY_RECORD_UPDATE_FAILED")).message, /订单已存在/);
  f.state.handler = async (path, options) => path === "/v1/commerce/orders" && options.method === "GET" ? json({ schemaVersion: 1, orders: [order()], hasMore: false }) : null;
  assert.equal((await f.client.listOrders("synthetic-account-a")).orders[0].orderId, "pc_synthetic");
  assert.equal(f.calls.filter((call) => call.path === "/v1/commerce/orders" && call.method === "POST").length, 1);
});
test("R4 日志严格校验/过期/篡改金额时拒绝续购，仍可服务端查单", async () => {
  for (const mutate of [
    () => "{bad", (data) => JSON.stringify({ ...data, token: "not-allowed" }),
    (data) => { data.entries[0].accountDigest = "f".repeat(64); return JSON.stringify(data); },
    (data) => { data.entries[0].createdAtUtc = "2020-01-01T00:00:00.000Z"; return JSON.stringify(data); },
  ]) {
    const f = fixture(); await confirm(f.client); const key = [...f.persisted.keys()][0]; f.persisted.set(key, mutate(JSON.parse(f.persisted.get(key))));
    const fresh = new WebPurchaseClient(f.config, f.runtime); await rejects(fresh.recoverPurchases("synthetic-account-a"), "RECOVERY_LOG_INVALID");
    f.state.handler = async (path, options) => path === "/v1/commerce/orders" && options.method === "GET" ? json({ schemaVersion: 1, orders: [order()], hasMore: false }) : null;
    assert.equal((await fresh.listOrders("synthetic-account-a")).orders.length, 1);
  }
  const f = fixture(); await confirm(f.client); const key = [...f.persisted.keys()][0], data = JSON.parse(f.persisted.get(key));
  data.entries[0].amountMinor = 1; f.persisted.set(key, JSON.stringify(data));
  f.state.handler = async (path) => path.endsWith("/recover") ? json({ schemaVersion: 1, status: "found", order: order() }) : null;
  await rejects(new WebPurchaseClient(f.config, f.runtime).recoverPurchases("synthetic-account-a"), "RECOVERY_LOG_CHANGED");
});
test("R4 价格变化与停卖不会发送创建 POST，也不替换旧意图", async () => {
  for (const changed of [{ ...catalog(), checkoutEnabled: false }, { ...catalog(), products: [{ ...product, amountMinor: 800 }] }]) {
    const f = fixture(); const intent = await confirm(f.client); const before = [...f.persisted.values()];
    f.state.handler = async (path) => path.endsWith("/catalog") ? json(changed) : null;
    await assert.rejects(f.client.createOrder(intent), PurchaseClientError);
    assert.deepEqual([...f.persisted.values()], before); assert.equal(f.calls.filter((call) => call.path === "/v1/commerce/orders").length, 0);
  }
});
test("R4 账号变化不读前账号日志，不删除其他存储", async () => {
  const f = fixture(); await confirm(f.client); f.persisted.set("unrelated", "keep");
  f.state.session = auth("authenticated", csrf, "synthetic-account-b");
  assert.deepEqual(await new WebPurchaseClient(f.config, f.runtime).recoverPurchases("synthetic-account-b"), []);
  await rejects(f.client.listOrders("synthetic-account-a"), "ACCOUNT_CHANGED");
  assert.equal(f.persisted.size, 2); assert.equal(f.persisted.get("unrelated"), "keep");
});
test("R4 手机/未知设备确认与创建都拒绝，不仅隐藏付款按钮", async () => {
  const f = fixture(); const intent = await confirm(f.client), before = f.calls.length;
  f.runtime.canUseDesktopPayment = () => false;
  await rejects(confirm(f.client), "DESKTOP_PAYMENT_REQUIRED"); await rejects(f.client.createOrder(intent), "DESKTOP_PAYMENT_REQUIRED");
  assert.equal(f.calls.length, before);
  const production = new WebPurchaseClient({ mode: "production", productionApproved: true, apiOrigin: f.config.apiOrigin }, f.runtime);
  await rejects(confirm(production), "DESKTOP_PAYMENT_REQUIRED");
});
test("R4 只有 ready 可包含原付款地址；过期、已付、撤权、关闭和停卖均无地址", async () => {
  for (const status of ["ready", "already-settled", "order-closed", "order-revoked", "checkout-disabled", "provider-query-required"]) {
    const f = fixture();
    const resultOrder = order({ status: status === "already-settled" || status === "order-revoked" ? "settled" : status === "order-closed" ? "closed" : "awaiting-user-payment",
      fulfillmentStatus: status === "order-revoked" ? "revoked" : status === "already-settled" ? "pending" : "not-requested", revision: 2 });
    f.state.handler = async (path) => path.endsWith("/payment-link") ? json({ schemaVersion: 1, status, order: resultOrder,
      ...(status === "ready" ? { launchPayload: payload() } : { reason: "expired" }) }) : null;
    const result = await f.client.recoverPaymentLink("pc_synthetic", "synthetic-account-a", true);
    assert.equal(result.paymentDestination !== null, status === "ready");
    assert.equal(f.calls.filter((call) => call.path === "/v1/commerce/orders").length, 0);
    if (status !== "ready") {
      f.state.handler = async (path) => path.endsWith("/payment-link") ? json({ schemaVersion: 1, status, order: resultOrder, launchPayload: payload() }) : null;
      await rejects(f.client.recoverPaymentLink("pc_synthetic", "synthetic-account-a", true), "INVALID_RESPONSE");
    }
  }
});

// 仅合成配置，用于检验说明与订单修订绑定，不代表正式商品或退款条款获批。
const syntheticDisclosure = { schemaVersion: 1, merchantName: "米堆（南京）网络科技有限公司",
  deliverySummary: "合成测试：发放主题权益，不可销售。", exclusions: ["不包含会员或 AI 额度"],
  compatibility: [{ platform: "android", minimumVersion: "0.0.0-synthetic" }],
  refundPolicy: { version: "synthetic-v1", summary: "仅合成测试，不构成退款承诺。", url: "https://planchime.com/services/purchase-info/" },
  saleReady: true, fulfillmentReady: true };
const disclosedProduct = (disclosure = syntheticDisclosure) => ({ ...product, disclosure,
  catalogRevision: createHash("sha256").update(disclosureRevisionInput(product, disclosure)).digest("hex") });
test("生产购买需要说明完整且绑定修订，显式关闭仍不可发起请求", async () => {
  const f = fixture(); const p = disclosedProduct();
  f.state.handler = async (path) => path.endsWith("/catalog") ? json({ ...catalog(), products: [p] }) : undefined;
  const client = new WebPurchaseClient({ ...f.config, mode: "production", productionApproved: true }, f.runtime);
  const intent = await confirm(client, { expectedCatalogRevision: p.catalogRevision });
  assert.equal(intent.product.disclosure.merchantName, syntheticDisclosure.merchantName);
  assert.ok(f.calls.every(c => c.path !== "/v1/commerce/orders"));
  await rejects(new WebPurchaseClient({ mode: "disabled" }, f.runtime).getCatalog(), "PURCHASE_DISABLED");
});
test("更换退款、价格或交付说明而复用修订会拒绝，缺说明不能启售", async () => {
  for (const changed of [{ amountMinor: 700 }, { disclosure: { ...syntheticDisclosure, deliverySummary: "已变更" } },
    { disclosure: { ...syntheticDisclosure, refundPolicy: { ...syntheticDisclosure.refundPolicy, summary: "已变更" } } }]) {
    const f = fixture(), p = { ...disclosedProduct(), ...changed };
    f.state.handler = async path => path.endsWith("/catalog") ? json({ ...catalog(), products: [p] }) : undefined;
    await rejects(f.client.getCatalog(), "COMMERCE_CATALOG_REVISION_CONFLICT");
    assert.equal(f.calls.filter(c => c.method === "POST").length, 0);
  }
  const f = fixture(), p = disclosedProduct({ ...syntheticDisclosure, fulfillmentReady: false });
  f.state.handler = async path => path.endsWith("/catalog") ? json({ ...catalog(), products: [p] }) : undefined;
  await rejects(confirm(f.client, { expectedCatalogRevision: p.catalogRevision }), "COMMERCE_METADATA_REQUIRED");
});
test("修改商品说明后原确认不会创建订单，必须再次确认新修订", async () => {
  const f = fixture(); let p = disclosedProduct();
  f.state.handler = async path => path.endsWith("/catalog") ? json({ ...catalog(), products: [p] }) : undefined;
  const intent = await confirm(f.client, { expectedCatalogRevision: p.catalogRevision });
  p = disclosedProduct({ ...syntheticDisclosure, refundPolicy: { ...syntheticDisclosure.refundPolicy, version: "synthetic-v2" } });
  await rejects(f.client.createOrder(intent), "RECOVERY_PRICE_CHANGED");
  assert.equal(f.calls.filter(c => c.path === "/v1/commerce/orders" && c.method === "POST").length, 0);
});
test("商品说明拒绝另一主体、未说明版本和外部退款跳转", () => {
  for (const disclosure of [{ ...syntheticDisclosure, merchantName: "另一家公司" },
    { ...syntheticDisclosure, compatibility: [] },
    { ...syntheticDisclosure, refundPolicy: { ...syntheticDisclosure.refundPolicy, url: "https://attacker.invalid/" } }]) {
    assert.throws(() => parseCatalog({ ...catalog(), products: [disclosedProduct(disclosure)] }));
  }
});
