import { PurchaseClientError, parseSession, text, utc, versioned, type WebSession } from "./protocol.ts";
import { PurchaseTransport } from "./transport.ts";

export type Challenge = Readonly<{ status: "challenge-accepted"; challengeId: string; expiresAtUtc: string }>;
export type AuthenticatedSession = WebSession & Readonly<{ status: "authenticated"; accountId: string }>;
type Mutation = Readonly<{ clientMutationId: string }>;

export class WebIdentityClient {
  readonly transport: PurchaseTransport;
  readonly #journalKey: string;
  #refreshFlight: Promise<WebSession> | null = null;
  readonly #challengeAttempts = new Map<string, Readonly<{ fingerprint: string; result: Promise<Challenge> }>>();
  constructor(transport: PurchaseTransport) {
    this.transport = transport;
    this.#journalKey = `planchime:refresh-intent:v1:${transport.apiOrigin}`;
  }
  newMutation(): Mutation {
    return Object.freeze({ clientMutationId: text(this.transport.runtime.randomUUID()) });
  }
  async #locked<T>(action: () => Promise<T>): Promise<T> {
    this.transport.assertEnabled();
    const locks = this.transport.runtime.locks;
    if (!locks) throw new PurchaseClientError("SESSION_COORDINATION_UNAVAILABLE");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      // GET session 也会 Set-Cookie：与登录、刷新、退出和订单写入共用同源独占锁，避免旧响应覆盖新 Cookie。
      return await locks.request(`planchime:web-session:v1:${this.transport.apiOrigin}`,
        { mode: "exclusive", signal: controller.signal }, async () => action());
    } catch (error) {
      if (error instanceof PurchaseClientError) throw error;
      throw new PurchaseClientError("SESSION_COORDINATION_UNAVAILABLE");
    } finally { clearTimeout(timer); }
  }
  #clearJournal(): void {
    try { this.transport.runtime.storage?.removeItem(this.#journalKey); } catch { /* 不影响已由服务器确认的会话；后续刷新仍会按摘要隔离。 */ }
  }
  async #read(): Promise<WebSession> {
    const session = parseSession(await this.transport.request("/v1/web-auth/session", "identity"));
    if (session.status !== "refresh-required") this.#clearJournal();
    return session;
  }
  getSession(): Promise<WebSession> { return this.#locked(() => this.#read()); }

  async #refresh(session: WebSession): Promise<WebSession> {
    if (session.status !== "refresh-required") return session;
    const runtime = this.transport.runtime;
    if (!runtime.storage) throw new PurchaseClientError("SESSION_COORDINATION_UNAVAILABLE");
    let mutation: string;
    try {
      // 日志只存随机幂等键及 CSRF 的单向摘要，绝不存 Cookie、CSRF 原文、访问/刷新令牌或账号。
      // 请求结果不明时，其他标签页/重新加载后仍沿用同一键，避免刷新令牌轮换被误判为重放攻击。
      const sessionDigest = await runtime.digest(session.csrfToken);
      const raw = runtime.storage.getItem(this.#journalKey);
      const previous = raw === null ? null : JSON.parse(raw);
      mutation = previous?.sessionDigest === sessionDigest ? text(previous.clientMutationId) : this.newMutation().clientMutationId;
      runtime.storage.setItem(this.#journalKey, JSON.stringify({ sessionDigest, clientMutationId: mutation }));
    } catch { throw new PurchaseClientError("SESSION_COORDINATION_UNAVAILABLE"); }
    const result = versioned(await this.transport.request("/v1/web-auth/refresh", "identity",
      { body: { schemaVersion: 1, clientMutationId: mutation }, csrfToken: session.csrfToken }));
    if (result.status !== "authenticated") throw new PurchaseClientError("INVALID_RESPONSE", "unknown");
    const refreshed = Object.freeze({ ...session, status: "authenticated" as const,
      accountId: text(result.accountId), csrfToken: text(result.csrfToken, /^[a-f0-9]{64}$/u) });
    this.#clearJournal();
    // 不记录或重新计算八小时寿命，不启动保活计时器；绝对到期仍由服务器控制。
    return refreshed;
  }
  refreshSession(): Promise<WebSession> {
    if (this.#refreshFlight) return this.#refreshFlight;
    const work = this.#locked(async () => this.#refresh(await this.#read()));
    this.#refreshFlight = work;
    void work.finally(() => { if (this.#refreshFlight === work) this.#refreshFlight = null; }).catch(() => undefined);
    return work;
  }
  async withAuthenticatedSession<T>(action: (session: AuthenticatedSession) => Promise<T>): Promise<T> {
    return this.#locked(async () => {
      const session = await this.#refresh(await this.#read());
      if (session.status !== "authenticated" || session.accountId === null) throw new PurchaseClientError("AUTHENTICATION_REQUIRED");
      return action(session as AuthenticatedSession);
    });
  }
  async requestPhoneChallenge(input: Mutation & Readonly<{ phoneNumber: string }>): Promise<Challenge> {
    const clientMutationId = text(input.clientMutationId);
    const phoneNumber = text(input.phoneNumber, /^\+[1-9][0-9]{7,14}$/u);
    const fingerprint = await this.transport.runtime.digest(phoneNumber);
    const prior = this.#challengeAttempts.get(clientMutationId);
    if (prior) {
      if (prior.fingerprint !== fingerprint) throw new PurchaseClientError("MUTATION_CONFLICT");
      return prior.result;
    }
    if (this.#challengeAttempts.size >= 100) throw new PurchaseClientError("TOO_MANY_ATTEMPTS");
    const result = this.#locked(async () => {
      const session = await this.#read();
      if (session.status !== "anonymous") throw new PurchaseClientError("WEB_ALREADY_SIGNED_IN");
      if (session.phoneOtp !== "available") throw new PurchaseClientError("PHONE_LOGIN_NOT_CONFIGURED");
      const response = versioned(await this.transport.request("/v1/web-auth/phone/challenges", "identity", {
        body: { schemaVersion: 1, clientMutationId, phoneNumber }, csrfToken: session.csrfToken }));
      if (response.status !== "challenge-accepted") throw new PurchaseClientError("INVALID_RESPONSE", "unknown");
      return Object.freeze({ status: "challenge-accepted" as const, challengeId: text(response.challengeId), expiresAtUtc: utc(response.expiresAtUtc) });
    });
    // 本次结果不明也不自动重发短信；用户明确“重新发送”才创建新的操作，仍受后端限流。
    this.#challengeAttempts.set(clientMutationId, { fingerprint, result });
    return result;
  }
  verifyPhone(input: Mutation & Readonly<{ challengeId: string; code: string }>): Promise<WebSession> {
    const body = { schemaVersion: 1, clientMutationId: text(input.clientMutationId), challengeId: text(input.challengeId), code: text(input.code, /^[0-9]{6}$/u) };
    return this.#locked(async () => {
      const session = await this.#read();
      if (session.status !== "anonymous") throw new PurchaseClientError("WEB_ALREADY_SIGNED_IN");
      const response = versioned(await this.transport.request("/v1/web-auth/phone/verify", "identity", { body, csrfToken: session.csrfToken }));
      if (response.status !== "authenticated") throw new PurchaseClientError("INVALID_RESPONSE", "unknown");
      this.#clearJournal();
      // 只表示已有映射身份验证成功，不自动注册、合并或启动日程同步。
      return Object.freeze({ ...session, status: "authenticated" as const, accountId: text(response.accountId),
        csrfToken: text(response.csrfToken, /^[a-f0-9]{64}$/u) });
    });
  }
  logout(input: Mutation): Promise<void> {
    const body = { schemaVersion: 1, clientMutationId: text(input.clientMutationId) };
    return this.#locked(async () => {
      const session = await this.#read();
      if (session.status === "anonymous") return;
      const result = versioned(await this.transport.request("/v1/web-auth/logout", "identity", { body, csrfToken: session.csrfToken }));
      if (result.status !== "logged-out") throw new PurchaseClientError("INVALID_RESPONSE", "unknown");
      this.#clearJournal();
      this.#challengeAttempts.clear();
    });
  }
}
