import { WebPurchaseClient, type EntitlementSnapshot } from "../purchase/commerce.ts";
import { PurchaseClientError, text, utc, type WebSession } from "../purchase/protocol.ts";
import type { PurchaseRuntime } from "../purchase/transport.ts";
import { AI_POLICY, accountResponse, parseConsent, parseTextDraft, parseUsage, type ServiceUsage, type TextConsent, type TextDraft } from "./protocol.ts";
import { serviceConfiguration, type ServiceConfiguration } from "./config.ts";
import { backupVersion, parseBackupList, parseDownloadedBackup, type BackupList, type BackupVersion, type DownloadedBackup } from "./backup.ts";
import { parseDocument, type PlannerDocument } from "../planner/model.ts";

export interface MemberServicePort {
  readonly configuration: ServiceConfiguration;
  getSession(): Promise<WebSession>;
  getEntitlements(): Promise<EntitlementSnapshot>;
  usage(accountId: string, signal: AbortSignal): Promise<ServiceUsage>;
  consent(accountId: string, signal: AbortSignal): Promise<TextConsent | null>;
  grant(accountId: string, recordId: string, signal: AbortSignal): Promise<TextConsent>;
  revoke(accountId: string, consent: TextConsent, signal: AbortSignal): Promise<void>;
  create(accountId: string, input: TextRequest, signal: AbortSignal): Promise<TextDraft>;
  read(accountId: string, requestId: string, signal: AbortSignal): Promise<TextDraft>;
  cancel(accountId: string, requestId: string, signal: AbortSignal): Promise<TextDraft>;
  sendCode(phoneNumber: string): Promise<{ challengeId: string }>;
  verify(challengeId: string, code: string): Promise<WebSession>;
  logout(): Promise<void>;
  abort(): void;
  uuid(): string;
  pending(accountId: string, kind?: "text" | "backup"): Promise<string | null>;
  remember(accountId: string, requestId: string | null, kind?: "text" | "backup", expectedRequestId?: string): Promise<void>;
  backups(accountId: string, signal: AbortSignal, cursor?: string): Promise<BackupList>;
  uploadBackup(accountId: string, requestId: string, document: PlannerDocument, signal: AbortSignal): Promise<BackupVersion>;
  downloadBackup(accountId: string, requestId: string, signal: AbortSignal): Promise<DownloadedBackup>;
}
export type TextRequest = Readonly<{ requestId: string; sourceText: string; referenceInstant: string; timeZoneId: string; consentRecordId: string }>;

export class WebMemberServiceClient implements MemberServicePort {
  readonly configuration: ServiceConfiguration;
  readonly #commerce: WebPurchaseClient;
  constructor(configuration = serviceConfiguration, runtime?: PurchaseRuntime) {
    this.configuration = Object.freeze({ ...configuration, transport: Object.freeze({ ...configuration.transport }) });
    this.#commerce = new WebPurchaseClient(this.configuration.transport, runtime);
  }
  uuid() { return this.#commerce.identity.newMutation().clientMutationId; }
  async #pendingKey(accountId: string, kind: "text" | "backup") { return `planchime:web-pro:${kind}:pending:v1:${await this.#commerce.identity.transport.runtime.digest(accountId)}`; }
  async pending(accountId: string, kind: "text" | "backup" = "text") {
    try {
      const stored = this.#commerce.identity.transport.runtime.storage?.getItem(await this.#pendingKey(accountId, kind));
      return stored ? text(stored) : null;
    } catch { throw new PurchaseClientError("SERVICE_RECOVERY_UNAVAILABLE"); }
  }
  async remember(accountId: string, requestId: string | null, kind: "text" | "backup" = "text", expectedRequestId?: string) {
    try {
      const { storage, locks } = this.#commerce.identity.transport.runtime;
      if (!storage || !locks) throw new Error();
      const key = await this.#pendingKey(accountId, kind);
      // 只留账号摘要分区下的随机原请求号；不保存正文、草稿、额度或会话秘密。
      await locks.request(key, { mode: "exclusive" }, async () => {
        const previous = storage.getItem(key);
        // 跨标签先占用同一恢复槽；旧页不能覆盖另一页未核实的请求或清除新任务的凭据。
        if (requestId === null) {
          if (!expectedRequestId || (previous !== null && previous !== expectedRequestId)) throw new PurchaseClientError("SERVICE_REQUEST_PENDING");
          storage.removeItem(key); if (storage.getItem(key) !== null) throw new Error();
        } else {
          if (previous !== null && previous !== requestId) throw new PurchaseClientError("SERVICE_REQUEST_PENDING");
          storage.setItem(key, text(requestId)); if (storage.getItem(key) !== requestId) throw new Error();
        }
      });
    } catch (error) { if (error instanceof PurchaseClientError) throw error; throw new PurchaseClientError("SERVICE_RECOVERY_UNAVAILABLE"); }
  }
  abort() { this.#commerce.identity.transport.cancelPendingRequests(); }
  getSession() { return this.#commerce.identity.refreshSession(); }
  getEntitlements() { return this.#commerce.getEntitlements(); }
  sendCode(phoneNumber: string) { return this.#commerce.identity.requestPhoneChallenge({ phoneNumber, ...this.#commerce.identity.newMutation() }); }
  verify(challengeId: string, code: string) { return this.#commerce.identity.verifyPhone({ challengeId, code, ...this.#commerce.identity.newMutation() }); }
  logout() { return this.#commerce.identity.logout(this.#commerce.identity.newMutation()); }
  async #request(accountId: string, path: string, signal: AbortSignal, body?: object) {
    return this.#commerce.identity.withAuthenticatedSession(async (session) => {
      // 锁等待后再次核对账号和取消信号，禁止旧标签页以新账号 Cookie 发送旧正文。
      if (signal.aborted) throw new PurchaseClientError("REQUEST_CANCELLED");
      if (session.accountId !== accountId) throw new PurchaseClientError("ACCOUNT_CHANGED");
      const result = await this.#commerce.identity.transport.request(path, "service", { body, signal, ...(body ? { csrfToken: session.csrfToken } : {}) });
      accountResponse(result, accountId); return result;
    });
  }
  usage(accountId: string, signal: AbortSignal) { return this.#request(accountId, "/v1/web-pro/usage", signal).then(value => parseUsage(value, accountId)); }
  async consent(accountId: string, signal: AbortSignal) {
    const row = accountResponse(await this.#request(accountId, "/v1/web-pro/text-consent", signal), accountId);
    return row.consent === null ? null : parseConsent(row.consent);
  }
  async grant(accountId: string, recordId: string, signal: AbortSignal) {
    const row = accountResponse(await this.#request(accountId, "/v1/web-pro/text-consent", signal, { schemaVersion: 1,
      recordId: text(recordId), policyVersion: AI_POLICY, dataScopes: ["typed-text"], accepted: true }), accountId);
    if (row.status !== "created" && row.status !== "replayed") throw new PurchaseClientError("CONSENT_CONFLICT");
    const consent = parseConsent(row.record); if (consent.revokedAt !== null) throw new PurchaseClientError("CONSENT_CONFLICT"); return consent;
  }
  async revoke(accountId: string, consent: TextConsent, signal: AbortSignal) {
    const row = accountResponse(await this.#request(accountId, "/v1/web-pro/text-consent/revoke", signal, { schemaVersion: 1,
      recordId: consent.recordId, expectedRevision: consent.revision }), accountId);
    if (row.status !== "revoked" && row.status !== "replayed") throw new PurchaseClientError("CONSENT_CONFLICT");
    if (parseConsent(row.record).revokedAt === null) throw new PurchaseClientError("INVALID_RESPONSE");
  }
  create(accountId: string, input: TextRequest, signal: AbortSignal) {
    if (!this.configuration.textEnabled || !this.configuration.textRetentionDisclosure) throw new PurchaseClientError("PRO_DELIVERY_NOT_OPEN");
    if (!input.sourceText.trim() || input.sourceText.length > 8000) throw new PurchaseClientError("PRO_DRAFT_INPUT_INVALID");
    const body = { schemaVersion: 1, requestId: text(input.requestId), sourceText: input.sourceText,
      referenceInstant: utc(input.referenceInstant), timeZoneId: input.timeZoneId, consentRecordId: text(input.consentRecordId) };
    return this.#request(accountId, "/v1/web-pro/text-drafts", signal, body).then(value => parseTextDraft(value, accountId, input.requestId));
  }
  read(accountId: string, requestId: string, signal: AbortSignal) {
    return this.#request(accountId, `/v1/web-pro/text-drafts/${text(requestId)}`, signal).then(value => parseTextDraft(value, accountId, requestId));
  }
  cancel(accountId: string, requestId: string, signal: AbortSignal) {
    return this.#request(accountId, `/v1/web-pro/text-drafts/${text(requestId)}/cancel`, signal, { schemaVersion: 1 }).then(value => parseTextDraft(value, accountId, requestId));
  }
  #requireBackup() { if (!this.configuration.backupEnabled) throw new PurchaseClientError("PRO_DELIVERY_NOT_OPEN"); }
  backups(accountId: string, signal: AbortSignal, cursor?: string) {
    this.#requireBackup();
    return this.#request(accountId, `/v1/web-pro/backups${cursor ? `?cursor=${text(cursor)}` : ""}`, signal).then(value => parseBackupList(value, accountId));
  }
  async uploadBackup(accountId: string, requestId: string, document: PlannerDocument, signal: AbortSignal) {
    this.#requireBackup();
    const body = { schemaVersion: 1, requestId: text(requestId), confirmedUpload: true, document: parseDocument(JSON.stringify(document)) };
    const result = backupVersion(accountResponse(await this.#request(accountId, "/v1/web-pro/backups", signal, body), accountId).backup);
    if (result.requestId !== requestId) throw new PurchaseClientError("INVALID_RESPONSE"); return result;
  }
  downloadBackup(accountId: string, requestId: string, signal: AbortSignal) {
    this.#requireBackup();
    return this.#request(accountId, `/v1/web-pro/backups/${text(requestId)}`, signal).then(value => parseDownloadedBackup(value, accountId, requestId));
  }
}
