import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createPublicSiteFacts } from "../app/publicSiteFacts.ts";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  let requestUrl = new URL(path, "http://localhost/");
  for (let redirectCount = 0; redirectCount < 4; redirectCount += 1) {
    const response = await worker.fetch(
      new Request(requestUrl, {
        headers: { accept: "text/html" },
      }),
      {
        ASSETS: {
          fetch: async () => new Response("Not found", { status: 404 }),
        },
      },
      {
        waitUntil() {},
        passThroughOnException() {},
      },
    );

    const location = response.headers.get("location");
    if (![301, 302, 307, 308].includes(response.status) || !location) return response;

    // 静态导出会把目录路由统一到尾斜杠；测试跟随站内跳转，验证最终用户实际看到的页面。
    requestUrl = new URL(location, requestUrl);
  }

  throw new Error(`重定向次数过多：${path}`);
}

test("首页呈现 Android 离线首发版的真实能力边界", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>[^<]*记上日成[^<]*<\/title>/i);
  assert.match(html, /把日程稳稳[\s\S]*记在本机。/);
  assert.match(html, /米堆（南京）网络科技有限公司/);
  assert.match(html, /正式版不申请联网权限/);
  assert.match(html, /Android 1\.0 发布准备中/);
  assert.match(html, /完成、稍后与改期/);
  assert.match(html, /name="robots" content="index, follow"/i);
  assert.doesNotMatch(html, /发布前审查稿|隐私政策草案|用户协议草案/);
  assert.doesNotMatch(html, />\s*立即(?:下载|购买)\s*</);
  assert.match(html, /href="mailto:zhangxiao@planchime\.com"/);
  assert.doesNotMatch(html, /iOS 即将上线|App Store 下载|已在 App Store 上线/);
  assert.doesNotMatch(html, /语音或文字快速记事|智能整理只做草稿|按住说话/);
  assert.doesNotMatch(html, /ICP备|公网安备|App 备案/);
  assert.doesNotMatch(html, /Your site is taking shape|Building your site/);
});

test("公开事实仅在通过校验后进入页面配置", () => {
  const facts = createPublicSiteFacts({
    PLANCHIME_APP_STORE_URL: "https://apps.apple.com/cn/app/example/id1234567890",
    PLANCHIME_ICP_NUMBER: "苏ICP备12345678号",
    PLANCHIME_PUBLIC_SECURITY_NUMBER: "苏公网安备 32010000000000号",
    PLANCHIME_PUBLIC_SECURITY_URL: "https://www.beian.gov.cn/portal/registerSystemInfo?recordcode=32010000000000",
    PLANCHIME_APP_FILING_NUMBER: "苏ICP备12345678号-1A",
    PLANCHIME_MONTHLY_STORE_PRICE: "¥12.00/月",
    PLANCHIME_ANNUAL_STORE_PRICE: "¥168.00/年",
  });

  assert.equal(facts.appStoreUrl, "https://apps.apple.com/cn/app/example/id1234567890");
  assert.equal(facts.filings.length, 3);
  assert.deepEqual(facts.storePrices, [
    { product: "月会员", displayPrice: "¥12.00/月" },
    { product: "年会员", displayPrice: "¥168.00/年" },
  ]);
});

test("错误链接、空备案号和非价格文本不会公开", () => {
  const facts = createPublicSiteFacts({
    PLANCHIME_APP_STORE_URL: "https://example.com/fake-app",
    PLANCHIME_ICP_NUMBER: " ",
    PLANCHIME_PUBLIC_SECURITY_NUMBER: "苏公网安备 32010000000000号",
    PLANCHIME_PUBLIC_SECURITY_URL: "https://example.com/fake-record",
    PLANCHIME_MONTHLY_STORE_PRICE: "即将公布",
  });

  assert.equal(facts.appStoreUrl, undefined);
  assert.equal(facts.filings.length, 1);
  assert.equal(facts.filings[0]?.href, undefined);
  assert.deepEqual(facts.storePrices, []);

  const nonProductApplePage = createPublicSiteFacts({
    PLANCHIME_APP_STORE_URL: "https://apps.apple.com/account/subscriptions",
  });
  assert.equal(nonProductApplePage.appStoreUrl, undefined);
});

test("支持页提供 Android 当前版本的可操作说明", async () => {
  const response = await render("/support");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /href="mailto:zhangxiao@planchime\.com"/);
  assert.match(html, /zhangxiao@planchime\.com/);
  assert.match(html, /米堆（南京）网络科技有限公司/);
  assert.match(html, /通知没有出现怎么办/);
  assert.match(html, /Android[\s\S]*设置[\s\S]*应用[\s\S]*记上日成[\s\S]*通知/);
  assert.match(html, /为什么需要精确闹钟特殊访问/);
  assert.match(html, /如何导出数据/);
  assert.match(html, /如何删除本地数据/);
  assert.match(html, /当前有账号、AI、语音、天气或订阅吗/);
  assert.doesNotMatch(html, /iPhone|如何管理或恢复订阅|如何删除账号/);
  assert.doesNotMatch(html, /发布前审查稿|立即下载|立即购买/);
});

test("隐私、数据清单与协议只把 Android 1.0 当前能力写成现行事实", async () => {
  const expected = [
    ["/privacy", /正式安装包不声明互联网访问权限/, /POST_NOTIFICATIONS/],
    ["/privacy/data-list", /正式 APK 与 AAB 的权限清单一致/, /RECEIVE_BOOT_COMPLETED/],
    ["/terms", /无需登录的免费本地日程工具/, /当前不提供账号、云同步/],
  ];

  for (const [path, firstFact, secondFact] of expected) {
    const response = await render(path);
    assert.equal(response.status, 200, path);
    const html = await response.text();
    assert.match(html, /com\.planchime\.app/, path);
    assert.match(html, firstFact, path);
    assert.match(html, secondFact, path);
    assert.doesNotMatch(html, /iPhone“设置|当前适配 qwen|Apple Speech|StoreKit 平台订单/, path);
  }
});

test("联系页免登录公开主体、邮箱与安全提示", async () => {
  const response = await render("/contact");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /href="mailto:zhangxiao@planchime\.com"/);
  assert.match(html, /无需登录/);
  assert.match(html, /米堆（南京）网络科技有限公司/);
  assert.match(html, /中国[^<]*南京/);
  assert.match(html, /请勿发送/);
  assert.match(html, /密码/);
  assert.match(html, /验证码/);
  assert.doesNotMatch(html, /客服电话|办公地址|ICP备案/);
});

test("商店审核所需公共页面可访问、可索引且不是草案", async () => {
  const reviewPaths = [
    "/support",
    "/contact",
    "/privacy",
    "/privacy/data-list",
    "/terms",
    "/subscription",
    "/account-deletion",
  ];

  for (const path of reviewPaths) {
    const response = await render(path);
    assert.equal(response.status, 200, path);
    const html = await response.text();
    assert.match(html, /<title>[^<]*记上日成[^<]*<\/title>/i, path);
    assert.doesNotMatch(html, /name="robots" content="noindex, nofollow"/i, path);
    assert.doesNotMatch(html, /发布前审查稿|草案更新日期|隐私政策草案|用户协议草案/, path);
    assert.doesNotMatch(html, />\s*立即(?:下载|购买)\s*</, path);
  }
});

test("站点地图收录全部正式官网与审核入口", async () => {
  const moduleUrl = new URL("../app/sitemap.ts", import.meta.url);
  moduleUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: createSitemap } = await import(moduleUrl.href);
  const urls = new Set(createSitemap().map((entry) => entry.url));

  for (const url of [
    "https://planchime.com/",
    "https://planchime.com/support",
    "https://planchime.com/contact",
    "https://planchime.com/privacy",
    "https://planchime.com/privacy/data-list",
    "https://planchime.com/terms",
    "https://planchime.com/subscription",
    "https://planchime.com/account-deletion",
  ]) {
    assert.ok(urls.has(url), url);
  }
});

test("robots 公开抓取规则指向正式站点地图", async () => {
  const moduleUrl = new URL("../app/robots.ts", import.meta.url);
  moduleUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: createRobots } = await import(moduleUrl.href);
  const robots = createRobots();
  assert.deepEqual(robots.rules, { userAgent: "*", allow: "/" });
  assert.equal(robots.sitemap, "https://planchime.com/sitemap.xml");
});

test("主题资源与手机端留白规则保留在源码中", async () => {
  const [css, page] = await Promise.all([
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(css, /主题固定为同一套暖纸色/);
  assert.doesNotMatch(css, /prefers-color-scheme:\s*dark/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /@media \(max-width: 720px\)/);
  assert.match(page, /ink-home-district\.jpg/);
  assert.match(page, /ink-reminder-desk\.jpg/);
  assert.match(page, /ink-achievement-evening\.jpg/);
});
