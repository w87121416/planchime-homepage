"use client";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { WebMemberServiceClient, type MemberServicePort } from "../lib/services/client";
import { mosslightWebManifest, MOSSLIGHT_ENTITLEMENT, ownsMosslight, THEME_PREFERENCE_KEY, themeVariables, wantsMosslight } from "../lib/services/theme";
import styles from "./memberServices.module.css";
import { subscribeServiceInvalidation } from "../lib/services/session-events";

/** 免费日程从不依赖登录成功；只在独立服务配置打开时读取主题权益，不读取或上传事项。 */
export function MemberTheme({ children, client: supplied }: { children: ReactNode; client?: MemberServicePort }) {
  const [client] = useState(() => supplied ?? new WebMemberServiceClient());
  const [applied, setApplied] = useState(false);
  useEffect(() => {
    if (client.configuration.transport.mode !== "services" || !client.configuration.transport.servicesApproved || !client.configuration.themeEnabled) return;
    let epoch = 0, disposed = false, inFlight: number | null = null, accountId: string | null = null;
    let expiry: ReturnType<typeof setTimeout> | undefined;
    const free = () => { clearTimeout(expiry); accountId = null; setApplied(false); };
    const invalidate = () => { epoch++; inFlight = null; client.abort(); free(); };
    const refresh = async () => {
      if (disposed || inFlight !== null) return;
      const current = epoch; inFlight = current;
      try {
        const session = await client.getSession(); if (disposed || current !== epoch) return;
        if (session.status !== "authenticated" || !session.accountId) { free(); return; }
        // 同账号后台核验不拆下艺术图；切号必须先撤回旧账号外观，再等待新权益。
        if (accountId !== session.accountId) free();
        const snapshot = await client.getEntitlements();
        const preferred = await wantsMosslight(session.accountId);
        if (disposed || current !== epoch) return;
        if (!ownsMosslight(snapshot, session.accountId, Date.now()) || !preferred) { free(); return; }
        const validUntil = snapshot.entitlements.find(grant => grant.entitlementKey === MOSSLIGHT_ENTITLEMENT)?.validUntil;
        const remaining = validUntil ? Date.parse(validUntil) - Math.max(Date.now(), Date.parse(snapshot.evaluatedAt)) : Infinity;
        clearTimeout(expiry); accountId = session.accountId; setApplied(true);
        // 90 秒是单次核验的最长内存有效期，刷新卡住也会撤回，不能变成离线许可证。
        expiry = setTimeout(invalidate, Math.min(90_000, remaining));
      } catch { if (!disposed && current === epoch) free(); }
      finally { if (inFlight === current) inFlight = null; }
    };
    void refresh();
    const storage = (event: StorageEvent) => { if (event.key?.startsWith(THEME_PREFERENCE_KEY) || event.key === null) void refresh(); };
    const focus = () => { void refresh(); };
    const unsubscribe = subscribeServiceInvalidation(invalidate);
    window.addEventListener("focus", focus); window.addEventListener("offline", invalidate); window.addEventListener("storage", storage);
    // 权益不持久化为离线许可证。页面仍开启时也定期重新核验，退款后的快照即时撤下外观。
    const timer = window.setInterval(focus, 60_000);
    return () => { disposed = true; epoch++; client.abort(); clearTimeout(expiry); unsubscribe(); clearInterval(timer); window.removeEventListener("focus", focus); window.removeEventListener("offline", invalidate); window.removeEventListener("storage", storage); };
  }, [client]);
  return <div className={styles.themeCanvas} style={applied ? themeVariables(mosslightWebManifest) as CSSProperties : undefined} data-planner-theme={applied ? "mosslight" : "free"}>
    {/* 已批准随包静态原图不经过会产生额外服务调用的图片优化器。 */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    {applied ? <img className={styles.themeArt} src={mosslightWebManifest.artworkUrl} alt="苔光书庭主题背景" onError={() => setApplied(false)} /> : null}
    {children}
  </div>;
}
