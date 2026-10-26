import assert from "node:assert/strict";
import test from "node:test";

async function render(path) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("payment-legal", `${process.pid}-${Date.now()}-${path}`);
  const { default: worker } = await import(workerUrl.href);

  const request = new Request(new URL(path, "https://planchime.com"));
  return worker.fetch(request, {
    ASSETS: {
      fetch(assetRequest) {
        return new Response("Not found", { status: 404, headers: assetRequest.headers });
      },
    },
  });
}

test("四个支付相关公开页面使用一致且不过度承诺的事实", async () => {
  const paths = ["/privacy/", "/privacy/data-list/", "/terms/", "/subscription/"];

  for (const path of paths) {
    const response = await render(path);
    assert.equal(response.status, 200, path);
    const html = await response.text();

    // 当前仍处于支付发布准备期，页面必须明确未开售，不能把本地接线写成渠道已批准。
    assert.match(html, /当前.{0,20}(未开放|尚未正式开放|尚未开放|不能视为已开售)/, path);
    // “未获批”这类风险提示本身可以出现；这里仅禁止页面提供会误导用户立即交易的动作。
    assert.doesNotMatch(html, />\s*(立即购买|立即支付)\s*</, path);
  }
});

test("购买说明明确固定期限、免费主题、渠道和主体边界", async () => {
  const response = await render("/subscription/");
  assert.equal(response.status, 200);
  const html = await response.text();

  assert.match(html, /Android 计划中的 Pro 固定期会员/);
  assert.match(html, /固定 30 天/);
  assert.match(html, /不是自动续费订阅/);
  assert.match(html, /原有 8 套主题继续免费/);
  assert.match(html, /米堆（南京）网络科技有限公司/);
  assert.match(html, /浦口区新极光科技经营部/);
  assert.match(html, /Apple StoreKit/);
  assert.match(html, /微信支付与支付宝/);
  assert.match(html, /(当前说明)?不表示微信支付或支付宝已经批准关联/);
  assert.match(html, /固定 30 天仅适用于上述 Android 会员商品/);
  assert.doesNotMatch(html, /[¥￥]\s*\d|免费试用\s*[0-9三]|自动扣款已开启/);
});

test("隐私与数据清单披露最小支付信息并排除支付凭据", async () => {
  const privacy = await (await render("/privacy/")).text();
  const dataList = await (await render("/privacy/data-list/")).text();

  assert.match(privacy, /平台订单标识、交易状态、权益起止时间/);
  assert.match(privacy, /不接收完整银行卡号、支付密码或验证码/);
  assert.match(dataList, /商品、订单与权益状态/);
  assert.match(dataList, /本地接入已准备[、，]当前未(正式)?开售/);
  assert.match(dataList, /微信 OpenSDK 6\.8\.40/);
  assert.match(dataList, /支付宝客户端 SDK 15\.8\.42/);
  assert.match(dataList, /撤回只阻止未来调用该渠道的支付能力/);
  assert.match(dataList, /登录授权不等于支付授权/);
});
