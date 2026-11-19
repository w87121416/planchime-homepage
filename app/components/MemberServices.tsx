"use client";

import { useEffect, useState, useSyncExternalStore, type CSSProperties, type FormEvent } from "react";
import { WebMemberServiceClient } from "../lib/services/client";
import { MemberServicesController, type MemberServicesState } from "../lib/services/controller";
import { servicePlannerRepository } from "../lib/services/planner";
import { mosslightWebManifest, ownsMosslight, themeVariables } from "../lib/services/theme";
import type { PlannerDraft } from "../lib/planner/model";
import styles from "./memberServices.module.css";
import { MemberBackup } from "./MemberBackup";
import { broadcastServiceInvalidation as broadcast, subscribeServiceInvalidation } from "../lib/services/session-events";

const sections = [["text", "文字整理"], ["voice", "语音整理"], ["backup", "云备份"], ["theme", "主题"]] as const;
const date = (value: string) => new Date(value).toLocaleString("zh-CN", { hour12: false });
const subscribeClock = (notify: () => void) => { const timer = setInterval(notify, 1000); return () => clearInterval(timer); };
const clockSnapshot = () => Math.floor(Date.now() / 1000) * 1000;
const serverClock = () => 0;

export function MemberServices({ controller: supplied }: { controller?: MemberServicesController }) {
  const [controller] = useState(() => supplied ?? new MemberServicesController(new WebMemberServiceClient()));
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const now = useSyncExternalStore(subscribeClock, clockSnapshot, serverClock);
  const [section, setSection] = useState<(typeof sections)[number][0]>("text");
  useEffect(() => {
    void controller.refresh();
    const focus = () => { void controller.refresh(); };
    const offline = () => controller.invalidate();
    const unsubscribe = subscribeServiceInvalidation(controller.invalidate);
    window.addEventListener("focus", focus); window.addEventListener("offline", offline);
    return () => { controller.invalidate(); unsubscribe(); window.removeEventListener("focus", focus); window.removeEventListener("offline", offline); };
  }, [controller]);
  const ownsTheme = ownsMosslight(state.entitlements, state.session?.accountId ?? null, now);
  const applied = state.themeApplied && ownsTheme;
  return <div className={styles.workspace} style={applied ? themeVariables(mosslightWebManifest) as CSSProperties : undefined} data-service-theme={applied ? "mosslight" : "free"}>
    <header className={styles.intro}><p className={styles.eyebrow}>记上日成 · 网页服务</p><h1>我的服务</h1><p>登录用于查看本人权益和使用会员服务。当前浏览器中的日程不会自动上传。</p><a href="/planner/">继续使用免费网页日程 →</a></header>
    <section aria-label="当前账号" className={styles.account}>
      <div><strong>{state.phase === "closed" ? "会员服务尚未开放" : state.phase === "checking" ? "正在核验账号与权益…" : state.session?.status === "authenticated" ? `当前账号 · ${state.session.accountId}` : "尚未登录"}</strong>
        <p>{state.checkedAt ? `权益核验时间：${date(state.checkedAt)}` : "免费日程和本地文件备份可以继续使用。"}</p></div>
      {state.phase !== "closed" ? <div className={styles.actions}><button type="button" disabled={state.busy || state.phase === "checking"} onClick={() => void controller.refresh()}>重新核验</button>
        {state.session?.status === "authenticated" ? <button type="button" onClick={() => { broadcast(); void controller.logout(); }}>退出账号</button> : null}</div> : null}
    </section>
    {state.phase === "anonymous" ? <ServiceSignIn key="anonymous" controller={controller} state={state} /> : null}
    <div className={styles.feedback}>{state.error ? <p role="alert" className={styles.error}>{state.error}</p> : null}<p role="status">{state.notice}</p></div>
    <div className={styles.tabs} aria-label="服务类别">{sections.map(([key, name]) => <button key={key} type="button" aria-pressed={section === key} aria-controls="member-service-panel" onClick={() => setSection(key)}>{name}</button>)}</div>
    <section id="member-service-panel" className={styles.panel} aria-label={sections.find(([key]) => key === section)?.[1]}>
      {section === "text" ? state.phase === "ready" ? <TextService key={state.session!.accountId} controller={controller} state={state} now={now} /> : <Unavailable title="文字整理" description={state.phase === "closed" ? "文字整理尚未开放。你可以先在免费网页日程中记录安排。" : "核验本人账号后，可查看文字整理的开放情况和剩余额度。"} /> : null}
      {section === "voice" ? <Unavailable title="语音整理" description="语音整理尚未开放。你可以切换到文字整理，或直接手动记录日程。" /> : null}
      {section === "backup" ? state.phase === "ready" && controller.client.configuration.backupEnabled ? <MemberBackup key={state.session!.accountId} controller={controller} accountId={state.session!.accountId!} /> : <Unavailable title="云备份" description="云备份尚未开放。你仍可在免费网页日程中导出、恢复本地备份文件。" /> : null}
      {section === "theme" ? <div><h2>苔光书庭</h2><p className={styles.hint}>安静的绿色与暖白纸面。这里展示真实主题原图。</p>
        {/* 原图仅为预览；授权和资源都核验后，按钮才允许应用实际外观。 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.preview} src={mosslightWebManifest.artworkUrl} alt="苔光书庭原创主题：绿色植物与安静书庭" onError={() => controller.freeTheme()} />
        <p>{state.phase !== "ready" ? "登录并核验权益后，可查看是否能使用这款主题。" : ownsTheme ? "当前账号拥有这款主题。" : themeStatus(state)}</p>
        {!controller.client.configuration.themeEnabled ? <p>主题应用尚未开放，免费外观可继续使用。</p> : null}
        <div className={styles.actions}><button type="button" className={styles.primary} disabled={!ownsTheme || !controller.client.configuration.themeEnabled || state.busy} onClick={() => controller.applyTheme(mosslightWebManifest)}>应用到网页日程</button>
          <button type="button" onClick={() => controller.freeTheme()}>使用免费外观</button></div>
        <p className={styles.hint}>切换外观不改变事项、输入或日期。退出账号或权益核验失败时回到免费外观。</p></div> : null}
    </section>
    <footer className={styles.help}><a href="/services/">已公布的商品与服务说明</a><span> · </span><a href="/contact/">帮助与反馈</a></footer>
  </div>;
}
function themeStatus(state: MemberServicesState) {
  const grant = state.entitlements?.entitlements.find(row => row.entitlementKey === "theme.mosslight-garden.paper.owned");
  return grant?.lifecycleState === "refunded" || grant?.lifecycleState === "revoked" ? "这款主题的权益已撤回，正在使用免费外观。" : grant?.lifecycleState === "expired" ? "这款主题的使用权限已结束，正在使用免费外观。" : "当前账号还没有这款主题的可用权益。";
}
function Unavailable({ title, description }: { title: string; description: string }) {
  return <div className={styles.unavailable}><h2>{title}</h2><p>{description}</p><button disabled type="button">尚未开放</button></div>;
}
function ServiceSignIn({ controller, state }: { controller: MemberServicesController; state: MemberServicesState }) {
  const [phone, setPhone] = useState(""), [code, setCode] = useState(""), [challenge, setChallenge] = useState<string | null>(null), [cooldown, setCooldown] = useState(0), [verifyUncertain, setVerifyUncertain] = useState(false);
  useEffect(() => { if (!cooldown) return; const timer = setTimeout(() => setCooldown(old => old - 1), 1000); return () => clearTimeout(timer); }, [cooldown]);
  if (state.session?.phoneOtp !== "available") return <p>手机号登录暂未开放。你可以继续使用免费网页日程。</p>;
  return <form className={styles.form} onSubmit={(event: FormEvent) => { event.preventDefault(); if (!challenge || verifyUncertain) return; setVerifyUncertain(true); broadcast(); void controller.verify(challenge, code); }}>
    <h2>使用原手机号登录</h2><p className={styles.hint}>仅支持已经接续到网页服务的手机号，不提供通用注册。</p>
    <label htmlFor="service-phone">手机号（含国家或地区代码）</label><input id="service-phone" type="tel" autoComplete="tel" value={phone} placeholder="+86" pattern="\+[1-9][0-9]{7,14}" onChange={e => { setPhone(e.target.value); setChallenge(null); }} disabled={state.busy || verifyUncertain} />
    <button type="button" disabled={state.busy || cooldown > 0 || verifyUncertain || !/^\+[1-9][0-9]{7,14}$/.test(phone)} onClick={() => { setCooldown(60); void controller.sendCode(phone).then(setChallenge); }}>{cooldown ? `${cooldown} 秒后可重新发送` : "发送验证码"}</button>
    {challenge ? <><label htmlFor="service-code">短信验证码</label><input id="service-code" inputMode="numeric" autoComplete="one-time-code" value={code} maxLength={6} pattern="[0-9]{6}" onChange={e => setCode(e.target.value)} disabled={state.busy || verifyUncertain} /><button className={styles.primary} disabled={state.busy || verifyUncertain || !/^[0-9]{6}$/.test(code)}>确认登录</button></> : null}
    {verifyUncertain ? <p>请使用“重新核验”查看登录结果，不要重复提交验证码。</p> : null}
  </form>;
}
function TextService({ controller, state, now }: { controller: MemberServicesController; state: MemberServicesState; now: number }) {
  const [source, setSource] = useState(""), [confirmed, setConfirmed] = useState(false);
  const [timeZone, setTimeZone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Shanghai");
  const config = controller.client.configuration;
  if (!config.textEnabled || !config.textRetentionDisclosure || state.textUnavailable) return <Unavailable title="文字整理" description="文字整理尚未开放。你可以先在免费网页日程中记录安排。" />;
  const balances = state.usage?.balances.filter(row => Date.parse(row.validUntil) > now).sort((a, b) => Date.parse(a.validUntil) - Date.parse(b.validUntil));
  const remaining = balances?.reduce((sum, row) => sum + row.textRemaining, 0);
  return <div><h2>文字整理</h2><p>{remaining === undefined ? "暂时无法查看剩余额度，请重新核验。" : remaining === 0 ? "当前没有可用的文字整理额度，手动记录日程不消耗额度。" : `当前账号剩余文字整理 ${remaining} 次。`}</p>
    {/* 每批额度单独列出期限，不能用最晚到期时间掩盖即将失效的额度。 */}
    {balances?.length ? <ul aria-label="文字额度与到期时间">{balances.map((row, index) => <li key={`${row.validUntil}-${index}`}>剩余 {row.textRemaining} 次 · 有效至 {date(row.validUntil)}</li>)}</ul> : null}
    {!state.requestId ? <form className={styles.form} onSubmit={e => { e.preventDefault(); void controller.sendText(source, timeZone, confirmed); setConfirmed(false); }}>
      <label htmlFor="service-source">想安排的事情</label><textarea id="service-source" value={source} maxLength={8000} rows={5} onChange={e => { setSource(e.target.value); setConfirmed(false); }} disabled={state.busy} placeholder="先写下安排，整理后还会请你确认。" />
      <label htmlFor="service-timezone">解析时区</label><input id="service-timezone" value={timeZone} onChange={e => { setTimeZone(e.target.value); setConfirmed(false); }} disabled={state.busy} />
      <div className={styles.disclosure}><p>确认后，将这次输入的文字发送给阿里云百炼／通义千问，用于整理日程草稿。不会发送本地日程本。</p><p>{config.textRetentionDisclosure}</p><p>本次使用 1 次文字额度。尚未发送不消耗额度；服务端明确拒绝时释放本次预占额度。结果未知时保留本次额度并核对原请求，取消等待不代表额度已返还。</p><p>结果需要你核对，不会自动保存或安排提醒。</p></div>
      <label className={styles.checkbox}><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} disabled={state.busy} />我已了解上述说明，同意发送这次文字。</label>
      <button className={styles.primary} disabled={state.busy || !confirmed || !source.trim() || !remaining}>确认发送并整理</button>
    </form> : <TextResult controller={controller} state={state} />}
    {state.consent ? <details className={styles.help}><summary>文字处理授权</summary><p>你可以撤回授权；已保存到浏览器的日程不会改变。</p><button type="button" disabled={state.busy} onClick={() => void controller.revoke()}>撤回文字处理授权</button></details> : null}
  </div>;
}
function TextResult({ controller, state }: { controller: MemberServicesController; state: MemberServicesState }) {
  const draft = state.draft;
  const editable = draft?.state === "ready" && draft.contentAvailable && draft.proposal;
  const status = !draft || ["queued", "running", "indeterminate"].includes(draft.state) ? "这次处理结果还在核对，请先查询本次结果。" : draft.state === "ready" ? editable ? "已整理成草稿。确认日期和时间后，再保存到浏览器。" : "这份结果已经无法查看，当前浏览器中已保存的日程不受影响。" : draft.state === "cancelled" ? "本次尚未开始的整理已取消。" : "本次没有生成可用草稿，已有日程没有改变。";
  return <div><p role="status">{status}</p><div className={styles.actions}><button type="button" disabled={state.busy} onClick={() => void controller.query()}>查询本次结果</button>{draft?.state === "queued" ? <button type="button" disabled={state.busy} onClick={() => void controller.cancel()}>取消尚未开始的整理</button> : null}</div>
    {editable ? <EditableDraft key={draft.requestId} controller={controller} state={state} initial={editable.draft} zone={editable.timeZoneId} notes={editable.reviewNotes} /> : null}
    {draft && ["ready", "failed", "cancelled"].includes(draft.state) ? <button className={styles.secondary} type="button" disabled={state.busy} onClick={() => void controller.finishRequest()}>结束查看本次结果</button> : null}
  </div>;
}
function EditableDraft({ controller, state, initial, zone, notes }: { controller: MemberServicesController; state: MemberServicesState; initial: PlannerDraft; zone: string; notes: readonly string[] }) {
  const [draft, setDraft] = useState(initial), [confirmed, setConfirmed] = useState(false);
  const update = (key: keyof PlannerDraft, value: string) => { setDraft(old => ({ ...old, [key]: value })); setConfirmed(false); };
  return <form className={styles.form} onSubmit={e => { e.preventDefault(); void controller.saveDraft(servicePlannerRepository, draft, confirmed); }}>
    <p className={styles.hint}>草稿按 {zone} 解释。保存前请核对；网页不转换为其他时区，也不发送到点提醒。</p>
    {notes.length ? <ul>{notes.map(note => <li key={note}>{note}</li>)}</ul> : null}
    <label htmlFor="draft-title">事情</label><input id="draft-title" value={draft.title} maxLength={100} required onChange={e => update("title", e.target.value)} />
    <div className={styles.dateFields}><div><label htmlFor="draft-date">日期</label><input id="draft-date" type="date" value={draft.date} onChange={e => update("date", e.target.value)} /></div><div><label htmlFor="draft-time">时间</label><input id="draft-time" type="time" value={draft.time} onChange={e => update("time", e.target.value)} /></div></div>
    <label htmlFor="draft-notes">备注</label><textarea id="draft-notes" rows={4} value={draft.notes} maxLength={2000} onChange={e => update("notes", e.target.value)} />
    <label className={styles.checkbox}><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />我已核对，保存到当前浏览器；退出账号后仍保留。</label>
    <button className={styles.primary} disabled={state.busy || !confirmed}>确认保存到浏览器</button>
  </form>;
}
