import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { WebPurchaseClient } from "../app/lib/purchase/commerce.ts";
import { PurchaseClientError } from "../app/lib/purchase/protocol.ts";
import { PurchaseTransport, purchaseConfiguration } from "../app/lib/purchase/transport.ts";

// 只使用内存替身；任何意外请求都记录并断言，不连接正式目录、登录或支付接口。
function fixture(overrides = {}) {
  const calls = [];
  const runtime = { origin: "https://planchime.com", now: () => Date.now(),
    randomUUID: () => "synthetic-read-only", digest: async (value) => createHash("sha256").update(value).digest("hex"),
    locks: { request: async (_name, _options, action) => action() },
    storage: { getItem() { throw new Error("storage must remain unused"); }, setItem() { throw new Error("storage must remain unused"); }, removeItem() { throw new Error("storage must remain unused"); } },
    fetch: async (url, options) => {
      calls.push({ url, ...options });
      return new Response(JSON.stringify({ schemaVersion: 1, status: "configuration-required", checkoutEnabled: false, products: [] }),
        { status: 200, headers: { "content-type": "application/json" } });
    }, ...overrides };
  return { calls, runtime, client: new WebPurchaseClient(undefined, runtime), transport: new PurchaseTransport(undefined, runtime) };
}
const rejects = (work, code) => assert.rejects(work, (error) => error instanceof PurchaseClientError && error.code === code);

test("默认售前配置只连接支付宝两条公开目录，不携带Cookie或启用微信", async () => {
  const { client, calls } = fixture();
  assert.equal(client.isPrelaunch, true);
  assert.deepEqual(purchaseConfiguration, { mode: "prelaunch", apiOrigin: "https://api.planchime.com", wechatWebConfigured: false });
  const results = await Promise.all([client.getCatalog("alipay-pc-web"), client.getCatalog("alipay-h5-web")]);
  assert.ok(results.every((result) => result.checkoutEnabled === false && result.products.length === 0));
  assert.deepEqual(calls.map((call) => call.url), ["https://api.planchime.com/v1/commerce/catalog", "https://api.planchime.com/v1/commerce/catalog?checkoutVariant=alipay-h5-web"]);
  for (const call of calls) {
    assert.equal(call.method, "GET"); assert.equal(call.credentials, "omit"); assert.equal(call.cache, "no-store");
    assert.equal(call.redirect, "error"); assert.equal(call.body, undefined);
    assert.equal(call.headers["X-Planchime-CSRF"], undefined); assert.equal(call.headers.Authorization, undefined);
    assert.deepEqual(call.headers, { Accept: "application/json", "X-Appsch-Commerce-Version": "2026-10-19" });
  }
});

test("售前GET生成的OPTIONS预检与readiness目录严格请求头契约一致", async () => {
  const { client, calls, runtime } = fixture();
  await Promise.all([client.getCatalog("alipay-pc-web"), client.getCatalog("alipay-h5-web")]);
  for (const call of calls) {
    // 对应后端 readiness-runtime 的允许列表；浏览器只把非安全列表头加入预检，Accept 不在其中。
    const requestedHeaders = Object.keys(call.headers).map((name) => name.toLowerCase()).filter((name) => name !== "accept").sort().join(",");
    const preflight = new Request(call.url, { method: "OPTIONS", credentials: "omit", headers: {
      Origin: runtime.origin, "Access-Control-Request-Method": call.method, "Access-Control-Request-Headers": requestedHeaders,
    } });
    assert.equal(preflight.method, "OPTIONS"); assert.equal(preflight.credentials, "omit");
    assert.equal(preflight.headers.get("origin"), "https://planchime.com");
    assert.equal(preflight.headers.get("access-control-request-method"), "GET");
    assert.equal(preflight.headers.get("access-control-request-headers"), "x-appsch-commerce-version");
    assert.equal(preflight.url, call.url); // H5 预检必须保留原查询串，不能只测试 PC 路径。
  }
});

test("售前传输层拒绝登录、短信、创单、续付、查询私有订单及微信端点", async () => {
  const { transport, client, calls } = fixture();
  const blocked = [
    ["/v1/web-auth/session", "identity", {}],
    ["/v1/web-auth/phone/challenges", "identity", { body: {} }],
    ["/v1/web-auth/phone/verify", "identity", { body: {} }],
    ["/v1/web-auth/refresh", "identity", { body: {} }],
    ["/v1/web-auth/logout", "identity", { body: {} }],
    ["/v1/commerce/orders", "commerce", {}],
    ["/v1/commerce/orders", "commerce", { body: {} }],
    ["/v1/commerce/orders/synthetic/payment-link", "commerce", { body: { schemaVersion: 1 } }],
    ["/v1/commerce/orders/synthetic/reconcile", "commerce", { body: {} }],
    ["/v1/commerce/order-intents/recover", "commerce", { body: {} }],
    ["/v1/commerce/entitlements", "commerce", {}],
    ["/v1/commerce/wechat/catalog", "commerce", {}],
    ["/v1/commerce/catalog", "commerce", { body: {} }],
    ["/v1/commerce/catalog", "commerce", { idempotencyKey: "synthetic-no-send" }],
    ["/v1/commerce/catalog", "commerce", { csrfToken: "a".repeat(64) }],
    ["/v1/commerce/catalog?checkoutVariant=alipay-h5-web", "commerce", { body: {} }],
    ["/v1/commerce/catalog?checkoutVariant=alipay-h5-web&enabled=true", "commerce", {}],
  ];
  for (const [path, family, options] of blocked) await rejects(transport.request(path, family, options), "PURCHASE_READ_ONLY");
  await rejects(client.identity.getSession(), "PURCHASE_READ_ONLY");
  await rejects(client.listOrders("synthetic-account"), "PURCHASE_READ_ONLY");
  assert.equal(calls.length, 0);
});

test("售前也必须使用精确HTTPS主站和API来源，配置错误不发网络请求", async () => {
  const { runtime, calls } = fixture();
  for (const apiOrigin of ["http://api.planchime.com", "https://api.planchime.com.evil.test", "https://api.planchime.com/", "https://api.planchime.com:8443", "https://u:p@api.planchime.com"]) {
    await rejects(new WebPurchaseClient({ ...purchaseConfiguration, apiOrigin }, runtime).getCatalog(), "ORIGIN_CONFIGURATION_REQUIRED");
  }
  await rejects(new WebPurchaseClient(undefined, { ...runtime, origin: "https://www.planchime.com" }).getCatalog(), "ORIGIN_CONFIGURATION_REQUIRED");
  assert.equal(calls.length, 0);
});
