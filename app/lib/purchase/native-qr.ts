import qrcode from "./vendor/qrcode-generator/qrcode.mjs";
import { PurchaseClientError } from "./protocol.ts";

/** 只接受经过订单归属检查后取得的微信载荷；本校验不证明订单已付款。 */
export function validateNativeCodeUrl(value: unknown): string {
  if (typeof value !== "string" || value.length > 2048 || /\s/u.test(value)) throw new PurchaseClientError("PAYMENT_DESTINATION_REJECTED");
  let url: URL;
  try { url = new URL(value); } catch { throw new PurchaseClientError("PAYMENT_DESTINATION_REJECTED"); }
  if (url.protocol !== "weixin:" || url.hostname !== "wxpay" || url.port || url.pathname !== "/bizpayurl" ||
      url.username || url.password || url.hash || url.searchParams.size !== 1 ||
      !/^[A-Za-z0-9_-]{1,512}$/u.test(url.searchParams.get("pr") ?? "")) throw new PurchaseClientError("PAYMENT_DESTINATION_REJECTED");
  return value;
}

/** 二维码在浏览器本地生成，不把支付地址发给第三方；固定四模块静区且不混入图标、文字。 */
export function createWechatNativeQr(codeUrl: string, targetPixels: 240 | 256 = 256): Readonly<{
  dataUrl: string; pixels: number; modules: number; quietModules: 4; pixelsPerModule: number;
}> {
  const payload = validateNativeCodeUrl(codeUrl);
  if (targetPixels !== 240 && targetPixels !== 256) throw new PurchaseClientError("QR_RENDER_FAILED");
  try {
    const matrix = qrcode(0, "M");
    matrix.addData(payload, "Byte");
    matrix.make();
    const modules = matrix.getModuleCount(), total = modules + 8;
    const pixelsPerModule = Math.floor(targetPixels / total), pixels = total * pixelsPerModule;
    // 真实像素按完整模块取整，禁止把过密图案缩成无法识别的装饰图。
    if (pixelsPerModule < 2) throw new Error("density");
    const blocks: string[] = [];
    for (let row = 0; row < modules; row++) for (let column = 0; column < modules; column++) {
      if (matrix.isDark(row, column)) blocks.push(`M${(column + 4) * pixelsPerModule} ${(row + 4) * pixelsPerModule}h${pixelsPerModule}v${pixelsPerModule}h-${pixelsPerModule}z`);
    }
    // SVG 仅含内部生成的数值路径；支付 URL 不进入标记、日志或可朗读文案。
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${pixels}" height="${pixels}" viewBox="0 0 ${pixels} ${pixels}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="white"/><path fill="black" d="${blocks.join("")}"/></svg>`;
    return Object.freeze({ dataUrl: `data:image/svg+xml,${encodeURIComponent(svg)}`, pixels, modules, quietModules: 4, pixelsPerModule });
  } catch {
    throw new PurchaseClientError("QR_RENDER_FAILED");
  }
}
