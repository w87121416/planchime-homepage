import { PurchaseClientError, integer, object, text, utc, versioned } from "../purchase/protocol.ts";
import { validDate, type PlannerDraft } from "../planner/model.ts";

export const PRO_POLICY = "midui-pro.30d.20261110.v1";
export const AI_POLICY = "ai-data-policy.v1";
export const AI_PROVIDER = "aliyun-qwen.appsch-schedule-draft.v1";
export type TextConsent = Readonly<{ recordId: string; revision: number; grantedAt: string; revokedAt: string | null }>;
export type ServiceUsage = Readonly<{ balances: readonly Readonly<{ validUntil: string; textRemaining: number; voiceSecondsRemaining: number }>[] }>;
export type TextDraft = Readonly<{
  requestId: string; state: "queued" | "running" | "indeterminate" | "ready" | "failed" | "cancelled";
  usageState: "reserved" | "running" | "succeeded" | "released"; expiresAt: string; contentAvailable: boolean;
  proposal: Readonly<{ draft: PlannerDraft; timeZoneId: string; reviewNotes: readonly string[] }> | null;
}>;
const invalid = (): never => { throw new PurchaseClientError("INVALID_RESPONSE"); };
export function accountResponse(value: unknown, accountId: string): Record<string, unknown> {
  const response = versioned(value);
  if (response.accountId !== accountId) throw new PurchaseClientError("ACCOUNT_CHANGED");
  return response;
}
export function parseConsent(value: unknown): TextConsent {
  const row = versioned(value);
  if (row.capability !== "remote-ai-schedule-draft" || row.providerId !== AI_PROVIDER || row.policyVersion !== AI_POLICY ||
      !Array.isArray(row.dataScopes) || row.dataScopes.length !== 1 || row.dataScopes[0] !== "typed-text") invalid();
  utc(row.updatedAt);
  return Object.freeze({ recordId: text(row.recordId), revision: integer(row.revision, 1), grantedAt: utc(row.grantedAt),
    revokedAt: row.revokedAt === null ? null : utc(row.revokedAt) });
}
export function parseUsage(value: unknown, accountId: string): ServiceUsage {
  const row = accountResponse(value, accountId);
  if (row.policyVersion !== PRO_POLICY || !Array.isArray(row.balances) || row.balances.length > 1000) invalid();
  return Object.freeze({ balances: Object.freeze((row.balances as unknown[]).map((value) => {
    const balance = object(value), textRemaining = integer(balance.textRemaining), voiceSecondsRemaining = integer(balance.voiceSecondsRemaining);
    if (textRemaining > 300 || voiceSecondsRemaining > 3600) invalid();
    return Object.freeze({ validUntil: utc(balance.validUntil), textRemaining, voiceSecondsRemaining });
  })) });
}
function proposal(value: unknown): NonNullable<TextDraft["proposal"]> {
  const result = object(value), p = versioned(result.proposal), audit = versioned(result.audit);
  if (result.selected !== "ai-proposal" || p.promptVersion !== "schedule-draft.zh-cn.v1" || p.draftState !== "unconfirmed" || p.confirmationRequired !== true ||
      (p.title !== null && (typeof p.title !== "string" || !p.title.trim() || p.title.length > 160)) ||
      !["task", "event"].includes(String(p.itemKind)) || !["start", "due"].includes(String(p.timeMeaning)) ||
      audit.outcome !== "ai-proposal" || audit.reason !== null || audit.providerId !== AI_PROVIDER || audit.consentPolicyVersion !== AI_POLICY) invalid();
  const zone = object(p.timeZone), when = object(p.when), repeat = object(p.repeat), reminder = object(p.reminder);
  const timeZoneId = text(zone.timeZoneId, /^[A-Za-z0-9_+/-]{1,128}$/u);
  try { new Intl.DateTimeFormat("en", { timeZone: timeZoneId }).format(0); } catch { invalid(); }
  if (zone.source !== "capture-context" || !["unscheduled", "local-date", "local-time", "local-date-time"].includes(String(when.kind)) ||
      !["none", "daily", "weekdays", "weekly-by-day", "monthly"].includes(String(repeat.kind)) ||
      !["none", "relative"].includes(String(reminder.kind)) || !Array.isArray(p.ambiguities) || p.ambiguities.length > 100) invalid();
  const date = ["local-date", "local-date-time"].includes(String(when.kind)) ? String(when.localDate) : "";
  const time = ["local-time", "local-date-time"].includes(String(when.kind)) ? String(when.localTime) : "";
  if ((date && !validDate(date)) || (time && !/^([01]\d|2[0-3]):[0-5]\d$/u.test(time))) invalid();
  const reviewNotes: string[] = [];
  if (p.timeMeaning === "due") reviewNotes.push("这是截止时间，请核对后再保存。");
  if (time && !date) reviewNotes.push("只有时间，请补充日期；也可以清空时间，保存为待安排。");
  if (repeat.kind !== "none") reviewNotes.push("原文包含重复安排；网页只保存本次事项，不自动重复。");
  if (reminder.kind !== "none") reviewNotes.push("原文包含提醒；网页不登记或发送到点提醒。");
  if (when.durationMinutes !== undefined) {
    const duration = integer(when.durationMinutes, 5); if (duration > 1440) invalid();
    reviewNotes.push(`原文时长为 ${duration} 分钟，请在备注中核对。`);
  }
  if ((p.ambiguities as unknown[]).length) reviewNotes.push("还有需要核对的内容，请逐项确认标题、日期和时间。");
  // 网页只接收手动可编辑的单条草稿。重复/提醒等不能静默变为本地执行指令。
  return Object.freeze({ draft: { title: p.title as string ?? "", date, time, notes: reviewNotes.join("\n") }, timeZoneId,
    reviewNotes: Object.freeze(reviewNotes) });
}
export function parseTextDraft(value: unknown, accountId: string, requestId: string): TextDraft {
  const row = versioned(accountResponse(value, accountId).draft);
  if (row.requestId !== requestId || !["queued", "running", "indeterminate", "ready", "failed", "cancelled"].includes(String(row.state)) ||
      !["reserved", "running", "succeeded", "released"].includes(String(row.usageState)) || typeof row.contentAvailable !== "boolean" ||
      (row.result !== null && (row.state !== "ready" || row.contentAvailable !== true)) ||
      (row.state === "ready" && row.contentAvailable === true && row.result === null)) invalid();
  return Object.freeze({ requestId, state: row.state as TextDraft["state"], usageState: row.usageState as TextDraft["usageState"],
    expiresAt: utc(row.expiresAt), contentAvailable: row.contentAvailable as boolean, proposal: row.result === null ? null : proposal(row.result) });
}
