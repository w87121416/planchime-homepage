"use client";
/* eslint-disable @next/next/no-img-element -- 原创无字母版独立托管；失败时退回可读说明，不依赖图片服务。 */
import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import Link from "next/link";
import { WebPurchaseClient, type RecoveredIntent, type NativeQrPayload } from "../lib/purchase/commerce";
import { PurchaseClientError, checkoutVariant, orderProgress, type CheckoutVariant, type Order, type Product, type WebSession } from "../lib/purchase/protocol";
import { purchaseRecovery } from "../lib/purchase/recovery";
import type { Challenge } from "../lib/purchase/identity";
import { WechatPaymentCode, usePaymentCodeExpired } from "./WechatPaymentCode";
import { PurchasePrelaunchStatus } from "./PurchasePrelaunchStatus";
import styles from "./purchasePortal.module.css";

type View = "catalog" | "orders" | "login" | "confirm" | "policy";
const channelName: Record<CheckoutVariant, string> = { "alipay-pc-web": "支付宝", "alipay-h5-web": "支付宝", "wechat-native": "微信支付（扫码）", "wechat-h5": "微信支付" };
const confirmLabel = (variant: CheckoutVariant | null) => variant === "wechat-native" ? "确认并显示付款码" : variant === "wechat-h5" ? "确认并前往微信" : variant ? "确认并前往支付宝" : "请选择付款方式";
const subscribeDevice = () => () => {};
const money = (order: Pick<Order, "amountMinor">) => `¥${(order.amountMinor / 100).toFixed(2)}`;
const platformName = { ios: "iOS", android: "Android", "wechat-mini": "微信小程序", web: "网页版" };
const time = (value: string) => new Date(value).toLocaleString("zh-CN", { hour12: false });
const accountLabel = (value: string) => `账号 ID …${value.slice(-6)}`;
const productLabel = (id: string) => id === "theme.mosslight-garden.paper.buyout.v1" ? "苔光书庭" : id;
const copy: Record<ReturnType<typeof orderProgress>, { title: string; payment: string; delivery: string; detail: string }> = {
  pending: { title: "核验原订单", payment: "尚未确认", delivery: "尚未确认", detail: "从支付页面返回，不代表付款已经确认。请核对原单，不要重复付款。" },
  "payment-verification-required": { title: "原订单需要核验", payment: "正在核验", delivery: "尚未确认", detail: "付款结果还需要核对。你可以再次查询同一笔订单，或稍后再查看。" },
  "paid-delivery-pending": { title: "付款已确认，权益待发放", payment: "已确认", delivery: "等待发放", detail: "这笔订单已付款，不需要再次支付。你可以查看交付进度，或稍后回来。" },
  delivered: { title: "权益已加入这个账号", payment: "已确认", delivery: "已发放", detail: "请在兼容的客户端版本中使用。已有日程、提醒与免费功能保持不变。" },
  revoked: { title: "这笔订单的权益已撤回", payment: "原付款记录已确认", delivery: "已撤回", detail: "当前不再授予这笔订单对应的付费权益。日程、提醒与免费功能不受影响。" },
  closed: { title: "原订单已核实关闭", payment: "订单已关闭", delivery: "未发放", detail: "不能继续支付这笔订单。若将来重新购买，需要再次确认商品、账号和价格。" },
};

/** 售前模式根本不挂载登录与交易组件，避免隐藏按钮后仍执行会话或订单副作用。 */
export function PurchasePortal({ initialView = "catalog", client: provided }: { initialView?: View; client?: WebPurchaseClient }) {
  const [client] = useState(() => provided ?? new WebPurchaseClient());
  return client.isPrelaunch ? <PurchasePrelaunchStatus client={client} /> : <OperationalPurchasePortal initialView={initialView} client={client} />;
}

/** 交易模式只由显式配置进入；服务器目录与权益门禁继续决定是否允许购买。 */
function OperationalPurchasePortal({ initialView, client }: { initialView: View; client: WebPurchaseClient }) {
  // 静态导出并不知道浏览器类型；首轮水合与服务端同为未检测，随后才展示设备提示。
  // 这里只同步展示，不以设备判断授予渠道权限，也不触发订单或支付。
  const deviceVariant = useSyncExternalStore(subscribeDevice, () => client.checkoutVariant, () => undefined);
  const deviceVariants = deviceVariant === undefined ? [] : client.availableDeviceVariants;
  const [view, setView] = useState<View>(initialView);
  const [products, setProducts] = useState<readonly Product[]>([]);
  const [purchaseProduct, setPurchaseProduct] = useState<Product | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<CheckoutVariant | null>(null);
  // 支付载荷只在内存中绑定当前账号和原订单，不写本机恢复日志，也不跨账号复用。
  const [qr, setQr] = useState<(NativeQrPayload & { accountId: string; orderId: string }) | null>(null);
  const qrExpired = usePaymentCodeExpired(qr?.expiresAtUtc ?? null);
  const wantedProduct = useRef<string | null>(null);
  const [session, setSession] = useState<WebSession | null>(null);
  const [orders, setOrders] = useState<readonly Order[]>([]);
  const [unresolved, setUnresolved] = useState<readonly RecoveredIntent[]>([]);
  const [selected, setSelected] = useState<Order | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [artFailed, setArtFailed] = useState(false);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [phoneError, setPhoneError] = useState("");
  const [codeError, setCodeError] = useState("");
  const [verifyUncertain, setVerifyUncertain] = useState(false);
  const verifyAttempt = useRef<{ challengeId: string; code: string; anonymousContext: string; clientMutationId: string } | null>(null);
  const actionLock = useRef(false), generation = useRef(0);
  const heading = useRef<HTMLHeadingElement>(null), phoneInput = useRef<HTMLInputElement>(null), codeInput = useRef<HTMLInputElement>(null);
  const accountRef = useRef<string | null>(null);

  const clearAccount = () => { accountRef.current = null; setSession(null); setOrders([]); setSelected(null); setUnresolved([]); setCheckedAt(null); setPurchaseProduct(null); setSelectedChannel(null); setQr(null); };
  const failure = (error: unknown) => {
    if (error instanceof PurchaseClientError && ["ACCOUNT_CHANGED", "AUTHENTICATION_REQUIRED"].includes(error.code)) { clearAccount(); setView("login"); }
    setMessage(purchaseRecovery(error).message);
  };
  async function loadOrders(accountId: string, ticket: number, strict = false) {
    const list = await client.listOrders(accountId);
    if (ticket !== generation.current) return;
    setOrders(list.orders); setHasMore(list.hasMore); setCheckedAt(new Date().toISOString());
    setSelected((old) => old ? list.orders.find((order) => order.orderId === old.orderId) ?? null : null);
    let recovered: readonly RecoveredIntent[] = [];
    try {
      recovered = await client.recoverPurchases(accountId);
      if (ticket !== generation.current) return;
      setUnresolved(recovered.filter((item) => item.order === null));
      setOrders((current) => [...current, ...recovered.flatMap((item) => item.order && !current.some((order) => order.orderId === item.order!.orderId) ? [item.order] : [])]);
    } catch (error) {
      // 本机日志损坏不封锁服务端订单入口；账号变化则立即清除此前账号的所有展示。
      if (strict) throw error;
      if (ticket === generation.current) failure(error);
    }
    if (strict && client.recoveryWarning) throw new PurchaseClientError(client.recoveryWarning);
    if (client.recoveryWarning) setMessage(purchaseRecovery(new PurchaseClientError(client.recoveryWarning)).message);
    return { orders: [...list.orders, ...recovered.flatMap((item) => item.order ? [item.order] : [])],
      unresolved: recovered.filter((item) => item.order === null) };
  }
  async function preparePurchase(productId: string, ticket: number) {
    // 每次回到确认页都重读账号、商品与原订单；登录、切账号和跨标签切换不会自动下单。
    setPurchaseProduct(null); setSelectedChannel(null); setQr(null);
    let current = await client.identity.getSession();
    if (current.status === "refresh-required") current = await client.identity.refreshSession();
    if (ticket !== generation.current) return;
    setSession(current); accountRef.current = current.accountId;
    if (!current.accountId) { setView("login"); return; }
    if (!client.availableDeviceVariants.length) throw new PurchaseClientError("H5_PAYMENT_REQUIRED");
    const catalog = await client.getAvailableCatalog();
    const product = catalog.products.find((p) => p.productId === productId);
    if (!catalog.checkoutEnabled || !product?.disclosure?.saleReady || !product.disclosure.fulfillmentReady) throw new PurchaseClientError("COMMERCE_METADATA_REQUIRED");
    const result = await loadOrders(current.accountId, ticket, true);
    if (ticket !== generation.current || !result) return;
    const prior = result.orders.find((o) => o.productId === productId && o.status !== "closed" && o.fulfillmentStatus !== "revoked");
    if (prior) { setSelected(prior); setView("orders"); setMessage("先查看这项商品的原订单，避免重复购买。"); return; }
    if (result.unresolved.some((item) => item.entry.body.productId === productId)) {
      setView("orders"); setMessage("请求结果暂未确认，请先核对这次订单。"); return;
    }
    setPurchaseProduct(product); setView("confirm");
  }
  async function buy() {
    const product = purchaseProduct, accountId = accountRef.current, variant = selectedChannel;
    if (!product || !accountId || !variant || !product.checkoutVariants?.includes(variant) || !client.availableDeviceVariants.includes(variant)) return;
    await action(async (ticket) => {
      try {
        const intent = await client.confirmPurchase({ productId: product.productId, expectedCatalogRevision: product.catalogRevision,
          expectedAccountId: accountId, checkoutVariant: variant, userConfirmed: true });
        const result = await client.createOrder(intent);
        if (ticket !== generation.current) return;
        setPurchaseProduct(null); setSelectedChannel(null); setSelected(result.order); setView("orders"); wantedProduct.current = null;
        setQr(result.qrCode ? { ...result.qrCode, accountId, orderId: result.order.orderId } : null);
        if (result.paymentDestination) window.location.assign(result.paymentDestination);
      } catch (error) {
        // 结果未知先进入原订单恢复；绝不保留一个能换新幂等键再买的确认按钮。
        setPurchaseProduct(null);
        if (error instanceof PurchaseClientError && error.code === "COMMERCE_CATALOG_REVISION_CONFLICT") {
          await preparePurchase(product.productId, ticket);
        } else if (!(error instanceof PurchaseClientError && ["ACCOUNT_CHANGED", "AUTHENTICATION_REQUIRED"].includes(error.code))) {
          setView("orders"); await loadOrders(accountId, ticket);
        }
        throw error;
      }
    });
  }
  async function action(work: (ticket: number) => Promise<void>) {
    if (actionLock.current) return;
    actionLock.current = true; const ticket = generation.current;
    setBusy(true); setMessage("");
    try { await work(ticket); } catch (error) { if (ticket === generation.current) failure(error); }
    finally { actionLock.current = false; setBusy(false); }
  }
  useEffect(() => {
    if (initialView !== "catalog") return;
    let alive = true;
    void client.getAvailableCatalog().then((catalog) => {
      if (alive) setProducts(catalog.products.filter((p) => p.disclosure?.saleReady && p.disclosure.fulfillmentReady));
    }).catch(() => { if (alive) setProducts([]); });
    const focus = () => {
      if (!actionLock.current && wantedProduct.current) {
        generation.current++; clearAccount();
        void action((ticket) => preparePurchase(wantedProduct.current!, ticket));
      }
    };
    window.addEventListener("focus", focus);
    // 当前值是取消序号，卸载时必须递增；它不是指向 DOM 的 ref。
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { alive = false; window.removeEventListener("focus", focus); generation.current++; };
    // 初始页面及 client 稳定；商品确认只在明确动作或重新聚焦时刷新。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, initialView]);
  useEffect(() => {
    if (initialView !== "orders" && initialView !== "login") return;
    let alive = true;
    const read = async () => {
      const ticket = ++generation.current;
      // 离开后重新进入时先隐藏账号资料，再校验会话；不展示上一个账号的缓存订单。
      clearAccount(); setBusy(true); setMessage("");
      try {
        let current = await client.identity.getSession();
        if (current.status === "refresh-required") current = await client.identity.refreshSession();
        if (!alive || ticket !== generation.current) return;
        setSession(current); accountRef.current = current.accountId;
        if (current.status === "authenticated" && current.accountId) { setView("orders"); await loadOrders(current.accountId, ticket); }
        else setView("login");
      } catch (error) { if (alive && ticket === generation.current) failure(error); }
      finally { if (alive && ticket === generation.current) setBusy(false); }
    };
    void read();
    const focus = () => { if (!actionLock.current) void read(); };
    window.addEventListener("focus", focus);
    // 这是请求取消序号而非 DOM ref；清理时必须递增当前值以丢弃所有在途结果。
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { alive = false; generation.current++; window.removeEventListener("focus", focus); };
    // client 与初始路由稳定；不因列表/错误变化反复发送会话查询。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, initialView]);
  useEffect(() => { if (cooldown <= 0) return; const timer = setTimeout(() => setCooldown((n) => n - 1), 1000); return () => clearTimeout(timer); }, [cooldown]);
  useEffect(() => { if (view !== initialView || selected) heading.current?.focus(); }, [view, selected, initialView]);
  useEffect(() => {
    // 请求期间输入被禁用，须在恢复可编辑后再移动焦点，读屏和键盘才能落到真正出错的字段。
    if (busy) return;
    if (phoneError) phoneInput.current?.focus();
    else if (codeError || challenge) codeInput.current?.focus();
  }, [busy, phoneError, codeError, challenge]);

  async function sendCode() {
    const normalized = /^1[3-9]\d{9}$/u.test(phone) ? `+86${phone}` : phone;
    if (!/^\+[1-9]\d{7,14}$/u.test(normalized)) { setPhoneError("请输入完整手机号，国际号码请带国家区号。"); phoneInput.current?.focus(); return; }
    await action(async () => {
      setPhoneError(""); setCodeError(""); setChallenge(null); setCooldown(60); verifyAttempt.current = null; setVerifyUncertain(false);
      const result = await client.identity.requestPhoneChallenge({ ...client.identity.newMutation(), phoneNumber: normalized });
      setChallenge(result); setMessage("验证码请求已受理。请查看短信，不会自动重发。"); codeInput.current?.focus();
    });
  }
  async function login(event: FormEvent) {
    event.preventDefault(); if (!challenge || !/^\d{6}$/u.test(code)) return;
    await action(async (ticket) => {
      try {
        // 验证响应丢失时 Cookie 可能已写入：先查会话，不盲目消费第二个验证码操作。
        let current = await client.identity.getSession();
        if (current.status === "refresh-required") current = await client.identity.refreshSession();
        if (current.status !== "authenticated") {
          const previous = verifyAttempt.current;
          if (!previous || previous.challengeId !== challenge.challengeId || previous.code !== code || previous.anonymousContext !== current.csrfToken) {
            verifyAttempt.current = { challengeId: challenge.challengeId, code, anonymousContext: current.csrfToken, ...client.identity.newMutation() };
          }
          current = await client.identity.verifyPhone({ clientMutationId: verifyAttempt.current!.clientMutationId, challengeId: challenge.challengeId, code });
        }
        if (ticket !== generation.current) return;
        setSession(current); accountRef.current = current.accountId; setCode(""); setPhone(""); setChallenge(null); setPhoneError(""); setCodeError(""); verifyAttempt.current = null; setVerifyUncertain(false);
        if (current.accountId) { if (wantedProduct.current) await preparePurchase(wantedProduct.current, ticket);
          else { setView("orders"); await loadOrders(current.accountId, ticket); } }
      } catch (error) {
        if (error instanceof PurchaseClientError && error.outcome === "rejected" && error.code.startsWith("OTP_")) {
          setCodeError("验证码未通过，请检查或重新获取。不会自动注册或合并账号。"); codeInput.current?.focus();
        } else {
          setCodeError(""); setVerifyUncertain(true); setMessage("登录结果暂未确认。请点击下方按钮先确认登录状态，再重试同一次验证；不会重新发短信。");
          return;
        }
        throw error;
      }
    });
  }
  async function recheckSelected() {
    if (!selected) return;
    // 终态仅把核验降为轻操作，仍复用同一原单查询；返回动作不新建订单或改变权益。
    await action(async (ticket) => {
      const id = accountRef.current; if (!id) throw new PurchaseClientError("AUTHENTICATION_REQUIRED");
      const result = await client.reconcileOrder(selected.orderId, id);
      const order = result.order ?? await client.getOrder(selected.orderId, id);
      if (ticket === generation.current) { setSelected(order); if (order.status !== "awaiting-user-payment" || order.fulfillmentStatus !== "not-requested") setQr(null); setCheckedAt(new Date().toISOString()); setMessage(result.status === "not-settled" ? "暂未查到已结算结果，请不要重复付款。" : "已核对原订单状态。"); }
    });
  }
  const activeQr = selected && session?.accountId && selected.status === "awaiting-user-payment" && selected.fulfillmentStatus === "not-requested" &&
    qr?.accountId === session.accountId && qr.orderId === selected.orderId ? qr : null;
  async function copyServiceAddress() {
    try {
      if (!navigator.clipboard) throw new Error("clipboard-unavailable");
      // 只复制固定公开入口，绝不复制原单签名 URL、付款码或账号信息。
      await navigator.clipboard.writeText("https://planchime.com/services/");
      setMessage("已复制官网服务页地址，请在系统浏览器打开。");
    } catch { setMessage("暂未复制成功，请复制当前页面网址，在系统浏览器打开。"); }
  }
  const progress = selected ? orderProgress(selected) : null;
  const terminal = progress === "delivered" || progress === "revoked";
  const back = <Link className={`${styles.link} ${styles.back}`} href="/services/">返回服务与主题</Link>;
  const help = <Link className={styles.link} href="/support/">需要帮助</Link>;
  const status = <div role="status" aria-live="polite" aria-atomic="true">{busy ? <p>处理中…</p> : null}{message ? <p className={styles.notice}>{message}</p> : null}</div>;

  if (view === "catalog") return <section className={styles.portal} aria-labelledby="services-title">
    <div className={styles.headingRow}><h1 id="services-title">服务与主题</h1><Link className={styles.link} href="/services/orders/">我的订单</Link></div>
    <p className={styles.muted}>现有免费功能保持不变，日程与提醒照常使用。</p>
    {status}
    {/* 同一目录中的会员和主题都按服务器事实呈现；卡片不推定价格、有效期或交付已经完成。 */}
    {products.map((product, index) => <article key={product.productId} className={`${styles.theme} ${product.fulfillment.kind === "theme" ? "" : styles.textOnlyProduct}`} aria-labelledby={`catalog-product-${index}`}>
      {product.fulfillment.kind === "theme" ? <div className={styles.art}>{artFailed ? <span>主题预览暂未加载，服务说明仍可查看。</span> : <img src="/images/mosslight-garden-preview.png" alt="" width="1536" height="1024" onError={() => setArtFailed(true)} />}</div> : null}
      <div><p className={styles.kicker}>{product.fulfillment.kind === "theme" ? "原创主题" : "Pro 会员 · 单次购买"}</p><h2 id={`catalog-product-${index}`}>{product.displayName}</h2>
        <p className={styles.availability}>{money(product)} · {product.fulfillment.kind === "theme" ? "一次性购买" : "30 天"}</p>
        <p className={styles.small}>{product.disclosure!.deliverySummary} 不自动续费。</p>
        {product.fulfillment.kind === "fixed-term-membership" ? <p className={styles.small}>有效期从首次发放起计算。</p> : null}
        <div className={styles.actions}><button className={styles.button} disabled={busy || !deviceVariant} onClick={() => {
          wantedProduct.current = product.productId; void action((ticket) => preparePurchase(product.productId, ticket));
        }}>查看并购买</button></div>
        {deviceVariant === null ? <p className={styles.small}>当前浏览器可查看说明与订单，请在支持的浏览器继续付款。</p> : null}
        <p className={styles.small}>{product.disclosure!.compatibility.map((c) => `${platformName[c.platform]} ${c.minimumVersion} 及以上`).join("；")}。</p>
        <a className={styles.link} href={product.disclosure!.refundPolicy.url}>查看退款规则</a>
      </div>
    </article>)}
    {!products.length ? <div className={styles.theme}>
      <div className={styles.art}>{artFailed ? <span>主题预览暂未加载，服务说明仍可查看。</span> : <img src="/images/mosslight-garden-preview.png" alt="" width="1536" height="1024" onError={() => setArtFailed(true)} />}</div>
      <div><p className={styles.kicker}>原创主题预览 / 苔绿 · 纸面 · 窗影</p><h2>苔光书庭</h2>
        <p className={styles.muted}>象牙纸色与柔和窗影，让日常安静下来。<br />改变视觉，不改变你熟悉的日程用法。</p>
        {deviceVariant === null ? <>
          <p className={styles.availability}>当前浏览器暂不支持购买</p>
          <p className={styles.small}>请用手机系统浏览器打开本页，再查看可用的付款方式。你仍可在“我的订单”核对已有订单。</p>
          <button className={`${styles.button} ${styles.secondary}`} onClick={() => void copyServiceAddress()}>复制官网服务页地址</button>
        </> : <><p className={styles.availability}>尚未开放购买</p><p className={styles.small}>适用平台、最低版本与退款规则待核定，当前仅展示艺术预览。</p>
          <div className={styles.actions}><Link className={styles.button} href="/services/purchase-info/">查看主题与服务说明</Link></div>
          <p className={styles.small}>没有创建订单，也不会预扣费用。会员服务暂未开放。</p></>}
      </div>
    </div> : null}
    {!products.length && deviceVariant !== null ? <p className={`${styles.note} ${styles.small}`}>完整主题与权益交付完成验证后，再向你说明。当前正式版本不提供付费主题选择。</p> : null}
  </section>;

  if (view === "confirm" && purchaseProduct?.disclosure && session?.accountId) {
    const d = purchaseProduct.disclosure;
    return <section className={`${styles.portal} ${styles.narrow}`} aria-busy={busy}>
      {back}<h1 ref={heading} tabIndex={-1}>确认购买</h1>{status}
      <dl className={styles.facts}>
        <div><dt>商品与交付</dt><dd>{purchaseProduct.displayName}<br />{d.deliverySummary}{d.exclusions.map((line) => <p key={line} className={styles.small}>{line}</p>)}</dd></div>
        <div><dt>价格与期限</dt><dd>{money(purchaseProduct)} · {purchaseProduct.fulfillment.kind === "theme" ? "一次性购买，不自动续费" : "30 天，从首次发放起计算，不自动续费"}</dd></div>
        <div><dt>接收账号</dt><dd>{accountLabel(session.accountId)} <button className={`${styles.link} ${styles.textAction}`} disabled={busy} onClick={() => void action(async () => {
          await client.identity.logout(client.identity.newMutation()); generation.current++; clearAccount(); setView("login"); setSession(await client.identity.getSession());
        })}>更换账号</button></dd></div>
        <div><dt>适用版本</dt><dd>{d.compatibility.map((c) => <span key={c.platform}>{platformName[c.platform]} {c.minimumVersion} 及以上<br /></span>)}</dd></div>
        <div><dt>退款说明</dt><dd>{d.refundPolicy.summary}<br /><a className={styles.link} href={d.refundPolicy.url}>查看退款规则</a></dd></div>
        <div><dt>收款主体</dt><dd>{d.merchantName}</dd></div>
      </dl>
      <fieldset className={styles.channels} disabled={busy}>
        <legend>付款方式</legend>
        {deviceVariants.map((variant) => {
          const available = purchaseProduct.checkoutVariants?.includes(variant) === true;
          return <label key={variant} className={styles.channel}>
            <input type="radio" name="payment-channel" value={variant} checked={selectedChannel === variant} disabled={!available}
              onChange={() => setSelectedChannel(variant)} />
            <span>{channelName[variant]}{!available ? " · 暂不可用" : ""}</span>
          </label>;
        })}
      </fieldset>
      <button className={`${styles.button} ${styles.full}`} disabled={busy || !selectedChannel || !purchaseProduct.checkoutVariants?.includes(selectedChannel)} onClick={() => void buy()}
        aria-label={`${confirmLabel(selectedChannel)}，${money(purchaseProduct)}`}>{busy ? "正在核对商品与账号…" : confirmLabel(selectedChannel)}</button>
      <p className={`${styles.note} ${styles.small}`}>{selectedChannel === "wechat-native" ? "显示原订单付款码，用手机微信扫一扫；付款后仍需核验。" : selectedChannel === "wechat-h5" ? "将前往微信完成付款，返回后核验原订单。" : selectedChannel ? "将在支付宝完成付款，返回后核验原订单。" : "请主动选择付款方式，再确认这笔购买。"}</p>{help}
    </section>;
  }
  if (view === "policy" || view === "confirm") return <section className={`${styles.portal} ${styles.narrow}`}>
    {back}<h1 ref={heading} tabIndex={-1}>{view === "confirm" ? "暂未开放购买" : "主题与服务说明"}</h1>
    {/* 这里只引用正式服务页已经公开的范围，不自行制定退款期限或补写尚未批准的权益。 */}
    <p className={styles.muted}>会员与主题将在实际功能、权益交付和支付验证完成后一起开放。</p>
    <p>届时会在购买页说明适用平台、版本、交付方式、退款路径与客服方式；当前免费基础服务可以继续使用。</p>
    <Link className={styles.link} href="/services/#planned-services">查看已公布的会员与主题说明</Link>
    {/* 缺少批准元数据时即使键盘提交也无创建动作；不能复制原型里的激活按钮。 */}
    <button className={`${styles.button} ${styles.full}`} disabled>暂未开放购买</button>
    <p className={`${styles.note} ${styles.small}`}>本页不收预付款、不自动续费，也没有免费试用转扣费。免费日程与提醒继续使用。</p>{help}
  </section>;

  if (view === "login") return <section className={`${styles.portal} ${styles.narrow} ${styles.login}`} aria-busy={busy}>
    {back}<h1 ref={heading} tabIndex={-1}>登录后继续</h1><p className={styles.muted}>查看这个账号下的原订单。<br />不会自动合并其他登录方式，也不会开启日程同步。</p>
    <form onSubmit={login}>
      {/* 字段错误分别关联对应输入，不能把手机号问题标到验证码上；编辑后清除该字段的旧错误。 */}
      <div className={styles.field}><label htmlFor="purchase-phone">手机号</label><input id="purchase-phone" ref={phoneInput} type="tel" autoComplete="tel" value={phone} placeholder="输入已绑定的手机号" disabled={busy} onChange={(e) => { setPhone(e.target.value.trim()); setPhoneError(""); setChallenge(null); setCode(""); setCodeError(""); verifyAttempt.current = null; setVerifyUncertain(false); }} aria-invalid={!!phoneError} aria-describedby="login-scope phone-error" /><p id="phone-error" className={styles.error}>{phoneError}</p></div>
      <div className={styles.field}><label htmlFor="purchase-code">验证码</label><div className={styles.otp}>
        <input id="purchase-code" ref={codeInput} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => { setCode(e.target.value.replace(/\D/gu, "")); setCodeError(""); verifyAttempt.current = null; setVerifyUncertain(false); }} aria-invalid={!!codeError} aria-describedby="code-error" disabled={busy} />
        <button type="button" className={`${styles.button} ${styles.secondary}`} onClick={() => void sendCode()} disabled={busy || cooldown > 0 || session?.phoneOtp !== "available"}>{busy ? "处理中…" : cooldown > 0 ? `${cooldown} 秒后可重试` : "获取验证码"}</button>
      </div></div>
      <p id="code-error" className={styles.error}>{codeError}</p><p id="login-scope" className={styles.small}>当前仅支持已接续的手机号。新注册尚未开放。</p>
      {status}<button className={`${styles.button} ${styles.full}`} type="submit" disabled={busy || !challenge || !/^\d{6}$/u.test(code)}>{verifyUncertain ? "确认登录状态并重试" : wantedProduct.current ? "登录并核对购买" : "登录并查看订单"}</button>
      <p className={`${styles.note} ${styles.small}`}>继续前请阅读<Link className={styles.link} href="/terms/">用户协议</Link>与<Link className={styles.link} href="/privacy/">隐私政策</Link>。</p>
    </form>{help}
  </section>;

  return <section className={`${styles.portal} ${styles.narrow} ${selected ? styles.orderDetail : ""}`} aria-busy={busy}>
    {back}<p className={styles.kicker}>{session?.accountId ? accountLabel(session.accountId) : "本人订单"}</p>
    <h1 ref={heading} tabIndex={-1}>{activeQr && !qrExpired ? "用微信扫码付款" : selected ? copy[orderProgress(selected)].title : "我的订单"}</h1>
    {status}
    {selected ? <>
      <p className={styles.muted}>{copy[orderProgress(selected)].detail}</p>
      <dl className={styles.facts}><div><dt>商品</dt><dd>{productLabel(selected.productId)}</dd></div><div><dt>原订单</dt><dd>{selected.orderId} · {money(selected)}</dd></div>
        {selected.merchantDisplayName ? <div><dt>收款主体</dt><dd>{selected.merchantDisplayName}</dd></div> : null}
        <div><dt>付款</dt><dd>{channelName[checkoutVariant(selected.checkoutVariant)]} · {copy[orderProgress(selected)].payment}</dd></div><div><dt>权益</dt><dd>{copy[orderProgress(selected)].delivery}</dd></div></dl>
      {activeQr ? <>
        <p className={styles.qrAmount}><span>订单金额</span><strong>{money(selected)}</strong></p>
        <WechatPaymentCode codeUrl={activeQr.codeUrl} expiresAtUtc={activeQr.expiresAtUtc} onPhone={deviceVariant !== "alipay-pc-web"} />
        <details className={styles.qrHelp}><summary>无法扫码？</summary><p className={styles.small}>请在电脑显示此付款码，再用手机微信扫一扫。手机上查看原订单时，可用另一部手机扫描。长按或相册识别不适用于此付款码；不会自动改换付款方式。</p></details>
      </> : null}
      {progress === "delivered" ? <Link className={`${styles.button} ${styles.full}`} href="/services/">返回服务与主题</Link>
        : progress === "revoked" ? <button className={`${styles.button} ${styles.full}`} disabled={busy} onClick={() => { setSelected(null); setQr(null); }}>返回订单列表</button>
        : <button className={`${styles.button} ${styles.full}`} disabled={busy || !session?.accountId} onClick={() => void recheckSelected()}>{busy ? "处理中…" : progress === "paid-delivery-pending" ? "查看交付进度" : "核验原单"}</button>}
      {/* 两种时间保留各自含义，但不再用整行事实把手机首屏的主操作向下挤。 */}
      <p className={`${styles.small} ${styles.orderMeta}`}>订单更新时间：{time(selected.updatedAtUtc)}。{checkedAt ? <><br />最后成功查询：{time(checkedAt)}。网络中断时只保留这次已知结果。</> : null}</p>
      <div className={styles.actions}>
        {selected.status === "awaiting-user-payment" && selected.fulfillmentStatus === "not-requested" &&
          client.canContinue(checkoutVariant(selected.checkoutVariant)) && !activeQr ? <button className={`${styles.button} ${styles.secondary}`} disabled={busy || !session?.accountId} onClick={() => void action(async (ticket) => {
            const id = accountRef.current; if (!id) throw new PurchaseClientError("AUTHENTICATION_REQUIRED");
            const result = await client.recoverPaymentLink(selected.orderId, id, true);
            if (ticket !== generation.current) return;
            setSelected(result.order);
            setQr(result.qrCode ? { ...result.qrCode, accountId: id, orderId: result.order.orderId } : null);
            if (result.paymentDestination) window.location.assign(result.paymentDestination);
            else if (!result.qrCode) setMessage(result.status === "provider-query-required" ? "付款入口暂不可用，原订单仍需核验，请不要重复下单。" : "已核对原订单，当前未打开付款入口。");
          })}>{selected.checkoutVariant === "wechat-native" ? "显示原订单付款码" : selected.checkoutVariant === "wechat-h5" ? "继续前往微信" : "继续前往支付宝"}</button> : null}
        {terminal ? <button className={`${styles.link} ${styles.textAction}`} disabled={busy || !session?.accountId} onClick={() => void recheckSelected()}>{busy ? "处理中…" : "重新核验"}</button> : null}
        {progress !== "revoked" ? <button className={`${styles.button} ${styles.secondary}`} disabled={busy} onClick={() => { setSelected(null); setQr(null); }}>返回订单列表</button> : null}{help}
      </div>
    </> : <>
      <p className={styles.muted}>只展示当前账号最近 30 笔订单。付款与权益发放分别核对。</p>
      {orders.length ? <ul className={styles.orderList}>{orders.map((order) => <li key={order.orderId}><strong>{productLabel(order.productId)} · {money(order)}</strong><p className={styles.small}>{copy[orderProgress(order)].title}<br />{time(order.createdAtUtc)}</p><button className={`${styles.button} ${styles.secondary}`} disabled={busy} onClick={() => { setSelected(order); setQr(null); }}>查看订单 {order.orderId.slice(-8)}</button></li>)}</ul> : !busy && session?.accountId ? <p>这里还没有可查看的订单。</p> : null}
      {hasMore ? <p className={styles.small}>这里只显示最近 30 笔，更早记录请联系官方支持。</p> : null}
      {unresolved.length ? <div className={styles.notice}><p>有 {unresolved.length} 次操作暂未找到结果。</p><p className={styles.small}>原请求可能仍在处理。已保留原操作标识，不会自动新建订单；请再次核对。</p></div> : null}
      <div className={styles.actions}><button className={styles.button} disabled={busy || !session?.accountId} onClick={() => void action(async (ticket) => { const id = accountRef.current; if (id) await loadOrders(id, ticket); })}>{busy ? "处理中…" : "刷新本人订单"}</button>{help}</div>
    </>}
    {checkedAt && !selected ? <p className={styles.small}>最后成功查询：{time(checkedAt)}。网络中断时只保留这次已知结果。</p> : null}
    {session?.accountId ? <button className={`${styles.button} ${styles.secondary}`} disabled={busy} onClick={() => void action(async () => { await client.identity.logout(client.identity.newMutation()); generation.current++; clearAccount(); setView("login"); setMessage("已退出。重新验证后才能查询订单。"); setSession(await client.identity.getSession()); })}>退出账号</button> : null}
  </section>;
}
