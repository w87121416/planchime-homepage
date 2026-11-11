"use client";

import { useMemo, useSyncExternalStore } from "react";
import { createWechatNativeQr } from "../lib/purchase/native-qr";

function subscribeWidth(listener: () => void): () => void {
  const query = window.matchMedia("(max-width: 480px)");
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}

function expirationStore(expiresAt: number) {
  return {
    // 时钟是外部状态；快照只输出稳定布尔值，恢复前台时也重新核实，不靠轮询修改订单。
    snapshot: () => !Number.isFinite(expiresAt) || Date.now() >= expiresAt,
    subscribe: (refresh: () => void) => {
      const wait = Math.min(2_147_483_647, Math.max(0, expiresAt - Date.now()));
      const timer = window.setTimeout(refresh, Number.isFinite(wait) ? wait : 0);
      document.addEventListener("visibilitychange", refresh);
      window.addEventListener("focus", refresh);
      return () => { window.clearTimeout(timer); document.removeEventListener("visibilitychange", refresh); window.removeEventListener("focus", refresh); };
    },
  };
}

/** 标题和付款码共用同一到期判断，浏览器恢复前台时也同步移除扫码指示。 */
export function usePaymentCodeExpired(expiresAtUtc: string | null): boolean {
  const expiration = useMemo(() => expirationStore(expiresAtUtc ? Date.parse(expiresAtUtc) : Number.NaN), [expiresAtUtc]);
  return useSyncExternalStore(expiration.subscribe, expiration.snapshot, () => true);
}

/** 只呈现当前账号原单的有效载荷；到期仅隐藏码，不查询、续付、关单或创建订单。 */
export function WechatPaymentCode({ codeUrl, expiresAtUtc, onPhone = false }: Readonly<{ codeUrl: string; expiresAtUtc: string; onPhone?: boolean }>) {
  const narrow = useSyncExternalStore(subscribeWidth, () => window.matchMedia("(max-width: 480px)").matches, () => false);
  const expired = usePaymentCodeExpired(expiresAtUtc);
  const qr = useMemo(() => {
    try { return createWechatNativeQr(codeUrl, narrow ? 240 : 256); } catch { return null; }
  }, [codeUrl, narrow]);
  if (expired) {
    return <p role="status">付款码已失效，原订单仍需核对。</p>;
  }
  if (!qr) return <p role="status">付款码暂未显示，请先核对原订单。</p>;
  return <figure style={{ margin: "24px auto", textAlign: "center" }}>
    {/* data URI 在本机编码，使用原生 img 保留整数像素和静区，不经外部图片代理。 */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={qr.dataUrl} width={qr.pixels} height={qr.pixels} style={{ background: "#fff", display: "block", margin: "0 auto" }}
      alt={onPhone ? "当前订单的微信付款二维码，请使用另一部手机的微信扫一扫" : "当前订单的微信付款二维码，请用手机微信扫一扫"} />
    <figcaption style={{ marginTop: 16 }}>{onPhone ? "请用另一部手机的微信扫一扫" : "请用手机微信扫一扫"}</figcaption>
  </figure>;
}
