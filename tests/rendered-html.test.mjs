import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(new URL(path, "http://localhost/"), {
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
}

test("首页呈现真实品牌、主流程与发布状态", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>记上日成 - 日程、待办与提醒<\/title>/i);
  assert.match(html, /说一句，[\s\S]*接下来的事就有安排。/);
  assert.match(html, /米堆（南京）网络科技有限公司/);
  assert.match(html, /AI 只整理草稿/);
  assert.match(html, /iOS 首发准备中/);
  assert.match(html, /name="robots" content="index, follow"/i);
  assert.doesNotMatch(html, /Your site is taking shape|Building your site/);
});

test("支持页可访问且没有虚构下载入口", async () => {
  const response = await render("/support");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /support@planchime\.com/);
  assert.match(html, /尚未开放下载/);
  assert.doesNotMatch(html, /立即下载|立即购买/);
});

test("法律审查稿公开可读但暂不进入搜索索引", async () => {
  for (const path of ["/privacy", "/terms", "/subscription", "/account-deletion"]) {
    const response = await render(path);
    assert.equal(response.status, 200, path);
    const html = await response.text();
    assert.match(html, /name="robots" content="noindex, nofollow"/i, path);
    assert.match(html, /发布前审查稿/, path);
  }
});

test("站点地图只收录已经适合作为官网入口的页面", async () => {
  const response = await render("/sitemap.xml");
  assert.equal(response.status, 200);
  const xml = await response.text();
  assert.match(xml, /https:\/\/planchime\.com\//);
  assert.match(xml, /https:\/\/planchime\.com\/support/);
  assert.doesNotMatch(xml, /\/privacy|\/terms|\/subscription/);
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
