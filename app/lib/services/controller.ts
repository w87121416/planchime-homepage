import type { EntitlementSnapshot } from "../purchase/commerce.ts";
import { PurchaseClientError, type WebSession } from "../purchase/protocol.ts";
import type { PlannerDraft, PlannerRepository } from "../planner/model.ts";
import type { MemberServicePort } from "./client.ts";
import type { ServiceUsage, TextConsent, TextDraft } from "./protocol.ts";
import { ownsMosslight, saveThemePreference, type WebThemeManifest } from "./theme.ts";
import { confirmedDraftDocument } from "./planner.ts";

export type MemberServicesState = Readonly<{
  phase: "closed" | "checking" | "anonymous" | "ready" | "unavailable";
  session: WebSession | null; entitlements: EntitlementSnapshot | null; checkedAt: string | null;
  usage: ServiceUsage | null; consent: TextConsent | null; requestId: string | null; draft: TextDraft | null;
  busy: boolean; rechecking: boolean; error: string; notice: string; textUnavailable: boolean; themeApplied: boolean;
  textSaved: "saved" | "existing" | null;
}>;
const fresh = (phase: MemberServicesState["phase"]): MemberServicesState => Object.freeze({ phase, session: null, entitlements: null,
  checkedAt: null, usage: null, consent: null, requestId: null, draft: null, busy: false, rechecking: false, textSaved: null, error: "", notice: "", textUnavailable: false, themeApplied: false });
export function serviceFailure(error: unknown): string {
  const code = error instanceof PurchaseClientError ? error.code : "UNKNOWN";
  if (["PRO_DELIVERY_NOT_OPEN", "PURCHASE_DISABLED"].includes(code)) return "这项服务尚未开放，免费网页日程可以继续使用。";
  if (["ACCOUNT_CHANGED", "AUTHENTICATION_REQUIRED", "PRO_DRAFT_IDENTITY_UNAVAILABLE", "REQUEST_CANCELLED"].includes(code)) return "账号状态已变化，请重新核验后继续。当前浏览器中已保存的日程不受影响。";
  if (code === "PRO_MEMBERSHIP_REQUIRED") return "当前账号没有可用的会员权益，免费网页日程可以继续使用。";
  if (["PRO_USAGE_LIMIT_REACHED", "PRO_REQUEST_LIMIT_REACHED"].includes(code)) return "这次还不能继续整理，请查看剩余额度或稍后再试；输入仍保留着。";
  if (["PRO_DRAFT_CONSENT_REQUIRED", "CONSENT_CONFLICT"].includes(code)) return "文字处理授权需要重新核对，输入仍保留着。";
  if (code === "SERVICE_RECOVERY_UNAVAILABLE") return "浏览器暂时无法保留查询凭据，本次未继续发送。请允许本站存储后重试。";
  if (code === "SERVICE_REQUEST_PENDING") return "另一页面仍有待核验的请求，本次没有重新发送。请重新核验账号，再查询原结果。";
  return "这次操作尚未完成。已有日程没有改变，请稍后重新核验。";
}

/** 敏感展示只存在当前账号代际；取消只是优化，代际核对才是迟到响应的最终边界。 */
export class MemberServicesController {
  readonly client: MemberServicePort;
  readonly #listeners = new Set<() => void>();
  #state: MemberServicesState;
  #epoch = 0;
  #signal = new AbortController();
  constructor(client: MemberServicePort) {
    this.client = client;
    this.#state = fresh(client.configuration.transport.mode === "services" && client.configuration.transport.servicesApproved ? "checking" : "closed");
  }
  getSnapshot = () => this.#state;
  subscribe = (listener: () => void) => { this.#listeners.add(listener); return () => { this.#listeners.delete(listener); }; };
  #set(patch: Partial<MemberServicesState>) { this.#state = Object.freeze({ ...this.#state, ...patch }); for (const notify of this.#listeners) notify(); }
  #reset(phase: MemberServicesState["phase"]) {
    this.#epoch++; this.#signal.abort(); this.client.abort(); this.#signal = new AbortController();
    this.#state = fresh(phase); for (const notify of this.#listeners) notify(); return this.#epoch;
  }
  invalidate = () => { this.#reset(this.#state.phase === "closed" ? "closed" : "unavailable"); };
  #current(epoch: number, accountId?: string) { return epoch === this.#epoch && (accountId === undefined || this.#state.session?.accountId === accountId); }
  async recheck(): Promise<void> {
    if (this.#state.phase !== "ready") return this.refresh();
    if (this.#state.rechecking) return;
    const epoch = this.#epoch, accountId = this.#state.session!.accountId!;
    // 阅读披露后返回只核验原账号，不先卸载其未保存输入；失败/切号仍立即失效。
    this.#set({ rechecking: true });
    try {
      const session = await this.client.getSession(); if (!this.#current(epoch, accountId)) return;
      if (session.status !== "authenticated" || session.accountId !== accountId) { await this.refresh(); return; }
      const entitlements = await this.client.getEntitlements(); if (!this.#current(epoch, accountId)) return;
      if (entitlements.accountId !== accountId) throw new PurchaseClientError("ACCOUNT_CHANGED");
      this.#set({ session, entitlements, checkedAt: entitlements.evaluatedAt });
    } catch (error) {
      if (this.#current(epoch, accountId)) { this.#reset("unavailable"); this.#set({ error: serviceFailure(error) }); }
    } finally { if (this.#current(epoch, accountId)) this.#set({ rechecking: false }); }
  }
  async refresh(): Promise<void> {
    if (this.#state.phase === "closed") return;
    const epoch = this.#reset("checking");
    try {
      const session = await this.client.getSession(); if (!this.#current(epoch)) return;
      if (session.status !== "authenticated") { this.#set({ phase: "anonymous", session }); return; }
      this.#set({ session });
      const entitlements = await this.client.getEntitlements(); if (!this.#current(epoch, session.accountId!)) return;
      if (entitlements.accountId !== session.accountId) throw new PurchaseClientError("ACCOUNT_CHANGED");
      this.#set({ phase: "ready", entitlements, checkedAt: entitlements.evaluatedAt });
      const pending = await this.client.pending(session.accountId!); if (!this.#current(epoch, session.accountId!)) return;
      this.#set({ requestId: pending });
      if (this.client.configuration.textEnabled && this.client.configuration.textRetentionDisclosure) {
        const [usage, consent] = await Promise.all([this.client.usage(session.accountId!, this.#signal.signal), this.client.consent(session.accountId!, this.#signal.signal)]);
        if (this.#current(epoch, session.accountId!)) this.#set({ usage, consent });
      }
    } catch (error) {
      if (!this.#current(epoch)) return;
      if (error instanceof PurchaseClientError && ["PRO_DELIVERY_NOT_OPEN", "PRO_TEMPORARILY_UNAVAILABLE"].includes(error.code) && this.#state.phase === "ready") {
        this.#set({ textUnavailable: true, error: serviceFailure(error) });
      } else { this.#reset("unavailable"); this.#set({ error: serviceFailure(error) }); }
    }
  }
  async #action(work: (accountId: string, signal: AbortSignal, epoch: number) => Promise<void>) {
    const accountId = this.#state.session?.accountId;
    if (this.#state.busy || this.#state.rechecking || this.#state.phase !== "ready" || !accountId) return;
    const epoch = this.#epoch; this.#set({ busy: true, error: "", notice: "" });
    try { await work(accountId, this.#signal.signal, epoch); }
    catch (error) {
      if (!this.#current(epoch)) return;
      if (error instanceof PurchaseClientError && ["ACCOUNT_CHANGED", "AUTHENTICATION_REQUIRED", "PRO_DRAFT_IDENTITY_UNAVAILABLE"].includes(error.code)) this.#reset("unavailable");
      this.#set({ error: serviceFailure(error) });
    } finally { if (this.#current(epoch)) this.#set({ busy: false }); }
  }
  async sendCode(phone: string): Promise<string | null> {
    if (this.#state.phase !== "anonymous" || this.#state.session?.phoneOtp !== "available" || this.#state.busy) return null;
    const epoch = this.#epoch; this.#set({ busy: true, error: "" });
    try { const response = await this.client.sendCode(phone); return this.#current(epoch) ? response.challengeId : null; }
    catch (error) { if (this.#current(epoch)) this.#set({ error: serviceFailure(error) }); return null; }
    finally { if (this.#current(epoch)) this.#set({ busy: false }); }
  }
  async verify(challengeId: string, code: string) {
    if (this.#state.phase !== "anonymous" || this.#state.busy) return;
    const epoch = this.#epoch; this.#set({ busy: true, error: "" });
    try { await this.client.verify(challengeId, code); if (this.#current(epoch)) await this.refresh(); }
    catch (error) { if (this.#current(epoch)) this.#set({ error: serviceFailure(error), busy: false }); }
  }
  async logout() {
    if (this.#state.phase === "closed") return;
    const epoch = this.#reset("unavailable"); this.#set({ busy: true });
    try { await this.client.logout(); if (this.#current(epoch)) await this.refresh(); }
    catch (error) { if (this.#current(epoch)) this.#set({ error: serviceFailure(error), busy: false }); }
  }
  sendText(sourceText: string, timeZoneId: string, confirmed: boolean) {
    if (!confirmed || !sourceText.trim() || sourceText.length > 8000 || this.#state.requestId || !this.client.configuration.textEnabled || !this.client.configuration.textRetentionDisclosure || this.#state.textUnavailable ||
        !this.#state.usage?.balances.some(balance => balance.textRemaining > 0 && Date.parse(balance.validUntil) > Date.now())) return Promise.resolve();
    return this.#action(async (accountId, signal, epoch) => {
      try { new Intl.DateTimeFormat("zh-CN", { timeZone: timeZoneId }).format(0); }
      catch { this.#set({ error: "请填写有效的时区，例如 Asia/Shanghai；输入仍保留着。" }); return; }
      let consent = this.#state.consent;
      if (!consent || consent.revokedAt) consent = await this.client.grant(accountId, this.client.uuid(), signal);
      if (!this.#current(epoch, accountId)) return;
      this.#set({ consent });
      const requestId = this.client.uuid();
      await this.client.remember(accountId, requestId); if (!this.#current(epoch, accountId)) return;
      // 发起前保留原 ID；网络不明、刷新或退出后回到同账号，只能查询原任务。
      this.#set({ requestId, usage: null, textSaved: null });
      const result = await this.client.create(accountId, { requestId, sourceText, timeZoneId, referenceInstant: new Date().toISOString(), consentRecordId: consent.recordId }, signal);
      if (!this.#current(epoch, accountId)) return;
      this.#set({ draft: result });
      const usage = await this.client.usage(accountId, signal); if (this.#current(epoch, accountId)) this.#set({ usage });
    });
  }
  query() {
    return this.#action(async (accountId, signal, epoch) => {
      const requestId = this.#state.requestId; if (!requestId) return;
      const draft = await this.client.read(accountId, requestId, signal);
      if (!this.#current(epoch, accountId)) return;
      this.#set({ draft });
      const usage = await this.client.usage(accountId, signal); if (this.#current(epoch, accountId)) this.#set({ usage });
    });
  }
  cancel() {
    return this.#action(async (accountId, signal, epoch) => {
      const requestId = this.#state.requestId; if (!requestId || this.#state.draft?.state !== "queued") return;
      const draft = await this.client.cancel(accountId, requestId, signal); if (this.#current(epoch, accountId)) this.#set({ draft });
    });
  }
  revoke() {
    return this.#action(async (accountId, signal, epoch) => {
      const consent = this.#state.consent; if (!consent) return;
      await this.client.revoke(accountId, consent, signal);
      if (this.#current(epoch, accountId)) this.#set({ consent: null, notice: "已撤回文字处理授权，当前浏览器中已保存的日程保持不变。" });
    });
  }
  async finishRequest() {
    return this.#action(async (accountId, _signal, epoch) => {
      if (!this.#state.draft || !["ready", "failed", "cancelled"].includes(this.#state.draft.state)) return;
      await this.client.remember(accountId, null, "text", this.#state.requestId!);
      if (this.#current(epoch, accountId)) this.#set({ requestId: null, draft: null, textSaved: null });
    });
  }
  saveDraft(repository: (canSave: () => boolean) => PlannerRepository, draft: PlannerDraft, confirmed: boolean) {
    if (!confirmed || this.#state.textSaved) return Promise.resolve();
    return this.#action(async (accountId, _signal, epoch) => {
      if (this.#state.draft?.state !== "ready" || !this.#state.draft.contentAvailable || !this.#state.draft.proposal) return;
      try {
        const document = await confirmedDraftDocument(draft, accountId, this.#state.requestId!);
        if (!this.#current(epoch, accountId)) return;
        const merged = await repository(() => this.#current(epoch, accountId)).merge(document);
        if (!this.#current(epoch, accountId)) return;
        // 保存事实先落入展示状态；清查询凭据失败不能让用户再次编辑后得到虚假成功。
        this.#set({ textSaved: merged.result.added ? "saved" : "existing", notice: merged.result.added ? "已保存在当前浏览器。退出账号不会移除这条日程；网页不发送到点提醒。" : "本次日程已在当前浏览器中，已保留本机版本，没有覆盖修改。" });
      }
      catch { if (this.#current(epoch, accountId)) this.#set({ error: "草稿已生成，但还没有保存到浏览器。内容仍保留着。" }); return; }
      // 本地保存由用户独立确认，保存后的事项不属于会员账号；退出不撤回已保存内容。
      if (!this.#current(epoch, accountId)) return;
      try { await this.client.remember(accountId, null, "text", this.#state.requestId!); }
      catch { if (this.#current(epoch, accountId)) this.#set({ error: "本次查询凭据还未清除。请查询或结束本次结果；后续修改请前往网页日程。" }); return; }
      if (this.#current(epoch, accountId)) this.#set({ requestId: null, draft: null, textSaved: null });
    });
  }
  async applyTheme(manifest: WebThemeManifest | null) {
    if (!manifest || !this.client.configuration.themeEnabled || !ownsMosslight(this.#state.entitlements, this.#state.session?.accountId ?? null, Date.now())) return;
    const epoch = this.#epoch, accountId = this.#state.session!.accountId!;
    try { await saveThemePreference(true, accountId); } catch { if (this.#current(epoch, accountId)) this.#set({ error: "外观偏好还没有保存，请允许本站存储后重试。" }); return; }
    if (!this.#current(epoch, accountId)) return;
    this.#set({ themeApplied: true, notice: "已应用苔光书庭，日程内容没有改变。" });
  }
  freeTheme() { const accountId = this.#state.session?.accountId; if (accountId) void saveThemePreference(false, accountId).catch(() => {}); this.#set({ themeApplied: false, notice: "已使用免费外观，日程内容没有改变。" }); }
}
