import { PurchaseClientError } from "../purchase/protocol.ts";
import type { PlannerDraft, PlannerRepository, PlannerDocument } from "../planner/model.ts";
import type { MemberServicePort } from "./client.ts";
import type { ServiceUsage } from "./protocol.ts";
import type { VoiceClip } from "./voice-audio.ts";
import { BrowserVoiceRecorder, VoiceRecordingError, type VoiceCapturePort } from "./voice-recorder.ts";
import type { VoiceConsent, VoiceDraft } from "./voice-protocol.ts";
import { confirmedDraftDocument, confirmedDraftId, servicePlannerRepository } from "./planner.ts";

export type VoiceState = Readonly<{
  phase: "closed" | "loading" | "ready" | "unavailable"; recording: "idle" | "permission" | "recording";
  seconds: number; clip: VoiceClip | null; timeZoneId: string; consent: VoiceConsent | null; usage: ServiceUsage | null;
  requestId: string | null; draft: VoiceDraft | null; rejectedBeforeTask: boolean; busy: boolean; error: string; notice: string;
  saved: "saved" | "existing" | null;
}>;
export function voiceFailure(error: unknown): string {
  if (error instanceof VoiceRecordingError) {
    if (error.code === "denied") return "麦克风权限没有开启。你可以在浏览器设置中允许后再试，也可以手动记录日程。";
    if (error.code === "unsupported") return "当前浏览器暂不支持安全录音。你可以使用文字整理或手动记录日程。";
    return "这次录音没有完成，麦克风已停止。你可以重新录音或手动记录日程。";
  }
  const code = error instanceof PurchaseClientError ? error.code : "UNKNOWN";
  if (["PRO_VOICE_NOT_OPEN", "PRO_DELIVERY_NOT_OPEN"].includes(code)) return "语音整理尚未开放。你可以使用文字整理或手动记录日程。";
  if (code === "PRO_MEMBERSHIP_REQUIRED") return "当前账号没有可用的会员权益，本机录音尚未清除。你可以取消录音或手动记录日程。";
  if (code === "PRO_USAGE_LIMIT_REACHED") return "语音额度暂时不足，请查看剩余秒数。本机录音仍保留着。";
  if (["PRO_VOICE_CONSENT_REQUIRED", "PRO_VOICE_CONSENT_REVOKED", "CONSENT_CONFLICT"].includes(code)) return "语音处理授权需要重新核对。本机日程没有改变，请重新查看授权状态。";
  if (code === "SERVICE_RECOVERY_UNAVAILABLE") return "浏览器无法保留查询凭据，这次没有上传录音。请允许本站存储后重试。";
  if (code === "SERVICE_REQUEST_PENDING") return "另一页面仍有待核验的语音请求，这次没有重新上传。请重新查看本次结果。";
  if (code === "PRO_VOICE_NOT_FOUND") return "暂时未查到这次请求。录音没有重新上传，请稍后继续查询本次结果。";
  if (code === "PRO_VOICE_BUSY") return "语音服务暂时繁忙。本机录音仍保留着，请先核对本次请求状态。";
  return "这次处理尚未完成。本机日程没有改变；结果不明时请查询本次结果，不要重复上传。";
}
const open = (client: MemberServicePort) => client.configuration.transport.mode === "services" && client.configuration.transport.servicesApproved && client.configuration.voiceEnabled && !!client.configuration.voiceRetentionDisclosure;
export class MemberVoiceController {
  #state: VoiceState; #listeners = new Set<() => void>(); #epoch = 0; #captureEpoch = 0; #signal = new AbortController(); #expiry: ReturnType<typeof setTimeout> | undefined;
  readonly client: MemberServicePort; readonly accountId: string;
  private readonly accountCurrent: () => boolean; private readonly invalidateAccount: () => void; private readonly recorder: VoiceCapturePort;
  private readonly readLocal: () => PlannerDocument;
  constructor(client: MemberServicePort, accountId: string, accountCurrent: () => boolean,
    invalidateAccount: () => void, recorder: VoiceCapturePort = new BrowserVoiceRecorder(), readLocal: () => PlannerDocument = () => servicePlannerRepository(() => true).read()) {
    this.client = client; this.accountId = accountId; this.accountCurrent = accountCurrent; this.invalidateAccount = invalidateAccount; this.recorder = recorder;
    this.readLocal = readLocal;
    this.#state = Object.freeze({ phase: open(client) ? "loading" : "closed", recording: "idle", seconds: 0, clip: null, timeZoneId: "Asia/Shanghai",
      consent: null, usage: null, requestId: null, draft: null, rejectedBeforeTask: false, saved: null, busy: false, error: "", notice: "" });
  }
  getSnapshot = () => this.#state;
  subscribe = (listener: () => void) => { this.#listeners.add(listener); return () => { this.#listeners.delete(listener); }; };
  #set(patch: Partial<VoiceState>) { this.#state = Object.freeze({ ...this.#state, ...patch }); for (const notify of this.#listeners) notify(); }
  #current(epoch: number) { return epoch === this.#epoch && !this.#signal.signal.aborted && this.accountCurrent(); }
  dispose() {
    this.#epoch++; this.#captureEpoch++; this.#signal.abort(); this.recorder.cancel(); clearTimeout(this.#expiry);
    this.#set({ phase: "unavailable", recording: "idle", clip: null, seconds: 0, consent: null, usage: null, draft: null, requestId: null, rejectedBeforeTask: false, saved: null, busy: false, error: "", notice: "" });
  }
  #error(error: unknown) {
    if (error instanceof PurchaseClientError && ["ACCOUNT_CHANGED", "AUTHENTICATION_REQUIRED", "PRO_DRAFT_IDENTITY_UNAVAILABLE"].includes(error.code)) {
      this.dispose(); this.invalidateAccount(); return;
    }
    this.#set({ error: voiceFailure(error) });
  }
  async load() {
    if (!open(this.client) || this.#state.busy || !this.accountCurrent()) return;
    if (this.#signal.signal.aborted) this.#signal = new AbortController();
    const epoch = this.#epoch; this.#set({ busy: true, error: "" });
    try {
      const [usage, consent, requestId] = await Promise.all([this.client.usage(this.accountId, this.#signal.signal), this.client.voiceConsent(this.accountId, this.#signal.signal), this.client.pending(this.accountId, "voice")]);
      if (this.#current(epoch)) {
        if (this.#state.consent && !this.#state.consent.revokedAt && (!consent || consent.revokedAt || consent.recordId !== this.#state.consent.recordId)) {
          this.discard(); clearTimeout(this.#expiry); this.#set({ draft: null, saved: null });
        }
        this.#set({ phase: "ready", usage, consent, requestId, ...(requestId !== this.#state.requestId ? { draft: null, saved: null } : {}) });
      }
    } catch (error) { if (this.#current(epoch)) { this.#set({ phase: "unavailable" }); this.#error(error); } }
    finally { if (this.#current(epoch)) this.#set({ busy: false }); }
  }
  async #action(work: (epoch: number) => Promise<void>) {
    if (!open(this.client) || this.#state.phase !== "ready" || this.#state.busy || !this.accountCurrent() || this.#signal.signal.aborted) return;
    const epoch = this.#epoch; this.#set({ busy: true, error: "", notice: "" });
    try { await work(epoch); } catch (error) { if (this.#current(epoch)) this.#error(error); }
    finally { if (this.#current(epoch)) this.#set({ busy: false }); }
  }
  remaining() { return this.#state.usage?.balances.filter(row => Date.parse(row.validUntil) > Date.now()).reduce((sum, row) => sum + row.voiceSecondsRemaining, 0) ?? 0; }
  async record(timeZoneId: string) {
    if (!open(this.client) || this.#state.phase !== "ready" || this.#state.busy || this.#state.requestId || this.#state.recording !== "idle" || !this.accountCurrent() || !this.remaining()) return;
    try { new Intl.DateTimeFormat("en", { timeZone: timeZoneId }).format(0); } catch { this.#set({ error: "请填写有效的时区，例如 Asia/Shanghai。" }); return; }
    const epoch = this.#epoch, capture = ++this.#captureEpoch;
    this.#set({ recording: "permission", seconds: 0, clip: null, timeZoneId, error: "", notice: "" });
    try {
      const clip = await this.recorder.capture(seconds => { if (this.#current(epoch) && capture === this.#captureEpoch) this.#set({ recording: "recording", seconds }); });
      if (this.#current(epoch) && capture === this.#captureEpoch) this.#set({ clip, seconds: clip.seconds, recording: "idle", notice: "录音已留在本机，请先试听，再决定是否上传。" });
    } catch (error) {
      if (this.#current(epoch) && capture === this.#captureEpoch) { this.#set({ recording: "idle" }); if (!(error instanceof VoiceRecordingError && error.code === "cancelled")) this.#error(error); }
    }
  }
  stop() { this.recorder.stop(); }
  discard() { this.#captureEpoch++; this.recorder.cancel(); this.#set({ clip: null, recording: "idle", seconds: 0, notice: "已取消本机录音。已上传请求如有待查结果，仍需查询原请求。" }); }
  #accept(draft: VoiceDraft) {
    clearTimeout(this.#expiry);
    const remaining = Date.parse(draft.expiresAt) - Date.now();
    this.#set({ rejectedBeforeTask: false, draft: remaining > 0 ? draft : { ...draft, contentAvailable: false, transcript: null, proposal: null } });
    if (remaining > 0) this.#expiry = setTimeout(() => { if (this.#state.draft?.requestId === draft.requestId) this.#set({ draft: { ...draft, contentAvailable: false, transcript: null, proposal: null } }); }, Math.min(remaining, 86_400_000));
  }
  send(confirmed: boolean) {
    const clip = this.#state.clip;
    if (!confirmed || !clip || this.#state.requestId || this.remaining() < clip.units) return Promise.resolve();
    return this.#action(async epoch => {
      let consent = this.#state.consent;
      if (!consent || consent.revokedAt) consent = await this.client.voiceGrant(this.accountId, this.client.uuid(), this.#signal.signal);
      if (!this.#current(epoch)) return; this.#set({ consent });
      const requestId = this.client.uuid(); await this.client.remember(this.accountId, requestId, "voice"); if (!this.#current(epoch)) return;
      // 音频与时间上下文仅发送一次；先持久保存原请求号，任何未知结果都只能读取原 ID。
      this.#set({ requestId, usage: null, rejectedBeforeTask: false, saved: null });
      let draft: VoiceDraft;
      try { draft = await this.client.createVoice(this.accountId, { requestId, consentRecordId: consent.recordId, wav: clip.wav, referenceInstant: clip.referenceInstant, timeZoneId: this.#state.timeZoneId }, this.#signal.signal); }
      catch (error) {
        // 只把契约明确的建任务前拒绝作为可结束状态；超时/断线/未知 503 绝不自动换 ID。
        if (this.#current(epoch) && error instanceof PurchaseClientError && error.outcome === "rejected" &&
            ["PRO_VOICE_NOT_OPEN", "PRO_VOICE_BUSY", "PRO_VOICE_INPUT_INVALID", "PRO_VOICE_AUDIO_INVALID", "PRO_VOICE_CONFIRMATION_REQUIRED", "PRO_VOICE_BODY_TOO_LARGE", "PRO_VOICE_BODY_TIMEOUT", "PRO_VOICE_CONSENT_REQUIRED", "PRO_MEMBERSHIP_REQUIRED", "PRO_USAGE_LIMIT_REACHED", "PRO_REQUEST_LIMIT_REACHED"].includes(error.code)) this.#set({ rejectedBeforeTask: true });
        throw error;
      }
      if (!this.#current(epoch)) return; this.#accept(draft);
      const usage = await this.client.usage(this.accountId, this.#signal.signal); if (this.#current(epoch)) this.#set({ usage });
    });
  }
  query() {
    return this.#action(async epoch => {
      const requestId = this.#state.requestId; if (!requestId) return;
      const consent = this.#state.consent ?? await this.client.voiceConsent(this.accountId, this.#signal.signal);
      if (!this.#current(epoch)) return;
      if (!consent) throw new PurchaseClientError("PRO_VOICE_CONSENT_REQUIRED");
      const draft = await this.client.readVoice(this.accountId, requestId, consent.recordId, this.#signal.signal);
      if (!this.#current(epoch)) return;
      // 重开面板或重查原请求也核对稳定本地 ID；已有版本不再伪装成可再次保存的新草稿。
      try {
        const localId = await confirmedDraftId(this.accountId, `voice:${requestId}`);
        if (!this.#current(epoch)) return;
        if (this.readLocal().items.some(item => item.id === localId)) this.#set({ saved: this.#state.saved ?? "existing" });
      } catch { /* 本地暂不可读时不声称已保存，实际保存仍由仓库校验并保留失败输入。 */ }
      if (!this.#current(epoch)) return; this.#set({ consent }); this.#accept(draft);
      const usage = await this.client.usage(this.accountId, this.#signal.signal); if (this.#current(epoch)) this.#set({ usage });
    });
  }
  async revoke() {
    const consent = this.#state.consent; if (!consent || consent.revokedAt || !this.accountCurrent()) return;
    // 撤回不等在途请求结束；先停止本机采集/展示，服务器仍按实际发送事实结算原请求。
    this.#epoch++; this.#captureEpoch++; this.#signal.abort(); this.#signal = new AbortController(); this.recorder.cancel(); clearTimeout(this.#expiry);
    this.#set({ recording: "idle", clip: null, seconds: 0, draft: null, busy: false });
    await this.#action(async epoch => {
      const revoked = await this.client.voiceRevoke(this.accountId, consent.recordId, this.#signal.signal);
      if (this.#current(epoch)) this.#set({ consent: revoked, notice: "已撤回语音处理授权。本机日程保持不变；取消等待不代表已上传请求停止或额度返还。" });
    });
  }
  finish() {
    return this.#action(async epoch => {
      if (!this.#state.rejectedBeforeTask && (!this.#state.draft || !["ready", "failed"].includes(this.#state.draft.state))) return;
      await this.client.remember(this.accountId, null, "voice", this.#state.requestId!);
      if (!this.#current(epoch)) return;
      clearTimeout(this.#expiry); this.#set({ requestId: null, draft: null, rejectedBeforeTask: false, saved: null });
      const usage = await this.client.usage(this.accountId, this.#signal.signal); if (this.#current(epoch)) this.#set({ usage });
    });
  }
  save(repository: (canSave: () => boolean) => PlannerRepository, draft: PlannerDraft, confirmed: boolean) {
    if (!confirmed || this.#state.saved) return Promise.resolve();
    return this.#action(async epoch => {
      const result = this.#state.draft;
      if (!result?.contentAvailable || Date.parse(result.expiresAt) <= Date.now() || (!result.proposal && !result.transcript)) return;
      try {
        const document = await confirmedDraftDocument(draft, this.accountId, `voice:${result.requestId}`);
        if (!this.#current(epoch)) return;
        const merged = await repository(() => this.#current(epoch)).merge(document); if (!this.#current(epoch)) return;
        // merge 跳过意味着本机已有版本，不能把用户后来编辑的字段谎报为已写入。
        this.#set({ saved: merged.result.added ? "saved" : "existing", notice: merged.result.added ? "已保存在当前浏览器。退出账号不会移除这条日程；网页不发送到点提醒。" : "本次日程已在当前浏览器中，已保留本机版本，没有覆盖修改。" });
      } catch { if (this.#current(epoch)) this.#set({ error: "草稿已生成，但还没有保存到浏览器。内容仍保留着。" }); return; }
      // 手工保存可信转写不等于未知收费结果已终结，原查询凭据必须继续保留。
    });
  }
}
