import { WebMemberServiceClient } from "../../app/lib/services/client.ts";
import { serviceConfiguration } from "../../app/lib/services/config.ts";
import { PRO_POLICY, AI_PROVIDER } from "../../app/lib/services/protocol.ts";
import { MOSSLIGHT_ENTITLEMENT, MOSSLIGHT_PRODUCT } from "../../app/lib/services/theme.ts";
import type { PurchaseRuntime } from "../../app/lib/purchase/transport.ts";

// 仅供 node/隔离浏览器测试导入；正式 App Router 不导入此文件，所有请求在进程内合成。
export function memberFixture(options: { anonymous?: boolean; closed?: boolean; storage?: PurchaseRuntime["storage"] } = {}) {
  const now = new Date().toISOString(), until = new Date(Date.now() + 30 * 86400000).toISOString();
  const state = { account: options.anonymous ? null as string | null : "synthetic-account-a", entitlementAccount: null as string | null,
    responseAccount: null as string | null, theme: true, refunded: false, revision: 1, unknownText: false, unknownBackup: false, unavailable: false,
    consent: null as Record<string, unknown> | null, remaining: 300, drafts: new Map<string, Record<string, unknown>>(), backups: new Map<string, Record<string, unknown>>() };
  const storage = new Map<string, string>(), calls: { path: string; method: string; body: Record<string, unknown> | null; headers: Record<string, string>; credentials: RequestCredentials | undefined }[] = [];
  let counter = 0;
  const response = (body: object, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  const envelope = (body: object) => ({ schemaVersion: 1, accountId: state.responseAccount ?? state.account, ...body });
  const ready = (requestId: string) => ({ schemaVersion: 1, requestId, state: "ready", usageState: "succeeded", expiresAt: new Date(Date.now() + 86400000).toISOString(), contentAvailable: true,
    result: { selected: "ai-proposal", deterministicFallback: {}, audit: { schemaVersion: 1, outcome: "ai-proposal", reason: null, providerId: AI_PROVIDER, consentPolicyVersion: "ai-data-policy.v1" },
      proposal: { schemaVersion: 1, promptVersion: "schedule-draft.zh-cn.v1", draftState: "unconfirmed", confirmationRequired: true,
        title: "合成测试：去图书馆", itemKind: "event", timeMeaning: "start", when: { kind: "local-date-time", localDate: "2026-11-25", localTime: "10:00" },
        timeZone: { timeZoneId: "Asia/Shanghai", source: "capture-context" }, repeat: { kind: "none" }, reminder: { kind: "none" }, ambiguities: [], confidence: { overall: .9, level: "high" } } } });
  const runtime: PurchaseRuntime = { origin: "https://planchime.com", locks: { request: async (...args: unknown[]) => (args.at(-1) as () => unknown)() } as Pick<LockManager, "request">,
    storage: options.storage ?? { getItem: key => storage.get(key) ?? null, setItem: (key, value) => { storage.set(key, value); }, removeItem: key => { storage.delete(key); } },
    randomUUID: () => `synthetic-request-${++counter}`, now: () => Date.now(), digest: async value => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))), b => b.toString(16).padStart(2, "0")).join(""),
    fetch: (async (url, init) => {
      const path = new URL(String(url)).pathname, query = new URL(String(url)).search, method = init?.method ?? "GET";
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : null;
      calls.push({ path: path + query, method, body, headers: init?.headers as Record<string, string>, credentials: init?.credentials });
      if (path === "/v1/web-auth/session") return response({ schemaVersion: 1, status: state.account ? "authenticated" : "anonymous", accountId: state.account, csrfToken: "a".repeat(64), phoneOtp: "available" });
      if (path === "/v1/web-auth/logout") { state.account = null; return response({ schemaVersion: 1, status: "logged-out" }); }
      if (path === "/v1/web-auth/phone/challenges") return response({ schemaVersion: 1, status: "challenge-accepted", challengeId: "synthetic-challenge", expiresAtUtc: until });
      if (path === "/v1/web-auth/phone/verify") { state.account = "synthetic-account-a"; return response({ schemaVersion: 1, status: "authenticated", accountId: state.account, csrfToken: "a".repeat(64) }); }
      if (!state.account) return response({ schemaVersion: 1, status: "error", code: "AUTHENTICATION_REQUIRED" }, 401);
      if (state.unavailable) throw new TypeError("synthetic offline");
      if (path === "/v1/commerce/entitlements") return response({ schemaVersion: 1, snapshot: { schemaVersion: 1, accountId: state.entitlementAccount ?? state.account, authority: "commerce-service-verified", evaluatedAt: now, entitlementRevision: state.revision,
        entitlements: state.theme ? [{ schemaVersion: 1, authority: "commerce-service-verified", productId: MOSSLIGHT_PRODUCT, entitlementKey: MOSSLIGHT_ENTITLEMENT, lifecycleState: state.refunded ? "refunded" : "active-non-renewing", accessGranted: !state.refunded, validUntil: null }] : [] } });
      if (path === "/v1/web-pro/usage") return response(envelope({ policyVersion: PRO_POLICY, balances: [{ validUntil: until, textRemaining: state.remaining, voiceSecondsRemaining: 3600 }] }));
      if (path === "/v1/web-pro/text-consent") {
        if (method === "GET") return response(envelope({ consent: state.consent }));
        state.consent = { schemaVersion: 1, recordId: body.recordId, capability: "remote-ai-schedule-draft", providerId: AI_PROVIDER, policyVersion: "ai-data-policy.v1", dataScopes: ["typed-text"], grantedAt: now, revokedAt: null, updatedAt: now, revision: 1 };
        return response(envelope({ status: "created", record: state.consent }));
      }
      if (path === "/v1/web-pro/text-consent/revoke") { state.consent = { ...state.consent, revokedAt: now, updatedAt: now, revision: 2 }; return response(envelope({ status: "revoked", record: state.consent })); }
      if (path === "/v1/web-pro/text-drafts") {
        state.drafts.set(body.requestId, ready(body.requestId)); state.remaining--;
        if (state.unknownText) throw new TypeError("synthetic response lost");
        return response(envelope({ draft: { ...ready(body.requestId), state: "queued", usageState: "reserved", result: null } }), 202);
      }
      if (path.startsWith("/v1/web-pro/text-drafts/")) {
        const requestId = path.split("/")[4], draft = state.drafts.get(requestId);
        if (!draft) return response({ schemaVersion: 1, status: "error", code: "PRO_DRAFT_NOT_FOUND" }, 404);
        return response(envelope({ draft: path.endsWith("/cancel") ? { ...draft, state: "cancelled", usageState: "released", result: null } : draft }));
      }
      if (path === "/v1/web-pro/backups") {
        if (method === "GET") return response(envelope({ backup: { capacityBytes: 100000000, usedBytes: [...state.backups.values()].reduce((n, b) => n + (b.metadata as {byteLength: number}).byteLength, 0), canUpload: true, membershipValidUntil: until, versions: [...state.backups.values()].map(b => b.metadata), nextCursor: null } }));
        const metadata = { schemaVersion: 1, requestId: body.requestId, createdAt: now, downloadUntil: until, byteLength: new TextEncoder().encode(JSON.stringify(body.document)).byteLength, itemCount: body.document.items.length, available: true };
        state.backups.set(body.requestId, { metadata, document: body.document });
        if (state.unknownBackup) throw new TypeError("synthetic response lost");
        return response(envelope({ backup: metadata }));
      }
      if (path.startsWith("/v1/web-pro/backups/")) { const backup = state.backups.get(path.split("/")[4]); return backup ? response(envelope({ backup })) : response({ schemaVersion: 1, status: "error", code: "PRO_BACKUP_NOT_FOUND" }, 404); }
      throw new Error("Unexpected synthetic route");
    }) as typeof fetch };
  const configuration = options.closed ? serviceConfiguration : { ...serviceConfiguration, transport: { mode: "services" as const, apiOrigin: "https://api.planchime.com", servicesApproved: true }, textEnabled: true, themeEnabled: true, backupEnabled: true };
  const client = new WebMemberServiceClient(configuration, runtime);
  return { client, runtime, state, calls, storage, ready, configuration };
}
