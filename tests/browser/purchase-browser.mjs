import { createHash } from "node:crypto";
import { disclosureRevisionInput } from "../../app/lib/purchase/disclosure.ts";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "/Users/xiao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";

// 真 Chrome + 真 React 组件 + 真 localStorage/Web Locks。所有支付/短信接口完全拦截，无真实外呼。
const qaOrigin = process.env.PLANCHIME_QA_BASE ?? "http://127.0.0.1:4192";
if (!/^http:\/\/127\.0\.0\.1:\d+$/u.test(qaOrigin)) throw new Error("local QA origin required");
const base = `${qaOrigin}/tests/browser/purchase-harness.html`;
const evidence = process.env.PLANCHIME_QA_OUTPUT ?? "/private/tmp/pay-r4-browser";
await mkdir(evidence, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = [];
const measurements = [];
let outside = 0;
const instant = new Date().toISOString(), csrf = "a".repeat(64);
const product = { productId: "synthetic-theme", displayName: "合成商品，不可销售", amountMinor: 600, currency: "CNY", catalogRevision: "synthetic-v1",
  fulfillment: { schemaVersion: 1, kind: "theme", entitlementKey: "theme.synthetic-art.owned", themeId: "synthetic-art", manifestVersion: "synthetic-v1" } };
const disclosure = { schemaVersion: 1, merchantName: "米堆（南京）网络科技有限公司", deliverySummary: "合成主题交付测试，不可销售。",
  exclusions: ["不包含会员及 AI 额度"], compatibility: [{ platform: "android", minimumVersion: "0.0.0-synthetic" }],
  refundPolicy: { version: "synthetic-v1", summary: "合成测试说明，不构成退款承诺。", url: "https://planchime.com/services/purchase-info/" }, saleReady: true, fulfillmentReady: true };
const disclosed = { ...product, disclosure, catalogRevision: createHash("sha256").update(disclosureRevisionInput(product, disclosure)).digest("hex") };
const order = (extra = {}) => ({ orderId: "pc_synthetic_browser", productId: "synthetic-theme", amountMinor: 600, currency: "CNY", status: "awaiting-user-payment", fulfillmentStatus: "not-requested", revision: 1, createdAtUtc: instant, updatedAtUtc: instant, ...extra });
async function context(options = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...options });
  const state = { authenticated: true, accountId: "synthetic-account-a", orders: [order()], calls: [], pageErrors: [], offline: false, imageMissing: false,
    wechatEnabled: false, launchUnavailable: false, catalogProduct: product, catalogProducts: null, catalogEnabled: true, paymentVisits: 0, verifyLost: false, verifyRejected: false, cookieWritten: false, created: false, loseCreate: false, recoverNotFound: false };
  await ctx.route("**/*", async (route) => {
    const req = route.request(), url = new URL(req.url());
    if (url.origin === qaOrigin) {
      if (state.imageMissing && url.pathname.endsWith("mosslight-garden-preview.png")) return route.abort();
      return route.continue();
    }
    // 沙箱收银台同样在进程内替代，任何测试都不访问真实支付平台。
    if (url.origin === "https://openapi-sandbox.dl.alipaydev.com" && url.pathname === "/gateway.do") {
      state.paymentVisits++; return route.fulfill({ contentType: "text/html; charset=utf-8", body: "<meta charset=\"utf-8\"><h1>合成收银台，未付款</h1>" });
    }
    if (url.origin === "https://wx.tenpay.com" && url.pathname === "/cgi-bin/mmpayweb-bin/checkmweb") {
      state.paymentVisits++; return route.fulfill({ contentType: "text/html; charset=utf-8", body: "<meta charset=\"utf-8\"><h1>合成微信入口，未付款</h1>" });
    }
    if (url.origin !== "https://api.planchime.com" || !/^\/v1\/(web-auth|commerce)\//u.test(url.pathname)) { outside++; return route.abort(); }
    const body = req.method() === "POST" ? req.postDataJSON() : null;
    state.calls.push({ path: url.pathname, method: req.method(), body, key: req.headers()["idempotency-key"] });
    if (state.offline) return route.abort("internetdisconnected");
    const send = (data, status = 200) => route.fulfill({ status, contentType: "application/json", headers: { "Access-Control-Allow-Origin": qaOrigin, "Access-Control-Allow-Credentials": "true", "Cache-Control": "no-store" }, body: JSON.stringify(data) });
    const path = url.pathname;
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: { "Access-Control-Allow-Origin": qaOrigin, "Access-Control-Allow-Credentials": "true", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET,POST,OPTIONS" } });
    if (path.endsWith("/session")) return send({ schemaVersion: 1, status: state.authenticated ? "authenticated" : "anonymous", accountId: state.authenticated ? state.accountId : null, csrfToken: csrf, phoneOtp: "available" });
    if (path.endsWith("/challenges")) return send({ schemaVersion: 1, status: "challenge-accepted", challengeId: "synthetic-challenge", expiresAtUtc: new Date(Date.now() + 300000).toISOString() });
    if (path.endsWith("/verify")) {
      if (state.verifyRejected) return send({ schemaVersion: 1, status: "error", code: "OTP_INVALID" }, 400);
      if (state.verifyLost) { state.verifyLost = false; state.authenticated = state.cookieWritten; return route.abort("failed"); }
      state.authenticated = true; return send({ schemaVersion: 1, status: "authenticated", accountId: state.accountId, csrfToken: csrf });
    }
    if (path.endsWith("/logout")) { state.authenticated = false; return send({ schemaVersion: 1, status: "logged-out" }); }
    if (path === "/v1/commerce/wechat/catalog") return send({ schemaVersion: 1, checkoutEnabled: state.wechatEnabled, products: state.wechatEnabled ? [{...state.catalogProduct,checkoutOptions:["wechat-native","wechat-h5"].map(checkoutVariant=>({checkoutVariant,availability:"available",merchantDisplayName:disclosure.merchantName}))}] : [] });
    if (path === "/v1/commerce/wechat/orders" && req.method() === "GET") return send({schemaVersion:1,orders:state.orders.filter(o=>o.checkoutVariant?.startsWith("wechat-")),hasMore:false});
    if (path === "/v1/commerce/wechat/orders" && req.method() === "POST") {
      state.created = true;
      if (!state.orders.length) state.orders = [order({checkoutVariant:body.checkoutVariant,merchantDisplayName:disclosure.merchantName})];
      if (state.loseCreate) { state.loseCreate=false;return route.abort("failed"); }
      const launch = body.checkoutVariant === "wechat-native" ? {schemaVersion:1,type:"wechat-native",codeUrl:"weixin://wxpay/bizpayurl?pr=SYNTHETIC_NOT_PAYABLE",expiresAtUtc:new Date(Date.now()+60000).toISOString()} :
        {schemaVersion:1,type:"wechat-h5",method:"GET",url:"https://wx.tenpay.com/cgi-bin/mmpayweb-bin/checkmweb?prepay_id=SYNTHETIC_NOT_PAYABLE",expiresAtUtc:new Date(Date.now()+60000).toISOString(),orderExpiresAtUtc:new Date(Date.now()+600000).toISOString()};
      return send({schemaVersion:1,status:"created",order:state.orders[0],launchPayload:launch});
    }
    if (path === "/v1/commerce/wechat/orders/pc_synthetic_browser") return send({schemaVersion:1,order:state.orders[0]});
    if (path.endsWith("/launch")) {
      if(state.launchUnavailable)return send({schemaVersion:1,status:"provider-query-required",order:state.orders[0]});
      return send({schemaVersion:1,status:"ready",order:state.orders[0],launchPayload:{schemaVersion:1,type:"wechat-native",codeUrl:"weixin://wxpay/bizpayurl?pr=SYNTHETIC_NOT_PAYABLE",expiresAtUtc:new Date(Date.now()+60000).toISOString()}});
    }
    if (path.endsWith("/catalog")) return send({ schemaVersion: 1, status: state.catalogEnabled ? "available" : "configuration-required", checkoutEnabled: state.catalogEnabled, products: state.catalogEnabled ? state.catalogProducts ?? [state.catalogProduct] : [] });
    if (path.endsWith("/entitlements")) return send({ schemaVersion: 1, snapshot: { schemaVersion: 1, authority: "commerce-service-verified", accountId: state.accountId, entitlementRevision: 1, evaluatedAt: instant, entitlements: [] } });
    if (path.endsWith("/order-intents/recover")) return send(state.created && !state.recoverNotFound ? { schemaVersion: 1, status: "found", order: state.orders[0] } : { schemaVersion: 1, status: "not-found" });
    if (path === "/v1/commerce/orders" && req.method() === "GET") return send({ schemaVersion: 1, orders: state.orders.filter(o=>!o.checkoutVariant?.startsWith("wechat-")), hasMore: false });
    if (path === "/v1/commerce/orders" && req.method() === "POST") {
      state.created = true;
      if (!state.orders.length) state.orders = [order(body.checkoutVariant ? { checkoutVariant: body.checkoutVariant } : {})];
      if (state.loseCreate) { state.loseCreate = false; return route.abort("failed"); }
      const url = new URL("https://openapi-sandbox.dl.alipaydev.com/gateway.do"); url.searchParams.set("method", body.checkoutVariant === "alipay-h5-web" ? "alipay.trade.wap.pay" : "alipay.trade.page.pay"); url.searchParams.set("sign", "SYNTHETIC");
      url.searchParams.set("biz_content", JSON.stringify({ out_trade_no: state.orders[0].orderId, product_code: body.checkoutVariant === "alipay-h5-web" ? "QUICK_WAP_WAY" : "FAST_INSTANT_TRADE_PAY", total_amount: "6.00", ...(body.checkoutVariant ? { quit_url: "https://planchime.com/services/orders/" } : {}) }));
      return send({ schemaVersion: 1, status: "created", order: state.orders[0], launchPayload: { schemaVersion: 1, type: body.checkoutVariant ?? "alipay-pc-web", method: "GET", url: url.toString(), expiresAtUtc: new Date(Date.now() + 60000).toISOString() } }, 201);
    }
    if (path.endsWith("/reconcile")) return send(state.orders[0].status === "settled" ? { schemaVersion: 1, status: "settled", order: state.orders[0] } : { schemaVersion: 1, status: "not-settled" });
    if (path === "/v1/commerce/orders/pc_synthetic_browser") return send({ schemaVersion: 1, order: state.orders[0] });
    return send({ schemaVersion: 1, status: "error", code: "COMMERCE_ORDER_NOT_FOUND" }, 404);
  });
  ctx.on("page", (page) => page.on("pageerror", (error) => state.pageErrors.push(error.message)));
  return { ctx, state };
}
async function open(ctx, view = "catalog", mode = "sandbox") {
  const page = await ctx.newPage(); await page.goto(`${base}?view=${view}&mode=${mode}`); await page.locator("h1").waitFor(); return page;
}
async function topOfPage(page) {
  // 点击与聚焦可能自动滚动；首屏证据必须回到顶部并等两帧，不能把滚动后的坐标当页面首屏。
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForFunction(() => window.scrollY === 0);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.equal(await page.evaluate(() => window.scrollY), 0);
}
async function screenshot(page, name) { await topOfPage(page); await page.screenshot({ path: `${evidence}/${name}.png`, fullPage: false }); }
async function noOverflow(page) { assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true); }
async function verify(name, run) { if (process.env.PLANCHIME_QA_FILTER && !name.includes(process.env.PLANCHIME_QA_FILTER)) return; await run(); results.push({ name, result: "passed" }); console.log("PASS", name); }
const recheck = (page) => page.getByRole("button", { name: /^(核验原单|查看交付进度|重新核验)$/ });
const primary = (page) => page.locator("main section [class*='full']").first();
const mobileOptions = (width) => ({ viewport: { width, height: 852 }, isMobile: true, hasTouch: true, reducedMotion: "reduce", userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148" });
async function checkProgressAction(page, fulfillmentStatus) {
  const expected = fulfillmentStatus === "pending" ? "查看交付进度" : fulfillmentStatus === "delivered" ? "返回服务与主题" : "返回订单列表";
  assert.equal(await primary(page).innerText(), expected);
  if (fulfillmentStatus !== "pending") {
    assert.equal(await page.getByRole("button", { name: "重新核验", exact: true }).count(), 1);
    assert.equal(await page.getByRole("button", { name: "查看交付进度", exact: true }).count(), 0);
    assert.ok(await page.getByText(/免费功能/).count());
  }
  // 测试替身和静态导出对尾斜杠的处理不同，但必须指向同一个站内服务页面。
  if (fulfillmentStatus === "delivered") assert.match(await primary(page).getAttribute("href"), /^\/services\/?$/u);
}
async function errorGap(page, field, width) {
  const measure = await page.locator(`#${field}-error`).evaluate((el, field) => {
    const error = el.getBoundingClientRect(), input = document.getElementById(`purchase-${field}`).getBoundingClientRect();
    const style = getComputedStyle(el);
    return { marginTop: Number.parseFloat(style.marginTop), gapFromInput: error.top - input.bottom, textHeight: error.height };
  }, field);
  measurements.push({ test: "QA02", width, field, ...measure });
  assert.ok(measure.marginTop >= 12); assert.ok(measure.gapFromInput >= 12);
  await noOverflow(page);
}
try {
  await verify("桌面样式、焦点、图片失败与禁用确认", async () => {
    const { ctx, state } = await context(); const page = await open(ctx);
    await screenshot(page, "desktop-catalog"); await noOverflow(page);
    assert.deepEqual(await page.locator("h1").evaluate((el) => ({ size: getComputedStyle(el).fontSize, weight: getComputedStyle(el).fontWeight })), { size: "36px", weight: "600" });
    assert.equal(await page.getByRole("link", { name: "查看主题与服务说明" }).evaluate((el) => getComputedStyle(el).fontWeight), "500");
    await page.keyboard.press("Tab"); assert.ok(await page.locator(":focus").count());
    await page.getByRole("link", { name: "我的订单" }).focus(); assert.equal(await page.locator(":focus").evaluate((el) => getComputedStyle(el).outlineWidth), "3px");
    const disabled = await open(ctx, "confirm"); assert.equal(await disabled.getByRole("button", { name: "暂未开放购买" }).isDisabled(), true);
    await disabled.keyboard.press("Enter"); assert.equal(state.calls.filter(c => c.method === "POST").length, 0); await screenshot(disabled, "desktop-unavailable");
    state.imageMissing = true; await page.reload(); await page.getByText("主题预览暂未加载，服务说明仍可查看。").waitFor(); await noOverflow(page); await screenshot(page, "missing-art");
    assert.deepEqual(state.pageErrors, []); await ctx.close();
  });
  await verify("真实组件验证码丢响应，同次重试保留mutation，不自动重发", async () => {
    for (const cookieWritten of [false, true]) {
      const { ctx, state } = await context(); state.authenticated = false; state.verifyLost = true; state.cookieWritten = cookieWritten;
      const page = await open(ctx, "login"); await page.getByRole("button", { name: "获取验证码" }).waitFor();
      await page.getByLabel("手机号", { exact: true }).fill("+12025550123"); await page.getByRole("button", { name: "获取验证码" }).click();
      await page.getByText("验证码请求已受理。", { exact: false }).waitFor(); await page.getByLabel("验证码", { exact: true }).fill("123456");
      await page.getByRole("button", { name: "登录并查看订单" }).click(); await page.getByRole("button", { name: "确认登录状态并重试" }).waitFor();
      assert.equal(await page.getByLabel("验证码", { exact: true }).getAttribute("aria-invalid"), "false");
      await screenshot(page, `login-unknown-${cookieWritten}`); await page.getByRole("button", { name: "确认登录状态并重试" }).click();
      await page.getByRole("heading", { name: "我的订单", exact: true }).waitFor(); await page.getByRole("button", { name: /查看订单/ }).waitFor();
      const writes = state.calls.filter((call) => call.path.endsWith("/verify") && call.method === "POST");
      assert.equal(writes.length, cookieWritten ? 1 : 2); if (!cookieWritten) assert.deepEqual(writes[0].body, writes[1].body);
      assert.equal(state.calls.filter((call) => call.path.endsWith("/challenges") && call.method === "POST").length, 1);
      assert.equal(await page.evaluate(() => Object.values(localStorage).join("").includes("123456")), false);
      assert.deepEqual(state.pageErrors, []); await ctx.close();
    }
  });
  await verify("真实页面付款与交付分开、离线保留事实、账号变化清除缓存", async () => {
    const { ctx, state } = await context(); const page = await open(ctx, "orders"); await page.getByRole("button", { name: /查看订单/ }).click();
    await page.getByRole("heading", { name: "核验原订单", exact: true }).waitFor(); await screenshot(page, "desktop-verification");
    for (const fulfillmentStatus of ["pending", "delivered", "revoked"]) {
      state.orders = [order({ status: "settled", revision: 2, fulfillmentStatus })];
      await recheck(page).click();
      await page.getByRole("heading", { name: fulfillmentStatus === "pending" ? "付款已确认，权益待发放" : fulfillmentStatus === "delivered" ? "权益已加入这个账号" : "这笔订单的权益已撤回" }).waitFor();
      await screenshot(page, `desktop-${fulfillmentStatus}`);
      await checkProgressAction(page, fulfillmentStatus);
      assert.equal(await page.getByRole("button", { name: /支付|购买/ }).count(), 0);
    }
    state.offline = true; await recheck(page).click(); await page.getByRole("status").getByText(/暂/).waitFor();
    assert.equal(await page.getByRole("heading", { name: "这笔订单的权益已撤回" }).count(), 1);
    state.offline = false; state.accountId = "synthetic-account-b"; state.orders = [];
    await recheck(page).click(); await page.getByRole("heading", { name: "登录后继续" }).waitFor();
    assert.equal(await page.getByText("pc_synthetic_browser", { exact: false }).count(), 0);
    assert.deepEqual(state.pageErrors, []); await ctx.close();
  });
  await verify("浏览器重载、丢响应、not-found、多标签真实Web Locks与localStorage", async () => {
    const { ctx, state } = await context(); const page = await open(ctx); state.loseCreate = true;
    const input = { productId: product.productId, expectedCatalogRevision: product.catalogRevision, expectedAccountId: state.accountId, userConfirmed: true };
    await page.evaluate(async (input) => { const qa = window.purchaseQA; const i = await qa.client.confirmPurchase(input); try { await qa.client.createOrder(i); } catch {} }, input);
    const second = await open(ctx); state.recoverNotFound = true;
    const recovered = await second.evaluate(() => window.purchaseQA.client.recoverPurchases("synthetic-account-a")); assert.equal(recovered[0].order, null);
    const key = recovered[0].entry.idempotencyKey;
    await second.reload(); await second.locator("h1").waitFor();
    const restored = await second.evaluate(() => window.purchaseQA.client.recoverPurchases("synthetic-account-a")); assert.equal(restored[0].entry.idempotencyKey, key);
    state.recoverNotFound = false;
    const found = await second.evaluate(() => window.purchaseQA.client.recoverPurchases("synthetic-account-a")); assert.equal(found[0].order.orderId, "pc_synthetic_browser");
    assert.equal(state.calls.filter((call) => call.path === "/v1/commerce/orders" && call.method === "POST").length, 1);
    assert.deepEqual(state.pageErrors, []); await ctx.close();
    const fresh = await context(), a = await open(fresh.ctx), b = await open(fresh.ctx);
    await Promise.all([a, b].map((p) => p.evaluate(async (input) => { const client = window.purchaseQA.client; const intent = await client.confirmPurchase(input); await client.createOrder(intent); }, input)));
    assert.equal(fresh.state.calls.filter((call) => call.path === "/v1/commerce/orders" && call.method === "POST").length, 1); await fresh.ctx.close();
  });
  await verify("手机号与验证码错误各自关联、聚焦、编辑清除", async () => {
    for (const width of [1440, 393, 320]) {
    const { ctx, state } = await context(width === 1440 ? {} : mobileOptions(width)); state.authenticated = false; state.verifyRejected = true;
    const page = await open(ctx, "login");
    const phone = page.getByLabel("手机号", { exact: true }), code = page.getByLabel("验证码", { exact: true });
    await page.getByRole("button", { name: "获取验证码" }).click();
    await page.locator("#phone-error").getByText(/请输入完整手机号/).waitFor();
    assert.equal(await phone.getAttribute("aria-invalid"), "true"); assert.equal(await code.getAttribute("aria-invalid"), "false");
    assert.equal(await phone.evaluate((el) => el === document.activeElement), true);
    await errorGap(page, "phone", width); await screenshot(page, `phone-error-${width}`);
    await phone.fill("+12025550123"); assert.equal(await phone.getAttribute("aria-invalid"), "false");
    assert.equal(await page.locator("#phone-error").evaluate((el) => el.getBoundingClientRect().height), 0);
    await page.getByRole("button", { name: "获取验证码" }).click(); await page.getByText("验证码请求已受理。", { exact: false }).waitFor();
    await code.fill("123456"); await page.getByRole("button", { name: "登录并查看订单" }).click();
    await page.locator("#code-error").getByText(/验证码未通过/).waitFor();
    await page.waitForFunction(() => document.activeElement?.id === "purchase-code");
    assert.equal(await code.getAttribute("aria-invalid"), "true"); assert.equal(await phone.getAttribute("aria-invalid"), "false");
    const widths = await page.locator("form").evaluate((form) => ({ form: form.getBoundingClientRect().width, submit: form.querySelector('button[type="submit"]').getBoundingClientRect().width }));
    if (width === 1440) assert.equal(widths.form, 480); assert.equal(widths.submit, widths.form);
    await errorGap(page, "code", width); await screenshot(page, `code-error-${width}`);
    await code.fill("654321"); assert.equal(await code.getAttribute("aria-invalid"), "false");
    assert.equal(await page.locator("#code-error").evaluate((el) => el.getBoundingClientRect().height), 0);
    assert.deepEqual(state.pageErrors, []); await ctx.close();
    }
  });
  await verify("真实浏览器日志损坏或存储不可用，仍能查询服务端原订单", async () => {
    for (const unavailable of [false, true]) {
      const { ctx, state } = await context();
      if (unavailable) await ctx.addInitScript(() => { Storage.prototype.getItem = function () { throw new DOMException("Synthetic denial", "SecurityError"); }; });
      const page = await open(ctx);
      if (!unavailable) await page.evaluate(async () => {
        const digest = await window.purchaseQA.runtime.digest("planchime:purchase-account:v1\0https://api.planchime.com\0synthetic-account-a");
        localStorage.setItem(`planchime:purchase-intents:v1:${digest}`, "corrupt-synthetic-journal");
      });
      const orders = await open(ctx, "orders");
      await orders.getByRole("status").getByText(/本机恢复记录暂不可用/).waitFor();
      await orders.getByRole("button", { name: /查看订单/ }).click(); await orders.getByRole("heading", { name: "核验原订单", exact: true }).waitFor();
      assert.equal(state.calls.filter((call) => call.path === "/v1/commerce/orders" && call.method === "POST").length, 0);
      await screenshot(orders, `storage-${unavailable ? "denied" : "corrupt"}`); assert.deepEqual(state.pageErrors, []); await ctx.close();
    }
  });
  await verify("手机393/窄屏320、无付款入口、AX名称、减少动态与放大重排", async () => {
    for (const width of [393, 320]) {
      const { ctx, state } = await context(mobileOptions(width));
      const page = await open(ctx); await noOverflow(page); await screenshot(page, `mobile-${width}`);
      const orders = await open(ctx, "orders"); await orders.getByRole("button", { name: /查看订单/ }).click(); await noOverflow(orders);
      assert.equal(await orders.getByRole("button", { name: /支付|购买/ }).count(), 0);
      const mobileReject = await page.evaluate(async () => { try { await window.purchaseQA.client.confirmPurchase({ productId: "synthetic-theme", expectedCatalogRevision: "synthetic-v1", expectedAccountId: "synthetic-account-a", userConfirmed: true }); } catch (error) { return error.code; } });
      assert.equal(mobileReject, "DESKTOP_PAYMENT_REQUIRED");
      await topOfPage(orders); await orders.screenshot({ path: `${evidence}/mobile-order-${width}.png`, fullPage: true });
      await screenshot(orders, `mobile-order-first-${width}`);
      const scrollY = await orders.evaluate(() => window.scrollY); assert.equal(scrollY, 0);
      const bounds = await primary(orders).boundingBox(); measurements.push({ test: "QA01", viewportWidth: width, scrollY, ...bounds, bottom: bounds.y + bounds.height });
      assert.ok(bounds.height >= 52); assert.ok(bounds.y + bounds.height <= 808, `主按钮底边 ${bounds.y + bounds.height} 超过808`);
      assert.ok(await orders.getByText("订单更新时间：", { exact: false }).count());
      const ax = await (await ctx.newCDPSession(orders)).send("Accessibility.getFullAXTree");
      assert.ok(ax.nodes.some((node) => node.role?.value === "heading" && node.name?.value === "核验原订单"));
      assert.ok(ax.nodes.some((node) => node.role?.value === "button" && node.name?.value === "核验原单"));
      for (const fulfillmentStatus of ["pending", "delivered", "revoked"]) {
        state.orders = [order({ status: "settled", revision: 2, fulfillmentStatus })];
        await recheck(orders).click();
        await orders.getByRole("heading", { name: fulfillmentStatus === "pending" ? "付款已确认，权益待发放" : fulfillmentStatus === "delivered" ? "权益已加入这个账号" : "这笔订单的权益已撤回" }).waitFor();
        await checkProgressAction(orders, fulfillmentStatus); await noOverflow(orders); await screenshot(orders, `mobile-${fulfillmentStatus}-${width}`);
      }
      await primary(orders).click(); await orders.getByRole("heading", { name: "我的订单", exact: true }).waitFor();
      state.orders = [order({ orderId: "pc_" + "long".repeat(14), productId: "synthetic_" + "long".repeat(14) })];
      const longPage = await open(ctx, "orders"); await longPage.getByRole("button", { name: /查看订单/ }).click(); await noOverflow(longPage);
      await longPage.locator("main section").evaluate((el) => { el.style.fontSize = "24px"; });
      await noOverflow(longPage); await topOfPage(longPage); await longPage.screenshot({ path: `${evidence}/long-order-large-text-${width}.png`, fullPage: true });
      await page.evaluate(() => { document.documentElement.style.zoom = "2"; });
      await noOverflow(page); await screenshot(page, `css-zoom200-${width}`);
      assert.deepEqual(state.pageErrors, []); await ctx.close();
    }
  });
  await verify("售前全部入口只读取支付宝目录，服务端误开也不挂载登录或购买", async () => {
    for (const width of [1440, 393, 320]) {
      const { ctx, state } = await context(width === 1440 ? {} : mobileOptions(width));
      state.orders = []; state.catalogProduct = disclosed;
      for (const view of ["catalog", "login", "orders", "confirm", "policy"]) {
        const page = await open(ctx, view, "prelaunch");
        await page.getByText("商品目录已连接，尚未开放购买。", { exact: true }).first().waitFor();
        assert.equal(await page.locator("form,input").count(), 0);
        assert.equal(await page.getByRole("button", { name: /获取验证码|查看并购买|确认并前往|继续支付/ }).count(), 0);
        assert.equal(await page.getByRole("link", { name: "我的订单", exact: true }).count(), 0);
        await noOverflow(page);
        if (view === "catalog") {
          await screenshot(page, `prelaunch-${width}`);
          state.offline = true; await page.getByRole("button", { name: "重新查看开放状态" }).click();
          await page.getByText("暂未取得商品目录状态，购买仍未开放。", { exact: true }).first().waitFor();
          state.offline = false;
          state.catalogEnabled = false; await page.getByRole("button", { name: "重新查看开放状态" }).click();
          await page.getByText("商品目录已连接，尚未开放购买。", { exact: true }).first().waitFor();
          state.catalogEnabled = true;
        }
        await page.close();
      }
      assert.ok(state.calls.every((call) => call.path === "/v1/commerce/catalog" && ["GET", "OPTIONS"].includes(call.method)));
      assert.equal(state.paymentVisits, 0); assert.deepEqual(state.pageErrors, []); await ctx.close();
    }
  });
  await verify("交易模式同时呈现会员与主题，并由目录停售控制购买入口", async () => {
    const membershipBase = { ...product, productId: "synthetic-membership", displayName: "合成会员，不可销售", amountMinor: 1200,
      fulfillment: { schemaVersion: 1, kind: "fixed-term-membership", entitlementKey: "pro.core", durationSeconds: 2592000,
        startsAt: "first-delivery", autoRenews: false, benefitManifest: { version: "synthetic-v1", capabilityKeys: ["pro.cloud.backup"] } } };
    const membershipDisclosure = { ...disclosure, deliverySummary: "合成会员交付测试，不可销售。", exclusions: [] };
    const membership = { ...membershipBase, disclosure: membershipDisclosure,
      catalogRevision: createHash("sha256").update(disclosureRevisionInput(membershipBase, membershipDisclosure)).digest("hex") };
    for (const width of [1440, 393, 320]) {
      const { ctx, state } = await context(width === 1440 ? {} : mobileOptions(width)); state.orders = [];
      state.catalogProducts = [disclosed, membership];
      const page = await open(ctx);
      await page.getByRole("heading", { name: membership.displayName, exact: true }).waitFor();
      await page.getByRole("heading", { name: disclosed.displayName, exact: true }).waitFor();
      assert.equal(await page.getByRole("button", { name: "查看并购买", exact: true }).count(), 2);
      await page.getByText("有效期从首次发放起计算。", { exact: true }).waitFor();
      await noOverflow(page); await screenshot(page, `membership-theme-${width}`);
      // 会员位于主题之后，单独保存整张卡片，避免首屏截图漏掉新增内容。
      await page.getByRole("article", { name: membership.displayName, exact: true }).screenshot({ path: `${evidence}/membership-card-${width}.png` });
      state.catalogEnabled = false; await page.reload();
      await page.getByText("尚未开放购买", { exact: true }).waitFor();
      assert.equal(await page.getByRole("button", { name: "查看并购买", exact: true }).count(), 0);
      assert.equal(state.calls.filter((call) => call.method === "POST").length, 0);
      assert.equal(state.paymentVisits, 0); assert.deepEqual(state.pageErrors, []); await ctx.close();
    }
  });
  await verify("已批准商品从确认到合成收银台，PC/H5不串渠道且窄屏完整展示", async () => {
    for (const width of [1440, 393, 320]) {
      const { ctx, state } = await context(width === 1440 ? {} : mobileOptions(width)); state.orders = []; state.catalogProduct = disclosed;
      const page = await open(ctx); await page.getByRole("button", { name: "查看并购买" }).click();
      await page.getByRole("heading", { name: "确认购买", exact: true }).waitFor();
      assert.equal(state.calls.filter(c => c.path === "/v1/commerce/orders" && c.method === "POST").length, 0);
      await page.getByText(disclosure.merchantName, { exact: true }).first().waitFor();
      await page.getByRole("link", { name: "查看退款规则" }).waitFor(); await noOverflow(page);
      await page.screenshot({ path: `${evidence}/checkout-${width}.png`, fullPage: true });
      assert.equal(await page.getByRole("button", { name: "请选择付款方式，¥6.00", exact: true }).isDisabled(), true);
      await page.getByRole("radio", { name: "支付宝", exact: true }).check();
      const confirm = page.getByRole("button", { name: "确认并前往支付宝，¥6.00", exact: true });
      assert.match(await page.locator("main").ariaSnapshot(), /确认并前往支付宝/u);
      if (width === 320) { await page.evaluate(() => document.documentElement.style.zoom = "2"); await noOverflow(page); }
      await confirm.click();
      try { await page.getByRole("heading", { name: "合成收银台，未付款" }).waitFor({ timeout: 8000 }); }
      catch (error) { console.log(JSON.stringify({ width, url: page.url(), page: await page.locator("body").innerText({ timeout: 2000 }), calls: state.calls.map(c => ({ path: c.path, method: c.method })), pageErrors: state.pageErrors })); throw error; }
      const writes = state.calls.filter(c => c.path === "/v1/commerce/orders" && c.method === "POST");
      assert.equal(writes.length, 1); assert.equal(writes[0].body.checkoutVariant, width === 1440 ? undefined : "alipay-h5-web");
      assert.equal(state.paymentVisits, 1); assert.deepEqual(state.pageErrors, []); await ctx.close();
    }
  });
  await verify("购买登录后仍回到确认，账号变化与原单丢响应不自动重买", async () => {
    const { ctx, state } = await context(); state.orders = []; state.catalogProduct = disclosed; state.authenticated = false;
    const page = await open(ctx); await page.getByRole("button", { name: "查看并购买" }).click();
    await page.getByLabel("手机号", { exact: true }).fill("+12025550123"); await page.getByRole("button", { name: "获取验证码" }).click();
    await page.getByText("验证码请求已受理。", { exact: false }).waitFor(); await page.getByLabel("验证码", { exact: true }).fill("123456");
    await page.getByRole("button", { name: "登录并核对购买" }).click();
    await page.getByRole("heading", { name: "确认购买", exact: true }).waitFor();
    assert.equal(state.calls.filter(c => c.path === "/v1/commerce/orders" && c.method === "POST").length, 0);
    await page.getByRole("radio", { name: "支付宝", exact: true }).check();
    state.accountId = "synthetic-account-b";
    await page.getByRole("button", { name: "确认并前往支付宝，¥6.00", exact: true }).click();
    await page.getByRole("heading", { name: "登录后继续", exact: true }).waitFor();
    assert.equal(state.calls.filter(c => c.path === "/v1/commerce/orders" && c.method === "POST").length, 0);
    await ctx.close();
    const next = await context(); next.state.orders = []; next.state.catalogProduct = disclosed; next.state.loseCreate = true;
    const lost = await open(next.ctx); await lost.getByRole("button", { name: "查看并购买" }).click();
    await lost.getByRole("radio", { name: "支付宝", exact: true }).check();
    await lost.getByRole("button", { name: "确认并前往支付宝，¥6.00", exact: true }).click();
    await lost.getByRole("heading", { name: "我的订单", exact: true }).waitFor();
    assert.equal(next.state.paymentVisits, 0); assert.equal(next.state.calls.filter(c => c.path === "/v1/commerce/orders" && c.method === "POST").length, 1);
    await next.ctx.close();
  });
  await verify("微信付款方式主动选择，桌面显示原码、手机打开H5，均无真实调用", async () => {
    for(const width of [1440,393,320]) {
      const {ctx,state}=await context(width===1440?{}:mobileOptions(width));state.orders=[];state.catalogProduct=disclosed;state.wechatEnabled=true;
      const page=await open(ctx);await page.getByRole("button",{name:"查看并购买"}).click();await page.getByRole("heading",{name:"确认购买",exact:true}).waitFor();
      assert.equal(await page.getByRole("radio",{checked:true}).count(),0);
      assert.equal(await page.getByRole("button",{name:"请选择付款方式，¥6.00",exact:true}).isDisabled(),true);
      await page.getByRole("radio",{name:width===1440?"微信支付（扫码）":"微信支付",exact:true}).check();
      await noOverflow(page);await topOfPage(page);await page.screenshot({path:`${evidence}/wechat-confirm-${width}.png`,fullPage:true});
      await page.getByRole("button",{name:`${width===1440?"确认并显示付款码":"确认并前往微信"}，¥6.00`,exact:true}).click();
      if(width===1440) {
        await page.getByRole("heading",{name:"用微信扫码付款",exact:true}).waitFor();
        await page.getByRole("img",{name:/当前订单的微信付款二维码/}).waitFor();await noOverflow(page);await topOfPage(page);await page.screenshot({path:`${evidence}/wechat-native-${width}.png`,fullPage:true});
        assert.equal(state.paymentVisits,0);assert.equal(await page.evaluate(()=>Object.values(localStorage).join("").includes("SYNTHETIC_NOT_PAYABLE")),false);
        // 只推进本机码时钟：到期必须隐藏码而不是自动新建或改写订单。
        await page.evaluate(()=>{Date.now=()=>new Date().getTime()+61000;document.dispatchEvent(new Event("visibilitychange"));});
        await page.getByText("付款码已失效，原订单仍需核对。",{exact:true}).waitFor();assert.equal(await page.getByRole("img",{name:/当前订单的微信付款二维码/}).count(),0);
        await page.screenshot({path:`${evidence}/wechat-native-expired-${width}.png`,fullPage:true});
        state.orders=[order({checkoutVariant:"wechat-native",merchantDisplayName:disclosure.merchantName,status:"settled",revision:2,fulfillmentStatus:"pending"})];
        await recheck(page).click();await page.getByRole("heading",{name:"付款已确认，权益待发放"}).waitFor();
        assert.equal(await page.getByRole("img",{name:/当前订单的微信付款二维码/}).count(),0);
        assert.equal(await page.getByRole("button",{name:/付款码|继续前往/}).count(),0);
      } else {await page.getByRole("heading",{name:"合成微信入口，未付款"}).waitFor();assert.equal(state.paymentVisits,1);}
      const writes=state.calls.filter(c=>c.path==="/v1/commerce/wechat/orders"&&c.method==="POST");assert.equal(writes.length,1);assert.equal(writes[0].body.checkoutVariant,width===1440?"wechat-native":"wechat-h5");
      assert.deepEqual(state.pageErrors,[]);await ctx.close();
    }
  });
  await verify("微信原码窄屏恢复、过期只核验、切换账号清除二维码",async()=>{
    for(const width of [393,320]){
      const {ctx,state}=await context(mobileOptions(width));state.wechatEnabled=true;state.orders=[order({checkoutVariant:"wechat-native",merchantDisplayName:disclosure.merchantName})];
      const page=await open(ctx,"orders");await page.getByRole("button",{name:/查看订单/}).click();
      await page.getByRole("button",{name:"显示原订单付款码",exact:true}).click();await page.getByRole("img",{name:/当前订单的微信付款二维码/}).waitFor();
      await page.getByText("请用另一部手机的微信扫一扫",{exact:true}).waitFor();
      assert.equal(await page.locator("main section strong").filter({hasText:"¥6.00"}).evaluate(el=>getComputedStyle(el).fontSize),"32px");
      await noOverflow(page);await topOfPage(page);await page.screenshot({path:`${evidence}/wechat-native-${width}.png`,fullPage:true});
      assert.equal(state.calls.filter(c=>c.path==="/v1/commerce/wechat/orders"&&c.method==="POST").length,0);
      state.accountId="synthetic-account-b";state.orders=[];await recheck(page).click();await page.getByRole("heading",{name:"登录后继续"}).waitFor();
      assert.equal(await page.getByRole("img",{name:/当前订单的微信付款二维码/}).count(),0);assert.deepEqual(state.pageErrors,[]);await ctx.close();
    }
  });
  await verify("微信内置浏览器不下单，丢响应只恢复原微信订单",async()=>{
    const f=await context({...mobileOptions(393),userAgent:"Mozilla/5.0 iPhone Mobile MicroMessenger"});f.state.wechatEnabled=true;f.state.orders=[];f.state.catalogProduct=disclosed;
    const blocked=await open(f.ctx);await blocked.getByText("当前浏览器暂不支持购买",{exact:true}).waitFor();assert.equal(f.state.calls.filter(c=>c.method==="POST").length,0);await f.ctx.close();
    const {ctx,state}=await context();state.wechatEnabled=true;state.orders=[];state.catalogProduct=disclosed;state.loseCreate=true;
    const page=await open(ctx);await page.getByRole("button",{name:"查看并购买"}).click();await page.getByRole("radio",{name:"微信支付（扫码）",exact:true}).check();
    await page.getByRole("button",{name:"确认并显示付款码，¥6.00",exact:true}).click();await page.getByRole("heading",{name:"我的订单",exact:true}).waitFor();
    assert.equal(state.calls.filter(c=>c.path==="/v1/commerce/wechat/orders"&&c.method==="POST").length,1);assert.equal(state.paymentVisits,0);
    await page.getByRole("button",{name:/查看订单/}).click();state.launchUnavailable=true;await page.getByRole("button",{name:"显示原订单付款码",exact:true}).click();
    await page.getByText("付款入口暂不可用，原订单仍需核验，请不要重复下单。",{exact:true}).waitFor();assert.equal(await page.getByRole("img",{name:/当前订单的微信付款二维码/}).count(),0);
    assert.deepEqual(state.pageErrors,[]);await ctx.close();
  });
  assert.equal(outside, 0, "没有需要被阻断的未计划外部请求");
  await writeFile(`${evidence}/report.json`, JSON.stringify({ browser: await browser.version(), results, measurements, externalRequestsAllowed: 0, unexpectedOutsideRequests: outside,
    scope: "真实Chrome组件与Web API；生产静态页另验。CSS zoom 200%不是浏览器原生缩放；AX树不是VoiceOver人工读屏。" }, null, 2));
} finally { await browser.close(); }
