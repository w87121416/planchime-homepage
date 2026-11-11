import { parsePurchaseDisclosure, type PurchaseDisclosure } from "./disclosure.ts";
export const WEB_VERSION = "2026-10-19";
export const COMMERCE_VERSION = "2026-10-19";
export type FailureOutcome = "not-sent" | "rejected" | "unknown";

/** 只暴露稳定错误码；不把手机号、支付签名或服务端正文放入异常。 */
export class PurchaseClientError extends Error {
  readonly code: string;
  readonly outcome: FailureOutcome;
  readonly existingOrderId: string | null;
  constructor(code: string, outcome: FailureOutcome = "not-sent", existingOrderId: string | null = null) {
    super(code);
    this.name = "PurchaseClientError";
    this.code = code;
    this.outcome = outcome;
    this.existingOrderId = existingOrderId;
  }
}
export function object(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new PurchaseClientError("INVALID_RESPONSE");
  return value as Record<string, unknown>;
}
export function text(value: unknown, pattern = /^[A-Za-z0-9][A-Za-z0-9:._-]{0,159}$/u): string {
  if (typeof value !== "string" || !pattern.test(value)) throw new PurchaseClientError("INVALID_RESPONSE");
  return value;
}
export function utc(value: unknown): string {
  const result = text(value, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u);
  const expected = result.includes(".") ? result.replace(/\.(\d{1,3})Z$/, (_, digits: string) => `.${digits.padEnd(3, "0")}Z`) : result.replace("Z", ".000Z");
  if (!Number.isFinite(Date.parse(result)) || new Date(result).toISOString() !== expected) throw new PurchaseClientError("INVALID_RESPONSE");
  return result;
}
export function integer(value: unknown, minimum = 0): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum) throw new PurchaseClientError("INVALID_RESPONSE");
  return value;
}
function amount(value: unknown): number {
  const result = integer(value, 1);
  // 与服务端金额上限一致，仍以分的整数表示；超范围响应不得进入金额比较与支付地址校验。
  if (result > 999999999999) throw new PurchaseClientError("INVALID_RESPONSE");
  return result;
}
export function versioned(value: unknown): Record<string, unknown> {
  const result = object(value);
  if (result.schemaVersion !== 1) throw new PurchaseClientError("INVALID_RESPONSE");
  return result;
}
export type WebSession = Readonly<{ status: "anonymous" | "authenticated" | "refresh-required"; accountId: string | null;
  csrfToken: string; phoneOtp: "available" | "configuration-required" }>;
export function parseSession(value: unknown): WebSession {
  const input = versioned(value);
  if (!["anonymous", "authenticated", "refresh-required"].includes(String(input.status)) ||
      !["available", "configuration-required"].includes(String(input.phoneOtp))) throw new PurchaseClientError("INVALID_RESPONSE");
  const accountId = input.status === "authenticated" ? text(input.accountId) : null;
  if (accountId === null && input.accountId !== null) throw new PurchaseClientError("INVALID_RESPONSE");
  return Object.freeze({ status: input.status as WebSession["status"], accountId,
    csrfToken: text(input.csrfToken, /^[a-f0-9]{64}$/u), phoneOtp: input.phoneOtp as WebSession["phoneOtp"] });
}
export type Fulfillment = Readonly<{ kind: "theme"; entitlementKey: string; themeId: string; manifestVersion: string }> |
  Readonly<{ kind: "fixed-term-membership"; entitlementKey: "pro.core"; durationSeconds: 2592000;
    startsAt: "first-delivery"; autoRenews: false; benefitManifest: Readonly<{ version: string; capabilityKeys: readonly string[] }> }>;
export type Product = Readonly<{ productId: string; displayName: string; amountMinor: number; currency: "CNY";
  catalogRevision: string; fulfillment: Fulfillment; disclosure?: PurchaseDisclosure; checkoutVariants?: readonly CheckoutVariant[] }>;
export type Catalog = Readonly<{ status: "available" | "configuration-required"; checkoutEnabled: boolean; products: readonly Product[] }>;
const protectedThemes = new Set(["ink-city.paper", "warm-daily.paper", "prism-studio.night", "business-minimal.graphite",
  "business-minimal.mist-blue", "business-minimal.warm-gray", "sea-salt-island.day", "amber-voyage.night"]);
function parseFulfillment(value: unknown): Fulfillment {
  const item = versioned(value);
  if (item.kind === "theme") {
    const themeId = text(item.themeId, /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u);
    if ([...protectedThemes].some((free) => free === themeId || free.startsWith(`${themeId}.`)) ||
        themeId.startsWith("business-minimal.") || item.entitlementKey !== `theme.${themeId}.owned`) throw new PurchaseClientError("INVALID_RESPONSE");
    return Object.freeze({ kind: "theme", themeId, entitlementKey: item.entitlementKey, manifestVersion: text(item.manifestVersion) });
  }
  if (item.kind !== "fixed-term-membership" || item.entitlementKey !== "pro.core" || item.durationSeconds !== 2592000 ||
      item.startsAt !== "first-delivery" || item.autoRenews !== false) throw new PurchaseClientError("INVALID_RESPONSE");
  const manifest = object(item.benefitManifest);
  const capabilities = ["pro.ai.text-parsing", "pro.ai.voice-parsing", "pro.ai.reflection-letter", "pro.cloud.backup"];
  if (!Array.isArray(manifest.capabilityKeys) || manifest.capabilityKeys.length === 0 ||
      new Set(manifest.capabilityKeys).size !== manifest.capabilityKeys.length ||
      manifest.capabilityKeys.some((key) => !capabilities.includes(key))) throw new PurchaseClientError("INVALID_RESPONSE");
  return Object.freeze({ kind: "fixed-term-membership", entitlementKey: "pro.core", durationSeconds: 2592000,
    startsAt: "first-delivery", autoRenews: false, benefitManifest: Object.freeze({ version: text(manifest.version),
      capabilityKeys: Object.freeze([...manifest.capabilityKeys]) }) });
}
export function parseCatalog(value: unknown): Catalog {
  const input = versioned(value);
  if (!["available", "configuration-required"].includes(String(input.status)) || typeof input.checkoutEnabled !== "boolean" ||
      !Array.isArray(input.products) || input.products.length > 100) throw new PurchaseClientError("INVALID_RESPONSE");
  if (input.status === "configuration-required" || !input.checkoutEnabled) {
    // 配置关闭后不把缓存或附带商品作为可售目录。
    return Object.freeze({ status: "configuration-required", checkoutEnabled: false, products: Object.freeze([]) });
  }
  const products = input.products.map((raw): Product => {
    const product = object(raw);
    if (product.currency !== "CNY" || typeof product.displayName !== "string" || product.displayName.trim().length === 0 ||
        product.displayName.length > 256 || /[\u0000-\u001f]/u.test(product.displayName)) throw new PurchaseClientError("INVALID_RESPONSE");
    return Object.freeze({ productId: text(product.productId), displayName: product.displayName,
      amountMinor: amount(product.amountMinor), currency: "CNY", catalogRevision: text(product.catalogRevision),
      fulfillment: parseFulfillment(product.fulfillment),
      ...(product.disclosure === undefined ? {} : { disclosure: parsePurchaseDisclosure(product.disclosure) }) });
  });
  if (new Set(products.map((product) => product.productId)).size !== products.length) throw new PurchaseClientError("INVALID_RESPONSE");
  return Object.freeze({ status: "available", checkoutEnabled: products.length > 0, products: Object.freeze(products) });
}
export type CheckoutVariant = "alipay-pc-web" | "alipay-h5-web" | "wechat-native" | "wechat-h5";
export const isWechat = (value: CheckoutVariant) => value === "wechat-native" || value === "wechat-h5";
/** 旧订单未携带渠道时仍按 PC 解释，未知渠道不能默认为另一种付款方式。 */
export function checkoutVariant(value: unknown): CheckoutVariant {
  if (value === undefined || value === "alipay-pc-web") return "alipay-pc-web";
  if (value === "alipay-h5-web" || value === "wechat-native" || value === "wechat-h5") return value;
  throw new PurchaseClientError("INVALID_RESPONSE");
}
export type Order = Readonly<{ orderId: string; productId: string; amountMinor: number; currency: "CNY";
  checkoutVariant?: Exclude<CheckoutVariant, "alipay-pc-web">; merchantDisplayName?: string;
  status: "intent-created" | "awaiting-user-payment" | "provider-query-required" | "settled" | "closed";
  revision: number; createdAtUtc: string; updatedAtUtc: string;
  fulfillmentStatus: "pending" | "delivered" | "revoked" | "not-requested" }>;
export function parseOrder(value: unknown): Order {
  const order = object(value);
  const variant = checkoutVariant(order.checkoutVariant);
  if (order.currency !== "CNY" || !["intent-created", "awaiting-user-payment", "provider-query-required", "settled", "closed"].includes(String(order.status)) ||
      !["pending", "delivered", "revoked", "not-requested"].includes(String(order.fulfillmentStatus)) ||
      (["delivered", "revoked"].includes(String(order.fulfillmentStatus)) && order.status !== "settled")) throw new PurchaseClientError("INVALID_RESPONSE");
  return Object.freeze({ orderId: text(order.orderId, /^[A-Za-z0-9_-]{1,64}$/u), productId: text(order.productId),
    amountMinor: amount(order.amountMinor), currency: "CNY", status: order.status as Order["status"],
    revision: integer(order.revision), createdAtUtc: utc(order.createdAtUtc), updatedAtUtc: utc(order.updatedAtUtc),
    fulfillmentStatus: order.fulfillmentStatus as Order["fulfillmentStatus"],
    ...(variant !== "alipay-pc-web" ? { checkoutVariant: variant } : {}),
    ...(order.merchantDisplayName === undefined ? {} : { merchantDisplayName: text(order.merchantDisplayName, /^[^\u0000-\u001f\u007f]{1,160}$/u) }) });
}
/** 仅消费受鉴权 API 的订单，不接受返回页/SDK 成功文案作为付款证明。 */
export function orderProgress(order: Order): "pending" | "payment-verification-required" | "paid-delivery-pending" | "delivered" | "revoked" | "closed" {
  if (order.fulfillmentStatus === "revoked") return "revoked";
  if (order.status === "closed") return "closed";
  if (order.status === "settled") return order.fulfillmentStatus === "delivered" ? "delivered" : "paid-delivery-pending";
  return order.status === "provider-query-required" ? "payment-verification-required" : "pending";
}
