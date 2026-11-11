"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { WebPurchaseClient } from "../lib/purchase/commerce";
import styles from "./purchasePortal.module.css";

type Connection = "loading" | "connected" | "unavailable";
const channels = [
  { variant: "alipay-pc-web", label: "电脑网站 · 支付宝" },
  { variant: "alipay-h5-web", label: "手机网页 · 支付宝" },
] as const;

/** 这里只核对公开目录是否响应；服务端返回商品也不会让售前页面生成购买或登录动作。 */
export function PurchasePrelaunchStatus({ client: provided, embedded = false }: {
  client?: WebPurchaseClient; embedded?: boolean;
}) {
  const [client] = useState(() => provided ?? new WebPurchaseClient());
  const [connections, setConnections] = useState<readonly Connection[]>(["loading", "loading"]);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    // 固定两条目录读取不依赖账号、Cookie 或设备识别；一个渠道失败不掩盖另一渠道的真实状态。
    void Promise.allSettled(channels.map(({ variant }) => client.getCatalog(variant))).then((results) => {
      if (active) setConnections(results.map((result) => result.status === "fulfilled" ? "connected" : "unavailable"));
    });
    return () => { active = false; };
  }, [client, attempt]);
  const checking = connections.includes("loading");
  const title = embedded ? <h2 id="purchase-availability-title">购买开放状态</h2> : <h1 id="purchase-availability-title">尚未开放购买</h1>;
  return <section className={embedded ? `legal-section ${styles.portal} ${styles.embedded}` : `${styles.portal} ${styles.narrow}`} aria-labelledby="purchase-availability-title">
    {title}
    <p>会员与主题尚未开放购买。网页账号登录、订单查询和权益交付仍在准备与验证中。</p>
    <p>本页只查看商品目录的连接状态，不提供短信验证码、下单或付款操作。</p>
    <div role="status" aria-live="polite" aria-atomic="true" aria-busy={checking}>
      <dl className={styles.facts}>{channels.map(({ variant, label }, index) => <div key={variant}>
        <dt>{label}</dt><dd>{connections[index] === "loading" ? "正在查看开放状态…" : connections[index] === "connected"
          ? "商品目录已连接，尚未开放购买。" : "暂未取得商品目录状态，购买仍未开放。"}</dd>
      </div>)}</dl>
    </div>
    <div className={styles.actions}>
      <button className={`${styles.button} ${styles.secondary}`} disabled={checking} onClick={() => {
        setConnections(["loading", "loading"]); setAttempt((value) => value + 1);
      }}>重新查看开放状态</button>
      <Link className={styles.link} href="/services/#planned-services">查看已公布的会员与主题说明</Link>
    </div>
    <p className={styles.small}>目录连接成功不代表已开通收款或可以交付付费权益。现有免费日程与提醒继续使用。</p>
  </section>;
}
