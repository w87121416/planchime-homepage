import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { chromium } from "/Users/xiao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";
import { createWechatNativeQr, validateNativeCodeUrl } from "../../app/lib/purchase/native-qr.ts";

// 只编码明确不可支付的合成内容；用 macOS Vision 独立解码真实浏览器渲染结果，避免同一算法自证。
const directory = process.env.PLANCHIME_QA_OUTPUT ?? "/private/tmp/PAY-20261109-B6-QR";
if (!directory.startsWith("/private/tmp/PAY-")) throw new Error("isolated QA directory required");
await mkdir(directory, { recursive: true });
const decoder = `${directory}/decode.swift`;
await writeFile(decoder, `import Foundation
import Vision
import AppKit
let url = URL(fileURLWithPath: CommandLine.arguments[1])
let request = VNDetectBarcodesRequest()
request.symbologies = [.qr]
try VNImageRequestHandler(url: url).perform([request])
let values = (request.results ?? []).compactMap { $0.payloadStringValue }
print(String(data: try JSONSerialization.data(withJSONObject: values), encoding: .utf8)!)
`);
for (const bad of ["https://evil.test", "weixin://wxpay.evil.test/bizpayurl?pr=x", "weixin://wxpay/bizpayurl?pr=x&pr=y", "weixin://wxpay/bizpayurl?pr=x#y", "weixin://u@wxpay/bizpayurl?pr=x", "weixin://wxpay/bizpayurl?pr=%20"]) {
  assert.throws(() => validateNativeCodeUrl(bad));
}
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = [];
let outbound = 0;
try {
  const context = await browser.newContext();
  await context.route("**/*", route => { outbound++; return route.abort(); });
  const page = await context.newPage();
  for (const [name, token] of [["short", "SYNTHETIC_NOT_A_PAYABLE_TOKEN_20261109"], ["long", "SYNTHETIC_NOT_PAYABLE_".padEnd(512, "X")]]) {
    const original = `weixin://wxpay/bizpayurl?pr=${token}`;
    for (const size of [240, 256]) {
      const qr = createWechatNativeQr(original, size);
      assert.equal(qr.quietModules, 4);
      assert.equal(qr.pixels, (qr.modules + 8) * qr.pixelsPerModule);
      assert.ok(qr.pixels <= size && qr.pixelsPerModule >= 2);
      await page.setContent(`<img alt="合成测试二维码，不可付款" src="${qr.dataUrl}" width="${qr.pixels}" height="${qr.pixels}">`);
      await page.locator("img").evaluate(img => img.decode());
      const path = `${directory}/${name}-${size}.png`;
      await page.locator("img").screenshot({ path });
      const result = execFileSync("/usr/bin/swift", ["-module-cache-path", `${directory}/swift-cache`, decoder, path], { encoding: "utf8", timeout: 60000 });
      assert.deepEqual(JSON.parse(result), [original]);
      results.push({ name, requestedPixels: size, actualPixels: qr.pixels, modules: qr.modules, quietModules: qr.quietModules, exactDecodedPayload: true });
    }
  }
  assert.equal(outbound, 0);
  await writeFile(`${directory}/report.json`, JSON.stringify({ synthetic: true, payable: false, browser: await browser.version(), outbound, results }, null, 2));
  console.log(`PASS ${results.length} actual-size QR renders independently decoded; 6 invalid destinations rejected; 0 network calls`);
} finally { await browser.close(); }
