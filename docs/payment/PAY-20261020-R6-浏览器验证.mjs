import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, stat, mkdir, writeFile, readdir } from "node:fs/promises";
import { resolve, extname, sep, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

// 仅验收静态导出：新建无登录态的 Chrome 上下文，网络限制在独立回环端口，不触碰已有 4187 预览。
const root = resolve(process.argv[2] ?? "out");
const evidence = resolve(process.argv[3] ?? "/private/tmp/PAY-20261020-R6-evidence");
const playwrightPath = process.env.R6_PLAYWRIGHT_MODULE ??
  "/Users/xiao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";
const { chromium } = await import(pathToFileURL(playwrightPath).href);
const port = 4193;
const origin = `http://127.0.0.1:${port}`;
const pages = ["/", "/services/", "/support/", "/contact/", "/subscription/", "/download/", "/privacy/", "/privacy/data-list/", "/terms/", "/account-deletion/", "/wechat/"];
const excluded = ["/services/sign-in/", "/services/orders/", "/services/checkout/", "/services/payment-return/", "/services/purchase-info/"];
const report = { generatedAt: new Date().toISOString(), node: process.version, root, origin, browser: "", routes: [], excludedRoutes: [], links: [], externalLinks: [], views: [], interactions: [], featuredLinkContrast: [], pageErrors: [], consoleErrors: [], failedResponses: [], externalRequests: [], outputFiles: [] };
const contentTypes = { ".html": "text/html; charset=utf-8", ".txt": "text/plain; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".xml": "application/xml", ".png": "image/png", ".webp": "image/webp", ".ico": "image/x-icon", ".svg": "image/svg+xml", ".woff2": "font/woff2" };

async function fileFor(pathname) {
  let file = resolve(root, `.${decodeURIComponent(pathname)}`);
  if (file !== root && !file.startsWith(root + sep)) return null;
  try {
    if ((await stat(file)).isDirectory()) file = resolve(file, "index.html");
    return (await stat(file)).isFile() ? file : null;
  } catch { return null; }
}
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, origin);
    const file = await fileFor(url.pathname);
    response.writeHead(file ? 200 : 404, { "content-type": contentTypes[extname(file ?? ".html")] ?? "application/octet-stream", "cache-control": "no-store" });
    response.end(await readFile(file ?? resolve(root, "404.html")));
  } catch {
    response.writeHead(500);
    response.end("Local verification server error");
  }
});
await mkdir(evidence, { recursive: true });
await new Promise((resolveStarted, reject) => {
  server.once("error", reject);
  server.listen(port, "127.0.0.1", resolveStarted);
});
let browser;
let failure;
try {
  browser = await chromium.launch({ channel: "chrome", headless: true });
  report.browser = await browser.version();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce", locale: "zh-CN" });
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) {
      report.externalRequests.push(`${url.origin}${url.pathname}`);
      return route.abort();
    }
    return route.continue();
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => report.pageErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(message.text()); });
  page.on("response", (response) => { if (response.status() >= 400) report.failedResponses.push({ url: response.url(), status: response.status() }); });
  const uniqueLinks = new Map();
  const externalLinks = new Set();
  const domSnapshots = new Map();
  for (const pathname of pages) {
    const response = await page.goto(origin + pathname, { waitUntil: "networkidle" });
    assert.equal(response.status(), 200, pathname);
    await page.locator("h1").first().waitFor();
    const data = await page.evaluate(() => ({
      h1: [...document.querySelectorAll("h1")].map((node) => node.textContent.trim()),
      canonical: document.querySelector('link[rel="canonical"]')?.getAttribute("href"),
      text: document.body.innerText,
      links: [...document.querySelectorAll("a[href]")].map((node) => node.getAttribute("href")),
      ids: [...document.querySelectorAll("[id]")].map((node) => node.id),
      forms: document.querySelectorAll("form,iframe").length,
    }));
    assert.equal(data.h1.length, 1, `${pathname}: h1`);
    assert.equal(data.forms, 0, `${pathname}: 无表单或嵌入支付`);
    assert.doesNotMatch(data.text, /(?:立即购买|立即支付|开通会员)/, pathname);
    report.routes.push({ pathname, status: response.status(), h1: data.h1[0], canonical: data.canonical });
    domSnapshots.set(pathname, data);
    if (pathname === "/contact/" || pathname === "/support/") {
      const colors = await page.locator(".support-card.featured .card-text-link").evaluate((link) => {
        const textStyle = getComputedStyle(link);
        const cardStyle = getComputedStyle(link.closest(".support-card.featured"));
        return { foreground: textStyle.color, background: cardStyle.backgroundColor, underline: textStyle.textDecorationColor, fontSize: textStyle.fontSize };
      });
      const rgb = (color) => color.match(/[\d.]+/g).map(Number);
      const foreground = rgb(colors.foreground);
      const background = rgb(colors.background);
      const alpha = foreground[3] ?? 1;
      // computedStyle 仍可能返回带透明度的白色；先与实际卡片底色合成，再按 sRGB 亮度计算对比度。
      assert.equal(background[3] ?? 1, 1, `${pathname}: 卡片底色应不透明`);
      const blended = foreground.slice(0, 3).map((value, index) => value * alpha + background[index] * (1 - alpha));
      const luminance = (color) => color.slice(0, 3).map((value) => value / 255).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
      const light = luminance(blended);
      const dark = luminance(background);
      const ratio = (Math.max(light, dark) + 0.05) / (Math.min(light, dark) + 0.05);
      report.featuredLinkContrast.push({ pathname, ...colors, blendedForeground: blended, ratio });
      assert.ok(ratio >= 4.5, `${pathname}: 邮箱对比度 ${ratio}`);
      assert.equal(colors.underline, colors.foreground, `${pathname}: 下划线应与可读文字同色`);
    }
    for (const href of data.links) {
      const url = new URL(href, origin + pathname);
      if (url.origin === origin) uniqueLinks.set(url.pathname + url.hash, url);
      else externalLinks.add(href);
    }
  }
  report.externalLinks = [...externalLinks].sort();
  for (const [target, url] of uniqueLinks) {
    const response = await fetch(url);
    assert.equal(response.status, 200, target);
    const html = await response.text();
    if (url.hash) {
      const id = decodeURIComponent(url.hash.slice(1));
      assert.ok(html.includes(`id="${id}"`), `锚点缺失 ${target}`);
    }
    report.links.push({ target, status: response.status, fragmentPresent: url.hash ? true : null });
  }
  for (const pathname of excluded) {
    const response = await fetch(origin + pathname);
    report.excludedRoutes.push({ pathname, status: response.status });
    assert.equal(response.status, 404, pathname);
  }
  const service = domSnapshots.get("/services/");
  assert.match(service.text, /当前可使用的免费服务/);
  assert.match(service.text, /会员与主题：尚未开放购买/);
  assert.match(service.text, /苏ICP备2026061783号-2/);
  assert.doesNotMatch(service.text, /[¥￥]\s*\d/);
  assert.equal(service.canonical, "https://planchime.com/services/");

  for (const view of [
    { name: "services-desktop", path: "/services/", width: 1440, height: 900 },
    { name: "services-mobile-393", path: "/services/", width: 393, height: 852 },
    { name: "services-narrow-320", path: "/services/", width: 320, height: 852 },
    { name: "home-desktop", path: "/", width: 1440, height: 900 },
    { name: "home-mobile-393", path: "/", width: 393, height: 852 },
    { name: "contact-mobile-393", path: "/contact/", width: 393, height: 852 },
    { name: "support-mobile-393", path: "/support/", width: 393, height: 852 },
    { name: "services-csszoom200-320", path: "/services/", width: 640, height: 1704, zoom: 2 },
  ]) {
    await page.setViewportSize({ width: view.width, height: view.height });
    await page.goto(origin + view.path, { waitUntil: "networkidle" });
    if (view.zoom) {
      // CSS 200% 只作为放大排版压力检查，不冒充浏览器原生缩放或人工 VoiceOver 验收。
      await page.addStyleTag({ content: `html { zoom: ${view.zoom}; }` });
    }
    await page.evaluate(async () => {
      for (const image of document.images) {
        image.loading = "eager";
        try { await image.decode(); } catch { /* 下方统一记录损坏图片，避免吞掉检查结论。 */ }
      }
      await document.fonts.ready;
    });
    const metrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      innerWidth: window.innerWidth,
      brokenImages: [...document.images].filter((image) => !image.complete || image.naturalWidth === 0).map((image) => image.getAttribute("src")),
      headingCount: document.querySelectorAll("h1").length,
      reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
    }));
    assert.ok(metrics.scrollWidth <= metrics.clientWidth + 1, `${view.name}: 横向溢出 ${JSON.stringify(metrics)}`);
    assert.deepEqual(metrics.brokenImages, [], view.name);
    const screenshot = resolve(evidence, `${view.name}.png`);
    await page.screenshot({ path: screenshot, fullPage: true, animations: "disabled" });
    report.views.push({ ...view, ...metrics, screenshot });
  }

  // 验证真实可点击的导航与客服说明；不点击站外付款、邮件或商店入口。
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto(origin, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "打开导航菜单" }).click();
  assert.equal(await page.getByRole("button", { name: "关闭导航菜单" }).getAttribute("aria-expanded"), "true");
  await page.getByRole("navigation", { name: "手机导航" }).getByRole("link", { name: "帮助与支持" }).click();
  await page.waitForURL("**/support/");
  report.interactions.push("手机菜单打开并进入帮助");
  await page.locator("summary", { hasText: "会员和主题可以购买了吗" }).click();
  await page.locator("details[open]").getByRole("link", { name: "产品与服务" }).click();
  await page.waitForURL("**/services/");
  report.interactions.push("帮助问答展开并进入产品与服务");
  await page.goto(origin, { waitUntil: "networkidle" });
  await page.getByRole("link", { name: "产品与服务状态" }).click();
  await page.waitForURL("**/services/");
  report.interactions.push("首页常见问题进入产品与服务");
  await page.locator(".site-footer").getByRole("link", { name: "联系我们", exact: true }).click();
  await page.waitForURL("**/contact/");
  await page.locator(".site-footer").getByRole("link", { name: "产品与服务", exact: true }).click();
  await page.waitForURL("**/services/");
  report.interactions.push("页脚进入联系页与服务页");
  await page.goto(origin + "/services/", { waitUntil: "networkidle" });
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement.textContent), "跳到主要内容");
  await page.keyboard.press("Enter");
  assert.equal(new URL(page.url()).hash, "#main-content");
  report.interactions.push("键盘首个入口可跳过导航到主要内容");
  assert.equal(await page.locator("main h2").count(), 6);
  report.interactions.push("服务页一级标题 1 个、二级标题 6 个");
  assert.deepEqual(report.externalRequests, [], "不应发起站外请求");
  assert.deepEqual(report.pageErrors, [], "页面异常");
  assert.deepEqual(report.consoleErrors, [], "控制台异常");
  assert.deepEqual(report.failedResponses, [], "静态资源或浏览页面失败");
  await context.close();
} catch (error) {
  failure = error;
  report.failure = String(error.stack ?? error);
} finally {
  if (browser) await browser.close();
  await new Promise((resolveClosed) => server.close(resolveClosed));
  async function hashFiles(directory) {
    for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = resolve(directory, entry.name);
      if (entry.isDirectory()) await hashFiles(file);
      else if (entry.isFile()) {
        const bytes = await readFile(file);
        report.outputFiles.push({ path: relative(root, file), bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") });
      }
    }
  }
  await hashFiles(root);
  await writeFile(resolve(evidence, "report.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ success: !failure, browser: report.browser, routes: report.routes.length, links: report.links.length, excludedRoutes: report.excludedRoutes, screenshots: report.views.length, interactions: report.interactions, featuredLinkContrast: report.featuredLinkContrast, errors: { page: report.pageErrors, console: report.consoleErrors, responses: report.failedResponses, external: report.externalRequests }, report: resolve(evidence, "report.json"), failure: report.failure }, null, 2));
}
if (failure) process.exitCode = 1;
