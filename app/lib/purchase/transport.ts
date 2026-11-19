import { COMMERCE_VERSION, PurchaseClientError, WEB_VERSION, object } from "./protocol.ts";

export type PurchaseConfiguration = Readonly<{
  mode?: "disabled" | "prelaunch" | "services" | "sandbox" | "production";
  apiOrigin?: string;
  productionApproved?: boolean;
  /** 服务交付独立审批；即使开启，也不授予订单、支付或微信调用能力。 */
  servicesApproved?: boolean;
  /** 表示网页微信接口已部署；停售由服务端开关控制，不能用此字段隐藏历史订单。 */
  wechatWebConfigured?: boolean;
  timeoutMilliseconds?: number;
}>;
// 当前上线范围仅连接公开目录。切换生产交易仍需独立批准，不能由 URL、存储或环境变量自动开通。
export const purchaseConfiguration: PurchaseConfiguration = Object.freeze({
  mode: "prelaunch", apiOrigin: "https://api.planchime.com", wechatWebConfigured: false,
});
export type PurchaseRuntime = Readonly<{
  origin: string; fetch: typeof fetch; locks: Pick<LockManager, "request"> | undefined;
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> | undefined;
  randomUUID: () => string; digest: (value: string) => Promise<string>; now: () => number;
  canUseDesktopPayment?: () => boolean;
  canUseH5Payment?: () => boolean;
}>;
export function browserRuntime(): PurchaseRuntime {
  let storage: Storage | undefined;
  try { storage = typeof window === "undefined" ? undefined : window.localStorage; } catch { /* 拒绝存储时安全关闭刷新，不降级为竞争轮换。 */ }
  return { origin: typeof window === "undefined" ? "" : window.location.origin, fetch: globalThis.fetch.bind(globalThis),
    locks: globalThis.navigator?.locks, storage, randomUUID: () => globalThis.crypto.randomUUID(), now: () => Date.now(),
    // 仅作前端保守限制，不以视窗宽度替代服务端渠道授权；未知/触屏设备默认不显示续付。
    canUseDesktopPayment: () => typeof navigator !== "undefined" && navigator.maxTouchPoints === 0 && !/Android|iPhone|iPad|Mobile/iu.test(navigator.userAgent),
    // 微信内置浏览器不假装支持外部支付宝收银台；只允许可识别的手机浏览器进入 H5。
    canUseH5Payment: () => typeof navigator !== "undefined" && /Android|iPhone|iPad|Mobile/iu.test(navigator.userAgent) && !/MicroMessenger/iu.test(navigator.userAgent),
    digest: async (value) => Array.from(new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))),
      (byte) => byte.toString(16).padStart(2, "0")).join("") };
}
export class PurchaseTransport {
  readonly #pending = new Set<AbortController>();
  readonly runtime: PurchaseRuntime;
  readonly configuration: PurchaseConfiguration;
  readonly apiOrigin: string;
  constructor(configuration: PurchaseConfiguration = purchaseConfiguration, runtime: PurchaseRuntime = browserRuntime()) {
    this.configuration = Object.freeze({ ...configuration });
    this.runtime = runtime;
    this.apiOrigin = configuration.apiOrigin ?? "";
  }
  assertEnabled(): void {
    if (!["prelaunch", "services", "sandbox", "production"].includes(this.configuration.mode ?? "") ||
        (this.configuration.mode === "services" && this.configuration.servicesApproved !== true) ||
        (this.configuration.mode === "production" && this.configuration.productionApproved !== true)) throw new PurchaseClientError("PURCHASE_DISABLED");
    // 单一规范官网 Origin 统一 Web Locks 范围；www 或外站不能悄悄共享 API Cookie 却绕过协调。
    if (this.runtime.origin !== "https://planchime.com" ||
        !["https://api.planchime.com", "https://planchime.com"].includes(this.apiOrigin)) throw new PurchaseClientError("ORIGIN_CONFIGURATION_REQUIRED");
  }
  /** 退出/切号立即中止在途响应；消费层仍须拒绝旧代际，不能仅依赖浏览器取消。 */
  cancelPendingRequests(): void { for (const controller of this.#pending) controller.abort(); }
  async request(path: string, family: "identity" | "commerce" | "service", options: Readonly<{
    body?: object; csrfToken?: string; idempotencyKey?: string; signal?: AbortSignal;
  }> = {}): Promise<unknown> {
    this.assertEnabled();
    const method = options.body === undefined ? "GET" : "POST";
    // 只开放固定的 H5 目录查询参数，不允许调用方附加金额、返回地址或任意开关。
    const h5Catalog = family === "commerce" && method === "GET" && path === "/v1/commerce/catalog?checkoutVariant=alipay-h5-web";
    // 售前模式只有两条无凭据 GET 白名单；即使页面误调用登录、创单或恢复方法也不能发出请求。
    const publicCatalog = family === "commerce" && method === "GET" && (path === "/v1/commerce/catalog" || h5Catalog);
    if (this.configuration.mode === "prelaunch" && (!publicCatalog || options.csrfToken !== undefined || options.idempotencyKey !== undefined)) throw new PurchaseClientError("PURCHASE_READ_ONLY");
    const serviceIdentity = family === "identity" && (method === "GET" ? path === "/v1/web-auth/session" :
      ["/v1/web-auth/refresh", "/v1/web-auth/logout", "/v1/web-auth/phone/challenges", "/v1/web-auth/phone/verify"].includes(path));
    const servicePath = family === "service" && (method === "GET" ?
      ["/v1/web-pro/usage", "/v1/web-pro/text-consent", "/v1/web-pro/voice-consent"].includes(path) || /^\/v1\/web-pro\/(?:text-drafts|voice-drafts|backups)\/[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(path) || /^\/v1\/web-pro\/backups(?:\?cursor=[A-Za-z0-9][A-Za-z0-9._:-]{0,127})?$/u.test(path) :
      ["/v1/web-pro/text-consent", "/v1/web-pro/text-consent/revoke", "/v1/web-pro/text-drafts", "/v1/web-pro/backups", "/v1/web-pro/voice-consent", "/v1/web-pro/voice-consent/revoke", "/v1/web-pro/voice-drafts"].includes(path) || /^\/v1\/web-pro\/text-drafts\/[A-Za-z0-9][A-Za-z0-9._:-]{0,127}\/cancel$/u.test(path));
    // 固定白名单保证服务已开放、商品可售等任何响应都不能扩大到交易端点。
    if (this.configuration.mode === "services" && !(serviceIdentity || servicePath ||
        (family === "commerce" && method === "GET" && path === "/v1/commerce/entitlements"))) throw new PurchaseClientError("SERVICE_SCOPE_REJECTED");
    if (family === "service" && (this.configuration.mode !== "services" || !servicePath)) throw new PurchaseClientError("SERVICE_SCOPE_REJECTED");
    if (!path.startsWith(family === "identity" ? "/v1/web-auth/" : family === "service" ? "/v1/web-pro/" : "/v1/commerce/") || (/[?#]/u.test(path) && !h5Catalog && !servicePath)) throw new PurchaseClientError("INVALID_REQUEST");
    const headers: Record<string, string> = { Accept: "application/json" };
    // readiness 的公开目录预检只允许 commerce 版本头；身份版本头仅属于正常交易会话。
    if (this.configuration.mode !== "prelaunch") headers["X-Planchime-Web-Version"] = WEB_VERSION;
    if (family === "commerce") headers["X-Appsch-Commerce-Version"] = path.startsWith("/v1/commerce/wechat/") ? "2026-11-09" : COMMERCE_VERSION;
    if (family === "service") headers["X-Planchime-Pro-Version"] = "2026-11-12";
    if (method === "POST") {
      if (!/^[a-f0-9]{64}$/u.test(options.csrfToken ?? "")) throw new PurchaseClientError("SESSION_REQUIRED");
      headers["Content-Type"] = "application/json";
      headers["X-Planchime-CSRF"] = options.csrfToken!;
    }
    if (options.idempotencyKey !== undefined) headers["Idempotency-Key"] = options.idempotencyKey;
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (options.signal?.aborted) throw new PurchaseClientError("REQUEST_CANCELLED");
    options.signal?.addEventListener("abort", abort, { once: true });
    this.#pending.add(controller);
    const timeout = Math.max(100, Math.min(30000, this.configuration.timeoutMilliseconds ?? 10000));
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      // 不使用 Bearer、不允许重定向携带身份数据；写请求没有自动重试。
      const response = await this.runtime.fetch(this.apiOrigin + path, { method, headers,
        credentials: this.configuration.mode === "prelaunch" ? "omit" : "include", cache: "no-store",
        redirect: "error", referrerPolicy: "no-referrer", signal: controller.signal,
        ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }) });
      if (!response.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw new PurchaseClientError("INVALID_RESPONSE", method === "POST" ? "unknown" : "rejected");
      const data = object(await response.json());
      if (controller.signal.aborted) throw new PurchaseClientError("REQUEST_CANCELLED", method === "POST" ? "unknown" : "not-sent");
      if (!response.ok || data.status === "error") {
        const code = typeof data.code === "string" && /^[A-Z][A-Z0-9_]{0,79}$/u.test(data.code) ? data.code : "REQUEST_REJECTED";
        const orderId = typeof data.existingOrderId === "string" && /^[A-Za-z0-9_-]{1,64}$/u.test(data.existingOrderId) ? data.existingOrderId : null;
        throw new PurchaseClientError(code, "rejected", orderId);
      }
      return data;
    } catch (error) {
      if (error instanceof PurchaseClientError) throw error;
      throw new PurchaseClientError(controller.signal.aborted ? "REQUEST_TIMEOUT" : "NETWORK_UNAVAILABLE", method === "POST" ? "unknown" : "not-sent");
    } finally { clearTimeout(timer); this.#pending.delete(controller); options.signal?.removeEventListener("abort", abort); }
  }
}
