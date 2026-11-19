"use client";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { WebMemberServiceClient, type MemberServicePort } from "../lib/services/client";
import { mosslightWebManifest, ownsMosslight, THEME_PREFERENCE_KEY, themeVariables, wantsMosslight } from "../lib/services/theme";
import styles from "./memberServices.module.css";
import { subscribeServiceInvalidation } from "../lib/services/session-events";

/** 免费日程从不依赖登录成功；只在独立服务配置打开时读取主题权益，不读取或上传事项。 */
export function MemberTheme({ children, client: supplied }: { children: ReactNode; client?: MemberServicePort }) {
  const [client] = useState(() => supplied ?? new WebMemberServiceClient());
  const [applied, setApplied] = useState(false);
  useEffect(() => {
    if (client.configuration.transport.mode !== "services" || !client.configuration.transport.servicesApproved || !client.configuration.themeEnabled) return;
    let epoch = 0, disposed = false;
    const invalidate = () => { epoch++; client.abort(); setApplied(false); };
    const refresh = async () => {
      invalidate(); const current = epoch;
      try {
        const session = await client.getSession(); if (disposed || current !== epoch || session.status !== "authenticated") return;
        const snapshot = await client.getEntitlements();
        const preferred = await wantsMosslight(session.accountId!);
        if (!disposed && current === epoch && ownsMosslight(snapshot, session.accountId, Date.now()) && preferred) setApplied(true);
      } catch { if (!disposed && current === epoch) setApplied(false); }
    };
    void refresh();
    const storage = (event: StorageEvent) => { if (event.key?.startsWith(THEME_PREFERENCE_KEY) || event.key === null) void refresh(); };
    const focus = () => { void refresh(); };
    const unsubscribe = subscribeServiceInvalidation(invalidate);
    window.addEventListener("focus", focus); window.addEventListener("offline", invalidate); window.addEventListener("storage", storage);
    // 权益不持久化为离线许可证。页面仍开启时也定期重新核验，退款后的快照即时撤下外观。
    const timer = window.setInterval(focus, 60_000);
    return () => { disposed = true; epoch++; client.abort(); unsubscribe(); clearInterval(timer); window.removeEventListener("focus", focus); window.removeEventListener("offline", invalidate); window.removeEventListener("storage", storage); };
  }, [client]);
  return <div className={styles.themeCanvas} style={applied ? themeVariables(mosslightWebManifest) as CSSProperties : undefined} data-planner-theme={applied ? "mosslight" : "free"}>
    {/* 已批准随包静态原图不经过会产生额外服务调用的图片优化器。 */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    {applied ? <img className={styles.themeArt} src={mosslightWebManifest.artworkUrl} alt="苔光书庭主题背景" onError={() => setApplied(false)} /> : null}
    {children}
  </div>;
}
