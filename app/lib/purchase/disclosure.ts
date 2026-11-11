/** 服务端商品说明是确认内容的一部分；变更任一事实都必须更换目录修订，避免按旧说明成交。 */
export type PurchaseDisclosure = Readonly<{
  schemaVersion: 1; merchantName: string; deliverySummary: string; exclusions: readonly string[];
  compatibility: readonly Readonly<{ platform: "ios" | "android" | "wechat-mini" | "web"; minimumVersion: string }>[];
  refundPolicy: Readonly<{ version: string; summary: string; url: string }>;
  saleReady: boolean; fulfillmentReady: boolean;
}>;
const invalid = () => new TypeError("COMMERCE_DISCLOSURE_INVALID");
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid();
  return value as Record<string, unknown>;
}
function line(value: unknown, max = 300): string {
  if (typeof value !== "string" || !value.trim() || value !== value.trim() || value.length > max || /[\u0000-\u001f]/u.test(value)) throw invalid();
  return value;
}
export function parsePurchaseDisclosure(value: unknown): PurchaseDisclosure {
  const d = record(value), refund = record(d.refundPolicy);
  if (d.schemaVersion !== 1 || Object.keys(d).length !== 8 ||
      d.merchantName !== "米堆（南京）网络科技有限公司" || typeof d.saleReady !== "boolean" || typeof d.fulfillmentReady !== "boolean" ||
      !Array.isArray(d.exclusions) || d.exclusions.length > 12 || !Array.isArray(d.compatibility) || !d.compatibility.length || d.compatibility.length > 4 ||
      Object.keys(refund).length !== 3) throw invalid();
  const compatibility = d.compatibility.map((raw) => {
    const c = record(raw);
    if (Object.keys(c).length !== 2 || !["ios", "android", "wechat-mini", "web"].includes(String(c.platform)) ||
        typeof c.minimumVersion !== "string" || !/^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/u.test(c.minimumVersion)) throw invalid();
    return Object.freeze({ platform: c.platform as PurchaseDisclosure["compatibility"][number]["platform"], minimumVersion: line(c.minimumVersion, 64) });
  });
  if (new Set(compatibility.map((c) => c.platform)).size !== compatibility.length) throw invalid();
  // 退款入口只能是本产品固定官网说明，不把服务端任意链接变成付款前外跳入口。
  if (refund.url !== "https://planchime.com/services/purchase-info/") throw invalid();
  return Object.freeze({ schemaVersion: 1, merchantName: d.merchantName, deliverySummary: line(d.deliverySummary),
    exclusions: Object.freeze(d.exclusions.map((v) => line(v))), compatibility: Object.freeze(compatibility),
    refundPolicy: Object.freeze({ version: line(refund.version, 64), summary: line(refund.summary), url: refund.url }),
    saleReady: d.saleReady, fulfillmentReady: d.fulfillmentReady });
}
/** 两个独立仓库使用同一规范编码；忽略服务端 fulfillment 的传输 schemaVersion，不忽略实际交付语义。 */
export function disclosureRevisionInput(product: Readonly<{ productId: string; displayName: string; amountMinor: number;
  currency: string; fulfillment: unknown }>, disclosure: PurchaseDisclosure): string {
  const fulfillment = { ...record(product.fulfillment) };
  delete fulfillment.schemaVersion;
  const canonical = (v: unknown): unknown => Array.isArray(v) ? v.map(canonical) : v !== null && typeof v === "object"
    ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, x]) => [k, canonical(x)])) : v;
  return JSON.stringify(canonical({ schemaVersion: 1, productId: product.productId, displayName: product.displayName,
    amountMinor: product.amountMinor, currency: product.currency, fulfillment, disclosure }));
}
