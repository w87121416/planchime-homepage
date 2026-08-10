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

test("首页呈现正式品牌、主流程与真实能力边界", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>[^<]*记上日成[^<]*<\/title>/i);
  assert.match(html, /(?:说一句|把事情交代一句)，[\s\S]*接下来(?:的事)?就有安排。/);
  assert.match(html, /米堆（南京）网络科技有限公司/);
  assert.match(html, /(?:AI 只整理草稿|智能整理只做草稿)/);
  assert.match(html, /name="robots" content="index, follow"/i);
  assert.doesNotMatch(html, /发布前审查稿|隐私政策草案|用户协议草案/);
  assert.doesNotMatch(html, />\s*立即(?:下载|购买)\s*</);
  assert.match(html, /href="mailto:zhangxiao@planchime\.com"/);
  assert.match(html, /iOS 即将上线/);
  assert.doesNotMatch(html, /App Store 下载|已在 App Store 上线/);
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

test("支持页提供可操作的官方联系与常见问题", async () => {
  const response = await render("/support");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /href="mailto:zhangxiao@planchime\.com"/);
  assert.match(html, /zhangxiao@planchime\.com/);
  assert.match(html, /米堆（南京）网络科技有限公司/);
  assert.match(html, /通知没有出现怎么办/);
  assert.match(html, /语音会一直监听吗/);
  assert.match(html, /AI 会直接改变日程吗/);
  assert.match(html, /必须登录才能使用吗/);
  assert.match(html, /如何管理或恢复订阅/);
  assert.match(html, /如何删除账号/);
  assert.doesNotMatch(html, /发布前审查稿|立即下载|立即购买/);
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

test("Apple 审核所需公共页面可访问、可索引且不是草案", async () => {
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

test("站点地图收录全部正式官网与 Apple 审核入口", async () => {
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
