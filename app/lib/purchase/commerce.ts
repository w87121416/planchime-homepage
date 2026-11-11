import { validateNativeCodeUrl } from "./native-qr.ts";
import { disclosureRevisionInput } from "./disclosure.ts";
import { PurchaseClientError, checkoutVariant, isWechat, integer, object, parseCatalog, parseOrder, text, utc, versioned,
  type Catalog, type CheckoutVariant, type Order, type Product } from "./protocol.ts";
import { WebIdentityClient } from "./identity.ts";
import { PurchaseTransport, type PurchaseConfiguration, type PurchaseRuntime } from "./transport.ts";
import { PurchaseJournal, type IntentBody, type JournalEntry } from "./journal.ts";

export type PurchaseIntent = Readonly<{ accountId: string; idempotencyKey: string; product: Product;
  body: IntentBody }>;
export type NativeQrPayload = Readonly<{ codeUrl: string; expiresAtUtc: string }>;
export type OrderResult = Readonly<{ status: "created" | "replayed" | "already-settled" | "provider-query-required" | "order-closed";
  order: Order; paymentDestination: string | null; qrCode?: NativeQrPayload }>;
type OwnedEntitlement = Readonly<{ entitlementKey: string; productId: string; accessGranted: boolean;
  lifecycleState: string; validUntil: string | null }>;
export type EntitlementSnapshot = Readonly<{ accountId: string; entitlementRevision: number; evaluatedAt: string;
  entitlements: readonly OwnedEntitlement[] }>;
type IntentState = { intent: PurchaseIntent; orderId: string | null; flight: Promise<OrderResult> | null;
  flightKind: "create" | "continue" | null; blocked: boolean; resumable: boolean; lastOrder: Order | null; journal: JournalEntry };
export type RecoveredIntent = Readonly<{ entry: JournalEntry; order: Order | null }>;
export type PaymentLinkResult = Readonly<{ status: "ready" | "already-settled" | "order-closed" | "order-revoked" | "checkout-disabled" | "provider-query-required";
  order: Order; paymentDestination: string | null; qrCode?: NativeQrPayload }>;

function parseEntitlements(value: unknown, accountId: string): EntitlementSnapshot {
  const response = versioned(value);
  const snapshot = versioned(response.snapshot);
  if (snapshot.authority !== "commerce-service-verified" || snapshot.accountId !== accountId ||
      !Array.isArray(snapshot.entitlements) || snapshot.entitlements.length > 1000) throw new PurchaseClientError("INVALID_RESPONSE");
  const evaluatedAt = utc(snapshot.evaluatedAt);
  const entitlements = snapshot.entitlements.map((value): OwnedEntitlement => {
    const grant = versioned(value);
    const active = ["active-fixed-term", "active-non-renewing", "active-auto-renewing", "auto-renew-off-but-active", "grace"];
    const terminal = ["expired", "refunded", "revoked"];
    if (grant.authority !== "commerce-service-verified" || typeof grant.lifecycleState !== "string" ||
        ![...active, ...terminal].includes(grant.lifecycleState) || grant.accessGranted !== active.includes(grant.lifecycleState)) throw new PurchaseClientError("INVALID_RESPONSE");
    const until = grant.validUntil === null ? null : utc(grant.validUntil);
    if (grant.accessGranted === true && grant.lifecycleState !== "active-non-renewing" &&
        (until === null || (grant.lifecycleState !== "grace" && Date.parse(until) <= Date.parse(evaluatedAt)))) throw new PurchaseClientError("INVALID_RESPONSE");
    return Object.freeze({ entitlementKey: text(grant.entitlementKey), productId: text(grant.productId),
      accessGranted: grant.accessGranted as boolean, lifecycleState: grant.lifecycleState, validUntil: until });
  });
  if (new Set(entitlements.map((entry) => entry.entitlementKey)).size !== entitlements.length) throw new PurchaseClientError("INVALID_RESPONSE");
  return Object.freeze({ accountId, evaluatedAt, entitlementRevision: integer(snapshot.entitlementRevision), entitlements: Object.freeze(entitlements) });
}

function paymentUrl(value: unknown, mode: "sandbox" | "production", order: Order, now: number): string {
  const payload = versioned(value);
  const variant = checkoutVariant(order.checkoutVariant), h5 = variant === "alipay-h5-web";
  if (payload.type !== variant || payload.method !== "GET" || typeof payload.url !== "string" ||
      Date.parse(utc(payload.expiresAtUtc)) <= now) throw new PurchaseClientError("PAYMENT_DESTINATION_REJECTED");
  let url: URL;
  try { url = new URL(payload.url); } catch { throw new PurchaseClientError("PAYMENT_DESTINATION_REJECTED"); }
  if (variant === "wechat-h5") {
    if (!payload.url.startsWith("https://wx.tenpay.com/cgi-bin/mmpayweb-bin/checkmweb?") ||
        url.origin !== "https://wx.tenpay.com" || url.pathname !== "/cgi-bin/mmpayweb-bin/checkmweb" ||
        url.username || url.password || url.hash || /[\u0000-\u0020\\]/u.test(payload.url) ||
        !url.searchParams.get("prepay_id") || url.searchParams.has("redirect_url") ||
        new Set(url.searchParams.keys()).size !== [...url.searchParams.keys()].length ||
        Date.parse(utc(payload.expiresAtUtc)) > Date.parse(utc(payload.orderExpiresAtUtc))) throw new PurchaseClientError("PAYMENT_DESTINATION_REJECTED");
    return payload.url;
  }
  const expected = mode === "production" ? "https://openapi.alipay.com" : "https://openapi-sandbox.dl.alipaydev.com";
  if (url.origin !== expected || url.username || url.password || url.hash || url.pathname !== "/gateway.do" ||
      url.searchParams.get("method") !== (h5 ? "alipay.trade.wap.pay" : "alipay.trade.page.pay") || !url.searchParams.get("sign")) throw new PurchaseClientError("PAYMENT_DESTINATION_REJECTED");
  if (new Set(url.searchParams.keys()).size !== [...url.searchParams.keys()].length) throw new PurchaseClientError("PAYMENT_DESTINATION_REJECTED");
  // 客户端只做纵深校验，不把此 URL 当付款证明；签名和结算仍全部由服务端负责。
  let business: Record<string, unknown>;
  try { business = object(JSON.parse(url.searchParams.get("biz_content") ?? "")); } catch { throw new PurchaseClientError("PAYMENT_DESTINATION_REJECTED"); }
  if (business.out_trade_no !== order.orderId || business.product_code !== (h5 ? "QUICK_WAP_WAY" : "FAST_INSTANT_TRADE_PAY") ||
      business.total_amount !== `${Math.floor(order.amountMinor / 100)}.${String(order.amountMinor % 100).padStart(2, "0")}`) throw new PurchaseClientError("PAYMENT_DESTINATION_REJECTED");
  if (h5) {
    let quit: URL;
    try { quit = new URL(String(business.quit_url)); } catch { throw new PurchaseClientError("PAYMENT_DESTINATION_REJECTED"); }
    if (quit.origin !== "https://planchime.com" || quit.username || quit.password || quit.search || quit.hash) throw new PurchaseClientError("PAYMENT_DESTINATION_REJECTED");
  }
  return url.toString();
}

function launch(value: unknown, mode: "sandbox" | "production", order: Order, now: number): Readonly<{ paymentDestination: string | null; qrCode?: NativeQrPayload }> {
  if (checkoutVariant(order.checkoutVariant) !== "wechat-native") return { paymentDestination: paymentUrl(value, mode, order, now) };
  const payload = versioned(value);
  const expiresAtUtc = utc(payload.expiresAtUtc);
  if (payload.type !== "wechat-native" || Date.parse(expiresAtUtc) <= now) throw new PurchaseClientError("PAYMENT_DESTINATION_REJECTED");
  return { paymentDestination: null, qrCode: Object.freeze({ codeUrl: validateNativeCodeUrl(payload.codeUrl), expiresAtUtc }) };
}
const commercePath = (variant: CheckoutVariant, suffix: string) => `/v1/commerce/${isWechat(variant) ? "wechat/" : ""}${suffix}`;

export class WebPurchaseClient {
  readonly identity: WebIdentityClient;
  readonly #transport: PurchaseTransport;
  readonly #journal: PurchaseJournal;
  readonly #intents = new Map<string, IntentState>();
  readonly #issued = new WeakMap<PurchaseIntent, IntentState>();
  readonly #entitlements = new Map<string, EntitlementSnapshot>();
  #persistenceIssue: string | null = null;
  readonly #orderChannels = new Map<string, CheckoutVariant>();
  get recoveryWarning(): string | null { return this.#persistenceIssue; }
  constructor(configuration?: PurchaseConfiguration, runtime?: PurchaseRuntime) {
    this.#transport = new PurchaseTransport(configuration, runtime);
    this.#journal = new PurchaseJournal(this.#transport.runtime, this.#transport.apiOrigin);
    this.identity = new WebIdentityClient(this.#transport);
  }
  /** 售前页面不挂载交互式登录或购买界面；传输层同时独立限制请求范围。 */
  get isPrelaunch(): boolean { return this.#transport.configuration.mode === "prelaunch"; }
  async getCatalog(variant: CheckoutVariant = "alipay-pc-web"): Promise<Catalog> {
    variant = checkoutVariant(variant);
    const path = isWechat(variant) ? "/v1/commerce/wechat/catalog" : `/v1/commerce/catalog${variant === "alipay-h5-web" ? "?checkoutVariant=alipay-h5-web" : ""}`;
    const raw = versioned(await this.#transport.request(path, "commerce"));
    let value: unknown = raw;
    if (isWechat(variant)) {
      if (typeof raw.checkoutEnabled !== "boolean" || !Array.isArray(raw.products)) throw new PurchaseClientError("INVALID_RESPONSE");
      const products = raw.products.filter((entry) => {
        const product = object(entry);
        if (!Array.isArray(product.checkoutOptions)) throw new PurchaseClientError("INVALID_RESPONSE");
        return product.checkoutOptions.some((item) => {
          const option = object(item);
          return option.checkoutVariant === variant && option.availability === "available" &&
            option.merchantDisplayName === object(product.disclosure).merchantName;
        });
      });
      value = { ...raw, status: raw.checkoutEnabled ? "available" : "configuration-required", products };
    }
    const catalog = parseCatalog(value);
    for (const product of catalog.products) if (product.disclosure &&
        await this.#transport.runtime.digest(disclosureRevisionInput(product, product.disclosure)) !== product.catalogRevision) throw new PurchaseClientError("COMMERCE_CATALOG_REVISION_CONFLICT");
    return Object.freeze({ ...catalog, products: Object.freeze(catalog.products.map((p) => Object.freeze({ ...p, checkoutVariants: Object.freeze([variant]) }))) });
  }
  get checkoutVariant(): CheckoutVariant | null {
    return this.#transport.runtime.canUseH5Payment?.() ? "alipay-h5-web" : this.#transport.runtime.canUseDesktopPayment?.() ? "alipay-pc-web" : null;
  }
  get availableDeviceVariants(): readonly CheckoutVariant[] {
    const alipay = this.checkoutVariant;
    if (!alipay) return [];
    return this.#transport.configuration.wechatWebConfigured ? [alipay, alipay === "alipay-pc-web" ? "wechat-native" : "wechat-h5"] : [alipay];
  }
  canContinue(variant: CheckoutVariant): boolean {
    return variant === "wechat-native" || this.availableDeviceVariants.includes(variant);
  }
  async getAvailableCatalog(): Promise<Catalog> {
    const variants = this.availableDeviceVariants;
    const entries = new Map<string, Product>();
    for (const variant of variants) {
      const catalog = await this.getCatalog(variant);
      for (const product of catalog.products) {
        const prior = entries.get(product.productId);
        // 同一商品跨渠道必须有相同价格、权益与披露修订；不拼接两份相互矛盾的商品。
        if (prior && (prior.catalogRevision !== product.catalogRevision || prior.amountMinor !== product.amountMinor)) throw new PurchaseClientError("COMMERCE_CATALOG_REVISION_CONFLICT");
        entries.set(product.productId, Object.freeze({ ...product, checkoutVariants: Object.freeze([...(prior?.checkoutVariants ?? []), variant]) }));
      }
    }
    return { status: entries.size ? "available" : "configuration-required", checkoutEnabled: entries.size > 0, products: Object.freeze([...entries.values()]) };
  }
  #assertDisclosure(product: Product): void {
    if (product.disclosure ? !product.disclosure.saleReady || !product.disclosure.fulfillmentReady : this.#transport.configuration.mode === "production") {
      throw new PurchaseClientError("COMMERCE_METADATA_REQUIRED");
    }
  }
  #assertDevice(variant: CheckoutVariant): void {
    if (isWechat(variant) && !this.#transport.configuration.wechatWebConfigured) throw new PurchaseClientError("COMMERCE_CONFIGURATION_REQUIRED");
    if (variant === "alipay-h5-web" || variant === "wechat-h5") {
      if (!this.#transport.runtime.canUseH5Payment?.()) throw new PurchaseClientError("H5_PAYMENT_REQUIRED");
    } else if (!this.#transport.runtime.canUseDesktopPayment?.()) throw new PurchaseClientError("DESKTOP_PAYMENT_REQUIRED");
  }
  async #snapshot(accountId: string): Promise<EntitlementSnapshot> {
    const snapshot = parseEntitlements(await this.#transport.request("/v1/commerce/entitlements", "commerce"), accountId);
    const previous = this.#entitlements.get(accountId);
    if (previous && (snapshot.entitlementRevision < previous.entitlementRevision ||
        (snapshot.entitlementRevision === previous.entitlementRevision && JSON.stringify(snapshot.entitlements) !== JSON.stringify(previous.entitlements)))) {
      throw new PurchaseClientError("ENTITLEMENT_REVISION_CONFLICT");
    }
    this.#entitlements.set(accountId, snapshot);
    return snapshot;
  }
  getEntitlements(): Promise<EntitlementSnapshot> { return this.identity.withAuthenticatedSession((session) => this.#snapshot(session.accountId)); }

  /** 仅在用户确认商品、价格与接收账号后调用；此步骤只产生幂等意图，不创建订单或付款。 */
  async confirmPurchase(input: Readonly<{ productId: string; expectedCatalogRevision: string; expectedAccountId: string; userConfirmed: true;
    checkoutVariant?: CheckoutVariant }>): Promise<PurchaseIntent> {
    if (input.userConfirmed !== true) throw new PurchaseClientError("CONFIRMATION_REQUIRED");
    const variant = checkoutVariant(input.checkoutVariant);
    this.#assertDevice(variant);
    text(input.productId); text(input.expectedCatalogRevision); text(input.expectedAccountId);
    return this.identity.withAuthenticatedSession(async (session) => {
      if (session.accountId !== input.expectedAccountId) throw new PurchaseClientError("ACCOUNT_CHANGED");
      const key = `${session.accountId}:${input.productId}`;
      const digest = await this.#journal.digest(session.accountId);
      const saved = this.#journal.read(digest).find((entry) => entry.body.productId === input.productId);
      const prior = this.#intents.get(key);
      if (prior) {
        if (checkoutVariant(prior.intent.body.checkoutVariant) !== variant) throw new PurchaseClientError("RECOVERY_CHANNEL_CHANGED", "not-sent", prior.orderId);
        if (!saved || saved.idempotencyKey !== prior.intent.idempotencyKey || JSON.stringify(saved.body) !== JSON.stringify(prior.intent.body)) throw new PurchaseClientError("RECOVERY_LOG_CHANGED");
        if (prior.blocked || prior.orderId !== null) throw new PurchaseClientError("COMMERCE_PURCHASE_IN_PROGRESS", "not-sent", prior.orderId);
        return prior.intent;
      }
      if (saved) {
        const recovered = await this.#recover(saved, session.accountId, session.csrfToken);
        if (recovered && recovered.status !== "closed") throw new PurchaseClientError("COMMERCE_PURCHASE_IN_PROGRESS", "not-sent", recovered.orderId);
      }
      // 不分渠道创建第二套本机日志；原意图结果未知时，换设备也必须先恢复原操作。
      if (saved && this.#journal.read(digest).some((entry) => entry.idempotencyKey === saved.idempotencyKey) &&
          checkoutVariant(saved.body.checkoutVariant) !== variant) throw new PurchaseClientError("RECOVERY_CHANNEL_CHANGED", "not-sent", saved.orderId);
      const catalog = await this.getCatalog(variant);
      if (!catalog.checkoutEnabled) throw new PurchaseClientError("COMMERCE_CONFIGURATION_REQUIRED");
      const product = catalog.products.find((item) => item.productId === input.productId);
      if (!product) throw new PurchaseClientError("COMMERCE_PRODUCT_UNAVAILABLE");
      this.#assertDisclosure(product);
      if (product.catalogRevision !== input.expectedCatalogRevision) throw new PurchaseClientError("COMMERCE_CATALOG_REVISION_CONFLICT");
      const snapshot = await this.#snapshot(session.accountId);
      // 预检只减少误操作，不能替代后端账号锁与防重购事务；失效快照不授予客户端权益。
      if (snapshot.entitlements.some((grant) => grant.entitlementKey === product.fulfillment.entitlementKey && grant.accessGranted)) {
        throw new PurchaseClientError("COMMERCE_ALREADY_OWNED");
      }
      const remaining = this.#journal.read(digest).find((entry) => entry.body.productId === input.productId);
      if (remaining && (remaining.amountMinor !== product.amountMinor || remaining.body.expectedCatalogRevision !== product.catalogRevision)) throw new PurchaseClientError("RECOVERY_PRICE_CHANGED");
      const body = remaining?.body ?? Object.freeze({ schemaVersion: 1 as const, productId: product.productId, expectedCatalogRevision: product.catalogRevision,
        confirmedAtUtc: new Date(this.#transport.runtime.now()).toISOString(), ...(variant !== "alipay-pc-web" ? { checkoutVariant: variant } : {}) });
      const intent: PurchaseIntent = Object.freeze({ accountId: session.accountId, idempotencyKey: remaining?.idempotencyKey ?? this.identity.newMutation().clientMutationId, product, body });
      const journal: JournalEntry = remaining ?? Object.freeze({ idempotencyKey: intent.idempotencyKey, body, amountMinor: product.amountMinor,
        currency: product.currency, accountDigest: digest, orderId: null, createdAtUtc: body.confirmedAtUtc });
      this.#journal.update(journal);
      const state: IntentState = { intent, orderId: null, flight: null, flightKind: null, blocked: false, resumable: false, lastOrder: null, journal };
      this.#intents.set(key, state); this.#issued.set(intent, state);
      return intent;
    });
  }
  createOrder(intent: PurchaseIntent): Promise<OrderResult> {
    const state = this.#issued.get(intent);
    if (!state) return Promise.reject(new PurchaseClientError("CONFIRMATION_REQUIRED"));
    try { this.#assertDisclosure(intent.product); } catch (error) { return Promise.reject(error); }
    try { this.#assertDevice(checkoutVariant(intent.body.checkoutVariant)); } catch (error) { return Promise.reject(error); }
    // 普通重试不能借用并发的“继续支付”结果得到支付地址。
    if (state.flight) return state.flightKind === "create" ? state.flight : state.flight.then((result) => ({ status: result.status, order: result.order, paymentDestination: null }));
    if (state.blocked && state.orderId === null) return Promise.reject(new PurchaseClientError("PURCHASE_RECONFIRMATION_REQUIRED"));
    return this.#singleFlight(state, "create", () => this.identity.withAuthenticatedSession(async (session): Promise<OrderResult> => {
      if (session.accountId !== intent.accountId) throw new PurchaseClientError("ACCOUNT_CHANGED");
      if (state.blocked && state.orderId !== null && state.lastOrder?.status === "closed") {
        return { status: "replayed", order: await this.#order(state.orderId, session.accountId), paymentDestination: null };
      }
      const saved = this.#journal.read(state.journal.accountDigest).find((entry) => entry.idempotencyKey === intent.idempotencyKey);
      if (!saved || JSON.stringify(saved.body) !== JSON.stringify(intent.body) || saved.amountMinor !== intent.product.amountMinor) throw new PurchaseClientError("RECOVERY_LOG_CHANGED");
      if (saved.orderId !== null && state.orderId === null) state.orderId = saved.orderId;
      if (state.orderId !== null) {
        const order = await this.#order(state.orderId, session.accountId);
        this.#rememberOrder(state, order);
        return { status: "replayed", order, paymentDestination: null };
      }
      if (state.blocked) throw new PurchaseClientError("PURCHASE_RECONFIRMATION_REQUIRED");
      // 每次明确重试先找原单；not-found 也只发送原键/原 body，不把未知结果换成第二单。
      const recovered = await this.#recover(saved, session.accountId, session.csrfToken);
      if (recovered) {
        this.#rememberOrder(state, recovered);
        state.resumable = recovered.status === "awaiting-user-payment";
        return { status: "replayed", order: recovered, paymentDestination: null };
      }
      const catalog = await this.getCatalog(checkoutVariant(intent.body.checkoutVariant));
      if (!catalog.checkoutEnabled) throw new PurchaseClientError("COMMERCE_CONFIGURATION_REQUIRED");
      const current = catalog.products.find((entry) => entry.productId === intent.product.productId);
      if (!current || current.amountMinor !== intent.product.amountMinor || current.catalogRevision !== intent.product.catalogRevision) throw new PurchaseClientError("RECOVERY_PRICE_CHANGED");
      this.#assertDisclosure(current);
      this.#journal.update(saved);
      return this.#postOrder(state, session.csrfToken, false);
    }));
  }

  /** 只供用户明确选择“继续支付原订单”时调用；不导航、不新建意图、不改变原幂等键和确认内容。 */
  continuePayment(intent: PurchaseIntent, input: Readonly<{ expectedOrderId: string; userConfirmed: true }>): Promise<OrderResult> {
    const state = this.#issued.get(intent);
    if (!state || input.userConfirmed !== true) return Promise.reject(new PurchaseClientError("CONFIRMATION_REQUIRED"));
    if (state.orderId === null || state.orderId !== input.expectedOrderId || state.blocked || !state.resumable) {
      return Promise.reject(new PurchaseClientError("ORIGINAL_ORDER_CHECK_REQUIRED", "not-sent", state.orderId));
    }
    if (state.flight) return state.flightKind === "continue" ? state.flight : Promise.reject(new PurchaseClientError("ORIGINAL_ORDER_CHECK_REQUIRED", "not-sent", state.orderId));
    return this.#singleFlight(state, "continue", () => this.identity.withAuthenticatedSession(async (session): Promise<OrderResult> => {
      if (session.accountId !== intent.accountId) throw new PurchaseClientError("ACCOUNT_CHANGED");
      const order = await this.#order(input.expectedOrderId, session.accountId);
      this.#rememberOrder(state, order);
      // 服务器已确认结算、待查或关闭时只展示结果；浏览器经过多长时间不构成关闭证据。
      if (order.status !== "awaiting-user-payment" || order.fulfillmentStatus !== "not-requested") {
        return Object.freeze({ status: "replayed", order, paymentDestination: null });
      }
      const result = await this.#paymentLink(order, session.csrfToken);
      this.#rememberOrder(state, result.order);
      return Object.freeze({ status: "replayed", order: result.order, paymentDestination: result.paymentDestination, ...(result.qrCode ? { qrCode: result.qrCode } : {}) });
    }));
  }
  #singleFlight(state: IntentState, kind: "create" | "continue", action: () => Promise<OrderResult>): Promise<OrderResult> {
    const work = action();
    state.flight = work;
    state.flightKind = kind;
    void work.finally(() => { if (state.flight === work) { state.flight = null; state.flightKind = null; } }).catch(() => undefined);
    return work;
  }
  #rememberOrder(state: IntentState, order: Order): void {
    if (checkoutVariant(order.checkoutVariant) !== checkoutVariant(state.intent.body.checkoutVariant) ||
        order.productId !== state.intent.product.productId || order.amountMinor !== state.intent.product.amountMinor ||
        (state.orderId !== null && state.orderId !== order.orderId)) throw new PurchaseClientError("INVALID_RESPONSE");
    if (state.lastOrder) {
      const { fulfillmentStatus: previousFulfillment, ...previousPayment } = state.lastOrder;
      const { fulfillmentStatus: nextFulfillment, ...nextPayment } = order;
      const stages = ["not-requested", "pending", "delivered", "revoked"];
      // 发放与退款独立更新交付表，不会递增付款订单 revision；同版本仅允许交付向前推进。
      if (order.revision < state.lastOrder.revision || stages.indexOf(nextFulfillment) < stages.indexOf(previousFulfillment) ||
          (order.revision === state.lastOrder.revision && JSON.stringify(nextPayment) !== JSON.stringify(previousPayment))) {
        throw new PurchaseClientError("INVALID_RESPONSE");
      }
    }
    this.#orderChannels.set(`${state.intent.accountId}:${order.orderId}`, checkoutVariant(order.checkoutVariant));
    state.orderId = order.orderId; state.lastOrder = order;
    state.journal = Object.freeze({ ...state.journal, orderId: order.orderId });
    try { if (order.status === "closed") {
      state.blocked = true; state.resumable = false;
      const key = `${state.intent.accountId}:${state.intent.product.productId}`;
      // 只解除这笔已验证关闭的旧意图；旧页面再次查单不能抹掉后来新确认的意图。
      if (this.#intents.get(key) === state) this.#intents.delete(key);
      this.#journal.release(state.journal);
    } else {
      this.#journal.update(state.journal);
    } } catch {
      // 服务端已成功的事实优先保留；不能把第二次本机写入失败谎报成“尚未创建”。
      this.#persistenceIssue = "RECOVERY_RECORD_UPDATE_FAILED";
      throw new PurchaseClientError("RECOVERY_RECORD_UPDATE_FAILED", "unknown", order.orderId);
    }
  }
  async #postOrder(state: IntentState, csrfToken: string, resume: boolean): Promise<OrderResult> {
    const intent = state.intent;
    try {
      const variant = checkoutVariant(intent.body.checkoutVariant);
      const response = versioned(await this.#transport.request(commercePath(variant, "orders"), "commerce", {
        body: isWechat(variant) ? { ...intent.body, clientPurchaseIntentId: intent.idempotencyKey } : intent.body,
        csrfToken, idempotencyKey: intent.idempotencyKey }));
      const status = response.status as OrderResult["status"];
      if (!["created", "replayed", "already-settled", "provider-query-required", "order-closed"].includes(status) ||
          (resume && status === "created")) throw new PurchaseClientError("INVALID_RESPONSE", "unknown");
      const order = parseOrder(response.order);
      const expected = status === "order-closed" ? "closed" : status === "already-settled" ? "settled" :
        status === "provider-query-required" ? "provider-query-required" : "awaiting-user-payment";
      if (order.status !== expected && !(status === "provider-query-required" && isWechat(variant) && order.status === "awaiting-user-payment")) throw new PurchaseClientError("INVALID_RESPONSE", "unknown");
      this.#rememberOrder(state, order);
      state.resumable = !state.blocked && ["created", "replayed"].includes(status);
      // replayed 默认只查原单；只有独立的继续支付确认才返回地址，且绝不自动打开。
      const destination = (status === "created" || (resume && status === "replayed")) &&
        order.status === "awaiting-user-payment" && order.fulfillmentStatus === "not-requested"
        ? launch(response.launchPayload, this.#transport.configuration.mode as "sandbox" | "production", order, this.#transport.runtime.now()) : { paymentDestination: null };
      return Object.freeze({ status, order, ...destination });
    } catch (error) {
      if (error instanceof PurchaseClientError && ["COMMERCE_ALREADY_OWNED", "COMMERCE_PURCHASE_IN_PROGRESS", "COMMERCE_ORDER_CLOSED",
        "COMMERCE_CATALOG_REVISION_CONFLICT", "COMMERCE_IDEMPOTENCY_CONFLICT"].includes(error.code)) {
        state.blocked = true; state.resumable = false;
        if (error.code === "COMMERCE_PURCHASE_IN_PROGRESS" && error.outcome === "rejected" && error.existingOrderId && state.orderId === null) {
          const existing = await this.#order(error.existingOrderId, intent.accountId);
          if (existing.productId !== intent.product.productId) throw new PurchaseClientError("INVALID_RESPONSE", "rejected");
          if (checkoutVariant(existing.checkoutVariant) !== checkoutVariant(intent.body.checkoutVariant)) {
            // 服务端已明确拒绝这次新意图且查到了另一渠道原单；不要把原单写进错误渠道的日志。
            // 只释放被拒绝的本次记录，仍由服务端原单和页面防重购阻止再次购买。
            this.#journal.release(state.journal);
            const key = `${intent.accountId}:${intent.product.productId}`;
            if (this.#intents.get(key) === state) this.#intents.delete(key);
            throw new PurchaseClientError("RECOVERY_CHANNEL_CHANGED", "rejected", existing.orderId);
          }
        }
        if (state.orderId === null) state.orderId = error.existingOrderId;
        if (state.orderId !== null) {
          state.journal = Object.freeze({ ...state.journal, orderId: state.orderId });
          this.#journal.update(state.journal);
        }
        // 只有服务器明确拒绝旧目录且尚无订单时，才允许用户读取新目录后重新确认。
        // 网络未知、幂等冲突或已有订单都不能靠换键重购；旧对象仍保持 blocked，永不再次发送。
        if (error.code === "COMMERCE_CATALOG_REVISION_CONFLICT" && error.outcome === "rejected" &&
            error.existingOrderId === null && state.orderId === null) {
          const key = `${intent.accountId}:${intent.product.productId}`;
          if (this.#intents.get(key) === state) this.#intents.delete(key);
          this.#journal.release(state.journal);
        }
      }
      if (error instanceof PurchaseClientError && error.code === "INVALID_RESPONSE") throw new PurchaseClientError("INVALID_RESPONSE", "unknown", state.orderId);
      throw error;
    }
  }
  /** 新设备也能查本人最近订单；列表不携带支付地址。 */
  listOrders(expectedAccountId: string): Promise<Readonly<{ orders: readonly Order[]; hasMore: boolean }>> {
    return this.identity.withAuthenticatedSession(async (session) => {
      if (session.accountId !== expectedAccountId) throw new PurchaseClientError("ACCOUNT_CHANGED");
      const paths = ["/v1/commerce/orders", ...(this.#transport.configuration.wechatWebConfigured ? ["/v1/commerce/wechat/orders"] : [])];
      const orders: Order[] = []; let hasMore = false;
      for (const path of paths) {
        const response = versioned(await this.#transport.request(path, "commerce"));
        if (!Array.isArray(response.orders) || response.orders.length > 30 || typeof response.hasMore !== "boolean") throw new PurchaseClientError("INVALID_RESPONSE");
        for (const raw of response.orders) {
          const order = parseOrder(raw);
          if (isWechat(checkoutVariant(order.checkoutVariant)) !== path.includes("/wechat/")) throw new PurchaseClientError("INVALID_RESPONSE");
          orders.push(order);
        }
        hasMore ||= response.hasMore;
      }
      if (new Set(orders.map((order) => order.orderId)).size !== orders.length) throw new PurchaseClientError("INVALID_RESPONSE");
      orders.forEach((order) => this.#observeOrder(session.accountId, order));
      orders.sort((a,b) => b.createdAtUtc.localeCompare(a.createdAtUtc));
      return Object.freeze({ orders: Object.freeze(orders.slice(0,30)), hasMore: hasMore || orders.length > 30 });
    });
  }
  async #recover(entry: JournalEntry, accountId: string, csrfToken: string): Promise<Order | null> {
    let order: Order;
    if (entry.orderId) order = await this.#order(entry.orderId, accountId, checkoutVariant(entry.body.checkoutVariant));
    else {
      const variant = checkoutVariant(entry.body.checkoutVariant);
      const response = versioned(await this.#transport.request(commercePath(variant, "order-intents/recover"), "commerce",
        { body: isWechat(variant) ? { schemaVersion: 1, clientPurchaseIntentId: entry.idempotencyKey } : { schemaVersion: 1, idempotencyKey: entry.idempotencyKey },
          csrfToken, ...(isWechat(variant) ? { idempotencyKey: entry.idempotencyKey } : {}) }));
      if (response.status === "not-found") return null;
      if (response.status !== "found") throw new PurchaseClientError("INVALID_RESPONSE");
      order = parseOrder(response.order);
    }
    if (checkoutVariant(order.checkoutVariant) !== checkoutVariant(entry.body.checkoutVariant) ||
        order.productId !== entry.body.productId || order.amountMinor !== entry.amountMinor || order.currency !== entry.currency) throw new PurchaseClientError("RECOVERY_LOG_CHANGED");
    this.#observeOrder(accountId, order);
    if (order.status === "closed") this.#journal.release(entry);
    else this.#journal.update({ ...entry, orderId: order.orderId });
    return order;
  }
  /** 页面加载只查询，不创建、不发短信、不导航；本机记录失效时另用 listOrders 找回。 */
  recoverPurchases(expectedAccountId: string): Promise<readonly RecoveredIntent[]> {
    return this.identity.withAuthenticatedSession(async (session) => {
      if (session.accountId !== expectedAccountId) throw new PurchaseClientError("ACCOUNT_CHANGED");
      const entries = this.#journal.read(await this.#journal.digest(session.accountId));
      const results: RecoveredIntent[] = [];
      for (const entry of entries) results.push(Object.freeze({ entry, order: await this.#recover(entry, session.accountId, session.csrfToken) }));
      return Object.freeze(results);
    });
  }
  async #paymentLink(original: Order, csrfToken: string): Promise<PaymentLinkResult> {
    const { orderId } = original;
    const variant = checkoutVariant(original.checkoutVariant);
    if (variant !== "wechat-native") this.#assertDevice(variant);
    const response = versioned(await this.#transport.request(commercePath(variant, `orders/${orderId}/${isWechat(variant) ? "launch" : "payment-link"}`), "commerce", { body: isWechat(variant) ? {} : { schemaVersion: 1 }, csrfToken }));
    const status = response.status as PaymentLinkResult["status"];
    if (!["ready", "already-settled", "order-closed", "order-revoked", "checkout-disabled", "provider-query-required"].includes(status)) throw new PurchaseClientError("INVALID_RESPONSE");
    const order = parseOrder(response.order);
    if (order.orderId !== orderId || order.productId !== original.productId || order.amountMinor !== original.amountMinor ||
        order.revision < original.revision || checkoutVariant(order.checkoutVariant) !== checkoutVariant(original.checkoutVariant) ||
        (status === "ready" && (order.status !== "awaiting-user-payment" || order.fulfillmentStatus !== "not-requested")) ||
        (status !== "ready" && response.launchPayload !== undefined) || (status === "already-settled" && order.status !== "settled") ||
        (status === "order-closed" && order.status !== "closed") || (status === "order-revoked" && order.fulfillmentStatus !== "revoked")) throw new PurchaseClientError("INVALID_RESPONSE");
    return Object.freeze({ status, order, ...(status === "ready" ? launch(response.launchPayload,
      this.#transport.configuration.mode as "sandbox" | "production", order, this.#transport.runtime.now()) : { paymentDestination: null }) });
  }
  /** 只在再次确认原单后恢复原 URL；跨设备不需要伪造新购买意图。 */
  recoverPaymentLink(orderId: string, expectedAccountId: string, userConfirmed: true): Promise<PaymentLinkResult> {
    if (userConfirmed !== true) return Promise.reject(new PurchaseClientError("CONFIRMATION_REQUIRED"));
    text(orderId, /^[A-Za-z0-9_-]{1,64}$/u);
    return this.identity.withAuthenticatedSession(async (session) => {
      if (session.accountId !== expectedAccountId) throw new PurchaseClientError("ACCOUNT_CHANGED");
      const original = await this.#order(orderId, session.accountId);
      if (["settled", "closed"].includes(original.status) || original.fulfillmentStatus !== "not-requested") return { status: original.status === "closed" ? "order-closed" : original.fulfillmentStatus === "revoked" ? "order-revoked" : "already-settled", order: original, paymentDestination: null };
      const result = await this.#paymentLink(original, session.csrfToken);
      if (result.order.productId !== original.productId || result.order.amountMinor !== original.amountMinor || result.order.revision < original.revision) throw new PurchaseClientError("INVALID_RESPONSE");
      this.#observeOrder(session.accountId, result.order);
      return result;
    });
  }
  #observeOrder(accountId: string, order: Order): void {
    const previousChannel = this.#orderChannels.get(`${accountId}:${order.orderId}`);
    if (previousChannel && previousChannel !== checkoutVariant(order.checkoutVariant)) throw new PurchaseClientError("INVALID_RESPONSE");
    this.#orderChannels.set(`${accountId}:${order.orderId}`, checkoutVariant(order.checkoutVariant));
    const state = this.#intents.get(`${accountId}:${order.productId}`);
    if (state?.orderId === order.orderId) {
      try { this.#rememberOrder(state, order); }
      catch (error) { if (!(error instanceof PurchaseClientError) || error.code !== "RECOVERY_RECORD_UPDATE_FAILED") throw error; }
    }
  }
  async #order(orderId: string, accountId: string, variant?: CheckoutVariant): Promise<Order> {
    text(orderId, /^[A-Za-z0-9_-]{1,64}$/u);
    const known = variant ?? this.#orderChannels.get(`${accountId}:${orderId}`);
    let selected = known ?? "alipay-pc-web";
    let response;
    try { response = versioned(await this.#transport.request(commercePath(selected, `orders/${orderId}`), "commerce")); }
    catch (error) {
      // 跨设备首次打开只有订单号时，最多进行两次受鉴权只读查找；不根据编号猜渠道或创建订单。
      if (known || !this.#transport.configuration.wechatWebConfigured || !(error instanceof PurchaseClientError) || error.code !== "COMMERCE_ORDER_NOT_FOUND") throw error;
      selected = "wechat-native";
      response = versioned(await this.#transport.request(commercePath(selected, `orders/${orderId}`), "commerce"));
    }
    const order = parseOrder(response.order);
    if (order.orderId !== orderId || isWechat(checkoutVariant(order.checkoutVariant)) !== isWechat(selected) ||
        (known && checkoutVariant(order.checkoutVariant) !== known)) throw new PurchaseClientError("INVALID_RESPONSE");
    this.#observeOrder(accountId, order);
    return order;
  }
  getOrder(orderId: string, expectedAccountId: string): Promise<Order> {
    return this.identity.withAuthenticatedSession(async (session) => {
      if (session.accountId !== expectedAccountId) throw new PurchaseClientError("ACCOUNT_CHANGED");
      return this.#order(orderId, session.accountId);
    });
  }
  reconcileOrder(orderId: string, expectedAccountId: string): Promise<Readonly<{ status: string; order: Order | null }>> {
    text(orderId, /^[A-Za-z0-9_-]{1,64}$/u);
    return this.identity.withAuthenticatedSession(async (session) => {
      if (session.accountId !== expectedAccountId) throw new PurchaseClientError("ACCOUNT_CHANGED");
      const original = await this.#order(orderId, session.accountId);
      const response = versioned(await this.#transport.request(commercePath(checkoutVariant(original.checkoutVariant), `orders/${orderId}/reconcile`), "commerce",
        { body: {}, csrfToken: session.csrfToken }));
      if (response.status === "not-settled") return { status: "not-settled", order: null };
      if (!["settled", "duplicate", "already-settled", "closed"].includes(String(response.status))) throw new PurchaseClientError("INVALID_RESPONSE");
      const order = parseOrder(response.order);
      if (order.orderId !== orderId || order.productId !== original.productId || order.amountMinor !== original.amountMinor ||
          checkoutVariant(order.checkoutVariant) !== checkoutVariant(original.checkoutVariant) || order.revision < original.revision ||
          order.status !== (response.status === "closed" ? "closed" : "settled")) throw new PurchaseClientError("INVALID_RESPONSE");
      this.#observeOrder(session.accountId, order);
      return Object.freeze({ status: String(response.status), order });
    });
  }
}
