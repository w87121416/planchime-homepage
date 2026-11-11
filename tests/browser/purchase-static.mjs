import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "/Users/xiao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";

// 浏览器保留正式Origin以执行真实静态JS；全部站点资源映射到本地out，API完全合成，绝不访问公网。
const base = process.env.PLANCHIME_QA_BASE ?? "http://127.0.0.1:4187";
if (!/^http:\/\/127\.0\.0\.1:\d+$/u.test(base)) throw new Error("local QA origin required");
const site = "https://planchime.com", api = "https://api.planchime.com";
const output = process.env.PLANCHIME_QA_OUTPUT ?? "/private/tmp/pay-r4-static";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const external = [], failures = [], errors = [], apiRequests = [], checked = new Set(), results = [], deviceChecks = [];
const closedCatalog = { schemaVersion: 1, status: "configuration-required", checkoutEnabled: false, products: [] };
async function isolatedContext(options = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...options });
  const state = { offline: false, closing: false };
  await context.addCookies([{ name: "synthetic_prelaunch", value: "SYNTHETIC_NOT_REAL", domain: "api.planchime.com", path: "/", secure: true, sameSite: "None" }]);
  await context.route("**/*", async (route) => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin === site && ["GET", "HEAD"].includes(request.method())) {
      // Next静态导航会用HEAD探测本站路由；只映射到本地资源，API仍严格只允许目录GET/预检。
      // 请求重定向仍留在浏览器中受同一拦截器约束，不让测试请求从本地跳到外站。
      try {
        const response = await route.fetch({ url: base + url.pathname + url.search, maxRedirects: 0 });
        return await route.fulfill({ response });
      } catch (error) {
        // 只收束测试主动关闭上下文时尚在途的静态预取；运行期间的资源或断言错误不能被吞掉。
        if (state.closing && /disposed|closed|cancel/iu.test(String(error))) return;
        throw error;
      }
    }
    const validCatalog = url.origin === api && ["/v1/commerce/catalog", "/v1/commerce/catalog?checkoutVariant=alipay-h5-web"].includes(url.pathname + url.search);
    if (!validCatalog || !["GET", "OPTIONS"].includes(request.method())) {
      external.push({ origin: url.origin, path: url.pathname, method: request.method() }); return route.abort();
    }
    const headers = request.headers();
    apiRequests.push({ path: url.pathname + url.search, method: request.method(), webVersion: headers["x-planchime-web-version"] ?? null,
      commerceVersion: headers["x-appsch-commerce-version"] ?? null, cookiePresent: headers.cookie !== undefined, offline: state.offline });
    if (request.method() === "OPTIONS") {
      assert.equal(headers.origin, site); assert.equal(headers["access-control-request-method"], "GET");
      assert.equal(headers["access-control-request-headers"], "x-appsch-commerce-version");
      return route.fulfill({ status: 204, headers: { "Access-Control-Allow-Origin": site, "Access-Control-Allow-Methods": "GET", "Access-Control-Allow-Headers": "x-appsch-commerce-version", "Cache-Control": "no-store" } });
    }
    assert.equal(headers["x-appsch-commerce-version"], "2026-10-19");
    assert.equal(headers["x-planchime-web-version"], undefined); assert.equal(headers.cookie, undefined);
    assert.equal(headers.authorization, undefined); assert.equal(headers["x-planchime-csrf"], undefined);
    assert.equal(headers["idempotency-key"], undefined);
    if (state.offline) return route.abort("internetdisconnected");
    return route.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": site, "Cache-Control": "no-store" }, body: JSON.stringify(closedCatalog) });
  });
  context.on("page", (page) => {
    page.on("pageerror", (error) => errors.push({ path: new URL(page.url()).pathname, message: error.message }));
    page.on("response", (response) => { if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`); });
  });
  return { context, state, close: async () => { state.closing = true; await context.close(); } };
}
async function checkClosed(page, connected = true) {
  const text = connected ? "尚未开放购买。" : "暂时无法查看开放情况，请稍后再试。";
  await page.getByRole("status").getByText(text, { exact: true }).first().waitFor();
  assert.equal(await page.getByRole("status").getByText(text, { exact: true }).count(), 2);
  const availability = await page.locator('[aria-labelledby="purchase-availability-title"]').innerText();
  assert.match(availability, /会员与主题尚未开放购买，免费日程与提醒可继续使用。/);
  assert.doesNotMatch(availability, /商品目录|连接状态|本页只查看|权益交付|开通收款/);
  assert.equal(await page.locator("form,input,iframe").count(), 0);
  assert.equal(await page.getByRole("button", { name: /获取验证码|查看并购买|确认并前往|继续支付|登录并/ }).count(), 0);
  assert.equal(await page.getByText("权益已加入这个账号", { exact: true }).count(), 0);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
}
try {
  const { context, state, close: closeMain } = await isolatedContext();
  const page = await context.newPage();
  const paths = ["/", "/services/", "/services/orders/", "/services/sign-in/", "/services/checkout/", "/services/purchase-info/", "/services/payment-return/?status=success&paid=true&orderId=not-trusted", "/download/", "/support/", "/privacy/", "/terms/"];
  for (const path of paths) {
    assert.equal((await page.goto(site + path)).status(), 200);
    await page.locator("h1").waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    assert.ok(await page.getByText("苏ICP备2026061783号-2", { exact: false }).count());
    for (const link of await page.locator("a[href]").evaluateAll((nodes) => nodes.map((node) => node.href))) {
      const url = new URL(link); if (url.origin !== site || checked.has(url.pathname)) continue;
      checked.add(url.pathname); assert.equal((await fetch(base + url.pathname)).status, 200, url.pathname);
    }
    if (path.startsWith("/services/")) await checkClosed(page);
    if (["/services/orders/", "/services/sign-in/", "/services/checkout/"].includes(path) || path.startsWith("/services/payment-return/")) {
      assert.match(await page.locator('meta[name="robots"]').getAttribute("content"), /noindex/u);
    }
    if (["/", "/services/", "/services/sign-in/"].includes(path)) await page.screenshot({ path: `${output}/${path === "/" ? "home" : path === "/services/" ? "services" : "login"}-desktop.png`, fullPage: true });
    results.push({ path, status: "passed" });
  }
  for (const width of [393, 320]) {
    await page.setViewportSize({ width, height: 852 });
    for (const [path, name] of [["/services/", "services"], ["/services/sign-in/", "login"]]) {
      await page.goto(site + path); await checkClosed(page);
      await page.screenshot({ path: `${output}/${name}-${width}.png`, fullPage: true });
    }
  }
  // 同一静态构建验证断网与恢复，不因查询失败出现替代登录或交易入口。
  state.offline = true; await page.getByRole("button", { name: "重新查看开放状态" }).click(); await checkClosed(page, false);
  state.offline = false; await page.getByRole("button", { name: "重新查看开放状态" }).click(); await checkClosed(page);
  for (const embedded of [false, true]) {
    const { context: mobile, close: closeMobile } = await isolatedContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true,
      userAgent: `Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1${embedded ? " MicroMessenger/8.0.64" : ""}` });
    const screen = await mobile.newPage();
    assert.equal((await screen.goto(site + "/services/")).status(), 200); await checkClosed(screen);
    deviceChecks.push({ device: embedded ? "wechat-embedded" : "phone-browser", hydration: "passed", purchaseEnabled: false });
    await closeMobile();
  }
  await closeMain();
  const reads = apiRequests.filter((request) => request.method === "GET");
  assert.ok(reads.some((request) => request.path === "/v1/commerce/catalog"));
  assert.ok(reads.some((request) => request.path === "/v1/commerce/catalog?checkoutVariant=alipay-h5-web"));
  assert.ok(reads.every((request) => request.webVersion === null && request.commerceVersion === "2026-10-19" && !request.cookiePresent));
  assert.deepEqual(external, []); assert.deepEqual(failures, []); assert.deepEqual(errors, []);
  await writeFile(`${output}/report.json`, JSON.stringify({ browser: await browser.version(), results, internalLinksChecked: [...checked], deviceChecks,
    apiRequests, externalRequests: external.length, httpFailures: failures, pageErrors: errors,
    mode: "actual static out mapped to canonical origin; all APIs synthetic; prelaunch catalog GET only, no credentials or transaction actions" }, null, 2));
  console.log(`PASS ${paths.length} static routes, ${checked.size} internal links, PC/H5 catalog ${reads.length} synthetic GET, 393/320 responsive and 2 mobile hydration checks; zero external requests/errors`);
} finally { await browser.close(); }
