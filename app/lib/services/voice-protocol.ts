import { PurchaseClientError, integer, text, utc, versioned } from "../purchase/protocol.ts";
import { accountResponse, parseScheduleProposal, type TextDraft } from "./protocol.ts";

export const VOICE_POLICY = "pro-voice-consent.20261119.v1";
export const VOICE_PROVIDER = "aliyun-qwen3-asr-flash-beijing.v1";
export const VOICE_PRIVACY_URL = "https://help.aliyun.com/zh/model-studio/privacy-notice";
export type VoiceConsent = Readonly<{ recordId: string; revision: number; grantedAt: string; revokedAt: string | null }>;
export type VoiceDraft = Readonly<{
  requestId: string; state: "running" | "indeterminate" | "ready" | "failed"; stage: "transcription" | "parsing";
  usageState: "running" | "succeeded" | "released"; units: number; expiresAt: string; contentAvailable: boolean;
  sourceConsentRecordId: string; transcript: string | null; proposal: TextDraft["proposal"];
}>;
const invalid = (): never => { throw new PurchaseClientError("INVALID_RESPONSE"); };
export function parseVoiceConsent(value: unknown): VoiceConsent {
  const row = versioned(value);
  if (row.capability !== "remote-audio-transcription" || row.policyVersion !== VOICE_POLICY || row.providerId !== VOICE_PROVIDER ||
      !Array.isArray(row.dataScopes) || row.dataScopes.length !== 2 || row.dataScopes[0] !== "raw-audio" || row.dataScopes[1] !== "speech-transcript") invalid();
  utc(row.updatedAt);
  return Object.freeze({ recordId: text(row.recordId), revision: integer(row.revision, 1), grantedAt: utc(row.grantedAt), revokedAt: row.revokedAt === null ? null : utc(row.revokedAt) });
}
export function parseVoiceDraft(value: unknown, accountId: string, requestId: string, consentRecordId: string): VoiceDraft {
  const row = versioned(accountResponse(value, accountId).draft), units = integer(row.units, 1);
  // 外层真实语音授权必须先验证；内部复用的文字政策版本不能替代音频同意。
  if (row.requestId !== requestId || row.sourceConsentPolicyVersion !== VOICE_POLICY || row.sourceConsentRecordId !== consentRecordId || units > 60 ||
      !["running", "indeterminate", "ready", "failed"].includes(String(row.state)) || !["transcription", "parsing"].includes(String(row.stage)) ||
      !["running", "succeeded", "released"].includes(String(row.usageState)) || typeof row.contentAvailable !== "boolean" ||
      (row.transcript !== null && (typeof row.transcript !== "string" || !row.transcript.trim() || row.transcript.length > 8000 || !row.contentAvailable)) ||
      (row.result !== null && (row.state !== "ready" || !row.contentAvailable)) ||
      (row.state === "ready" && row.contentAvailable && row.result === null)) invalid();
  return Object.freeze({ requestId, state: row.state as VoiceDraft["state"], stage: row.stage as VoiceDraft["stage"], usageState: row.usageState as VoiceDraft["usageState"],
    units, expiresAt: utc(row.expiresAt), contentAvailable: row.contentAvailable as boolean, sourceConsentRecordId: text(row.sourceConsentRecordId),
    transcript: row.transcript as string | null, proposal: row.result === null ? null : parseScheduleProposal(row.result, "speech-transcript") });
}
