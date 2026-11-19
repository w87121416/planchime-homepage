import type { EntitlementSnapshot } from "../purchase/commerce.ts";

export const MOSSLIGHT_ID = "mosslight-garden.paper";
export const MOSSLIGHT_PRODUCT = "theme.mosslight-garden.paper.buyout.v1";
export const MOSSLIGHT_ENTITLEMENT = "theme.mosslight-garden.paper.owned";
export type WebThemeManifest = Readonly<{
  themeId: typeof MOSSLIGHT_ID; manifestVersion: string; clientVersion: string;
  artworkUrl: string; artworkSha256: string; licenseId: string;
  canvas: string; surface: string; quiet: string; ink: string; secondaryInk: string; border: string; accent: string;
}>;
// Local 2026-11-19 书面批准复用项目原创原图与 R4 令牌。此清单独立于 App 内部预览许可。
export const mosslightWebManifest: WebThemeManifest = Object.freeze({
  themeId: MOSSLIGHT_ID, manifestVersion: "web.20261119.v1", clientVersion: "web-services.1.0.0",
  artworkUrl: "/images/mosslight-garden-preview.png", artworkSha256: "34ae14aacdf6ee44336a43a7a82c3168ae8bc3694213c904eb551d2405ca5c36",
  licenseId: "project-original.midui-web-account-theme.20261119.v1",
  canvas: "#F7F2E8", surface: "#FFFCF5", quiet: "#E7EBDD", ink: "#20382E", secondaryInk: "#5A665D", border: "#D5D7C7", accent: "#365B43",
});
export const mosslightWebRights = Object.freeze({ source: "project-original", version: "20261119.v1",
  use: "米堆网站内账号主题使用", redistribution: "不得转售素材", appCompatibility: false });
export const THEME_PREFERENCE_KEY = "planchime:web-theme-preference:v1";
// 这里只保存偏好，读取者每次仍须核对当前账号权威权益；改写本机字符串不能获得主题。
async function preferenceKey(accountId: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(accountId));
  return `${THEME_PREFERENCE_KEY}:${Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join("")}`;
}
export async function saveThemePreference(selected: boolean, accountId: string) { localStorage.setItem(await preferenceKey(accountId), selected ? MOSSLIGHT_ID : "free"); }
export async function wantsMosslight(accountId: string) { try { return localStorage.getItem(await preferenceKey(accountId)) === MOSSLIGHT_ID; } catch { return false; } }
export function themeVariables(manifest: WebThemeManifest): Record<string, string> {
  return { "--planner-canvas": manifest.canvas, "--planner-surface": manifest.surface, "--planner-quiet": manifest.quiet,
    "--planner-ink": manifest.ink, "--planner-secondary": manifest.secondaryInk, "--planner-border": manifest.border, "--planner-accent": manifest.accent };
}
export function ownsMosslight(snapshot: EntitlementSnapshot | null, accountId: string | null, now: number): boolean {
  if (!snapshot || !accountId || snapshot.accountId !== accountId || !Number.isFinite(now)) return false;
  return snapshot.entitlements.some(grant => grant.productId === MOSSLIGHT_PRODUCT && grant.entitlementKey === MOSSLIGHT_ENTITLEMENT &&
    grant.accessGranted && grant.lifecycleState === "active-non-renewing" &&
    (grant.validUntil === null || Date.parse(grant.validUntil) > Math.max(now, Date.parse(snapshot.evaluatedAt))));
}
