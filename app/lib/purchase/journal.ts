import { PurchaseClientError, checkoutVariant, integer, object, text, utc, type CheckoutVariant } from "./protocol.ts";
import type { PurchaseRuntime } from "./transport.ts";

export type IntentBody = Readonly<{ schemaVersion: 1; productId: string; expectedCatalogRevision: string; confirmedAtUtc: string;
  checkoutVariant?: Exclude<CheckoutVariant, "alipay-pc-web"> }>;
export type JournalEntry = Readonly<{ idempotencyKey: string; body: IntentBody; amountMinor: number; currency: "CNY";
  accountDigest: string; orderId: string | null; createdAtUtc: string }>;
const exact = (value: unknown, keys: string[]) => {
  const item = object(value);
  if (Object.keys(item).sort().join() !== keys.sort().join()) throw new Error("shape");
  return item;
};

/** 只能在身份客户端的同一个独占 Web Lock 内使用；日志不是身份或付款凭证。 */
export class PurchaseJournal {
  readonly runtime: PurchaseRuntime;
  readonly apiOrigin: string;
  constructor(runtime: PurchaseRuntime, apiOrigin: string) { this.runtime = runtime; this.apiOrigin = apiOrigin; }
  async digest(accountId: string): Promise<string> {
    return text(await this.runtime.digest(`planchime:purchase-account:v1\0${this.apiOrigin}\0${accountId}`), /^[a-f0-9]{64}$/u);
  }
  key(digest: string): string { return `planchime:purchase-intents:v1:${digest}`; }
  parse(raw: string, digest: string): readonly JournalEntry[] {
    try {
      if (raw.length > 65536) throw new Error("size");
      const root = exact(JSON.parse(raw), ["schemaVersion", "entries"]);
      if (root.schemaVersion !== 1 || !Array.isArray(root.entries) || root.entries.length > 30) throw new Error("version");
      const entries = root.entries.map((value): JournalEntry => {
        const item = exact(value, ["idempotencyKey", "body", "amountMinor", "currency", "accountDigest", "orderId", "createdAtUtc"]);
        const rawBody = object(item.body);
        // 旧 PC 日志格式不变；其余渠道必须显式保留，恢复不能重新按设备选渠道。
        const variant = checkoutVariant(rawBody.checkoutVariant);
        const body = exact(rawBody, ["schemaVersion", "productId", "expectedCatalogRevision", "confirmedAtUtc", ...(variant !== "alipay-pc-web" ? ["checkoutVariant"] : [])]);
        const created = utc(item.createdAtUtc), confirmed = utc(body.confirmedAtUtc), price = integer(item.amountMinor, 1);
        // 30 天只是本机恢复句柄的最长可信时间，不代表订单到期或账本保留期限；过期后仍可查服务端订单。
        const age = this.runtime.now() - Date.parse(created);
        if (body.schemaVersion !== 1 || item.accountDigest !== digest || item.currency !== "CNY" || price > 999999999999 ||
            age < -60000 || age > 30 * 86400000 || confirmed !== created) throw new Error("binding");
        return Object.freeze({ idempotencyKey: text(item.idempotencyKey), accountDigest: digest, amountMinor: price, currency: "CNY",
          orderId: item.orderId === null ? null : text(item.orderId, /^[A-Za-z0-9_-]{1,64}$/u), createdAtUtc: created,
          body: Object.freeze({ schemaVersion: 1, productId: text(body.productId), expectedCatalogRevision: text(body.expectedCatalogRevision), confirmedAtUtc: confirmed,
            ...(variant !== "alipay-pc-web" ? { checkoutVariant: variant } : {}) }) });
      });
      if (new Set(entries.map((e) => e.body.productId)).size !== entries.length || new Set(entries.map((e) => e.idempotencyKey)).size !== entries.length) throw new Error("duplicate");
      return Object.freeze(entries);
    } catch { throw new PurchaseClientError("RECOVERY_LOG_INVALID"); }
  }
  read(digest: string): readonly JournalEntry[] {
    if (!this.runtime.storage) throw new PurchaseClientError("RECOVERY_STORAGE_UNAVAILABLE");
    let raw: string | null;
    try { raw = this.runtime.storage.getItem(this.key(digest)); } catch { throw new PurchaseClientError("RECOVERY_STORAGE_UNAVAILABLE"); }
    return raw === null ? [] : this.parse(raw, digest);
  }
  write(digest: string, entries: readonly JournalEntry[]): void {
    const raw = JSON.stringify({ schemaVersion: 1, entries });
    this.parse(raw, digest);
    try {
      if (!this.runtime.storage) throw new Error("storage");
      this.runtime.storage.setItem(this.key(digest), raw);
      // 写入后读回，拒绝静默丢写；持久化不可靠时绝不发送创建订单请求。
      if (this.runtime.storage.getItem(this.key(digest)) !== raw) throw new Error("write");
    } catch { throw new PurchaseClientError("RECOVERY_STORAGE_UNAVAILABLE"); }
  }
  update(entry: JournalEntry): void {
    const entries = this.read(entry.accountDigest);
    const prior = entries.find((e) => e.body.productId === entry.body.productId);
    if (prior && (prior.idempotencyKey !== entry.idempotencyKey || JSON.stringify(prior.body) !== JSON.stringify(entry.body) ||
        prior.amountMinor !== entry.amountMinor || (prior.orderId !== null && prior.orderId !== entry.orderId))) throw new PurchaseClientError("RECOVERY_LOG_CHANGED");
    this.write(entry.accountDigest, [...entries.filter((e) => e.body.productId !== entry.body.productId), entry]);
  }
  release(entry: JournalEntry): void {
    const entries = this.read(entry.accountDigest);
    // 只释放服务器明确关闭/创建前拒绝的精确旧键，不删除其他账号、产品或浏览器存储。
    this.write(entry.accountDigest, entries.filter((e) => e.idempotencyKey !== entry.idempotencyKey));
  }
}
