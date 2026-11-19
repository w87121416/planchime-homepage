"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { MemberVoiceController } from "../lib/services/voice-controller";
import { MemberServicesController } from "../lib/services/controller";
import { servicePlannerRepository } from "../lib/services/planner";
import { VOICE_PRIVACY_URL, type VoiceDraft } from "../lib/services/voice-protocol";
import type { VoiceClip } from "../lib/services/voice-audio";
import { MemberDraftForm } from "./MemberDraftForm";
import styles from "./memberServices.module.css";

export function MemberVoice({ parent, accountId, now, onCaptureChange }: { parent: MemberServicesController; accountId: string; now: number; onCaptureChange: (active: boolean) => void }) {
  const [controller] = useState(() => new MemberVoiceController(parent.client, accountId,
    () => parent.getSnapshot().phase === "ready" && parent.getSnapshot().session?.accountId === accountId, parent.invalidate));
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const [confirmed, setConfirmed] = useState(false), [zone, setZone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Shanghai");
  useEffect(() => {
    const unsubscribe = controller.subscribe(() => onCaptureChange(controller.getSnapshot().recording !== "idle"));
    const leave = () => controller.discard(); window.addEventListener("pagehide", leave);
    void controller.load(); return () => { window.removeEventListener("pagehide", leave); unsubscribe(); controller.dispose(); onCaptureChange(false); };
  }, [controller, onCaptureChange]);
  const balances = state.usage?.balances.filter(row => Date.parse(row.validUntil) > now).sort((a, b) => Date.parse(a.validUntil) - Date.parse(b.validUntil));
  const remaining = balances?.reduce((sum, row) => sum + row.voiceSecondsRemaining, 0), capturing = state.recording !== "idle";
  return <div data-voice-capturing={capturing}><h2>语音整理</h2>
    <p>先在本机录音并试听，由你决定是否发送。一次最多 60 秒，登录不会打开麦克风。</p>
    <p>{remaining === undefined ? state.requestId ? "本次语音额度仍待核对，请查询本次语音结果。" : state.phase === "unavailable" ? "暂时无法查看语音额度，请稍后重新核验。" : "正在核对语音额度。" : `当前账号剩余语音 ${remaining} 秒。`}</p>
    {balances?.length ? <ul aria-label="语音额度与到期时间">{balances.map((row, index) => <li key={`${row.validUntil}-${index}`}>剩余 {row.voiceSecondsRemaining} 秒 · 有效至 {new Date(row.validUntil).toLocaleString("zh-CN")}</li>)}</ul> : null}
    {state.error ? <p role="alert" className={styles.error}>{state.error}</p> : null}<p role="status">{state.notice}</p>
    {state.phase === "unavailable" ? <button type="button" disabled={state.busy} onClick={() => void controller.load()}>重新查看语音开放情况</button> : null}
    {!state.requestId && !state.clip ? <div className={styles.form}>
      <label htmlFor="voice-timezone">录音使用的时区</label><input id="voice-timezone" value={zone} onChange={e => setZone(e.target.value)} disabled={capturing || state.busy} />
      {capturing ? <><p role="status">{state.recording === "permission" ? "请在浏览器提示中选择是否允许麦克风。" : `正在本机录音 · ${state.seconds.toFixed(1)} / 60 秒`}</p><div className={styles.actions}>
        {state.recording === "recording" ? <button type="button" className={styles.primary} onClick={() => controller.stop()}>停止并试听</button> : null}<button type="button" onClick={() => { controller.discard(); setConfirmed(false); }}>取消本机录音</button></div></> :
        <button type="button" className={styles.primary} disabled={state.phase !== "ready" || state.busy || !remaining} onClick={() => { setConfirmed(false); void controller.record(zone); }}>开始本机录音</button>}
    </div> : null}
    {state.clip ? <section className={styles.disclosure} aria-label="本机录音预览"><h3>本机录音</h3><p>{state.clip.seconds.toFixed(2)} 秒 · 本次预计使用 {state.clip.units} 秒语音额度（向上取整），不扣文字次数。最终以服务端实际音频样本计量为准。</p>
      <LocalAudio clip={state.clip} /><p>录音时区：{state.timeZoneId}。时间参照为本次开始录音的时间。</p>
      <button type="button" onClick={() => { controller.discard(); setConfirmed(false); }}>取消本机录音</button>
    </section> : null}
    {!state.requestId && state.clip ? <form className={styles.form} onSubmit={e => { e.preventDefault(); void controller.send(confirmed); setConfirmed(false); }}>
      <div className={styles.disclosure}><p>确认后，将这段录音发送给阿里云百炼北京，先转写为文字，再将转写文字交给百炼／通义千问整理为日程草稿。这两个步骤都由本次确认授权。</p>
        <p>{parent.client.configuration.voiceRetentionDisclosure}</p><p>米堆不持久保存原始录音；百炼对调用数据的保存依其服务协议及法规要求处理。<a href={VOICE_PRIVACY_URL} target="_blank" rel="noreferrer">查看百炼隐私说明</a></p>
        <p>尚未上传不消耗额度；服务端确定拒绝时释放本次预占。结果未知时保留本次语音额度并查询原请求。取消浏览器等待不表示服务端取消或额度返还。结果不会自动保存或安排提醒。</p></div>
      <label className={styles.checkbox}><input type="checkbox" checked={confirmed} disabled={state.busy} onChange={e => setConfirmed(e.target.checked)} />我已了解上述说明，同意上传这段录音，完成转写与日程整理。</label>
      <button className={styles.primary} disabled={state.busy || !confirmed || (remaining ?? 0) < state.clip.units}>确认上传并整理语音</button>
    </form> : null}
    {state.requestId ? <div><p role="status">{state.rejectedBeforeTask ? "服务暂未受理这次录音，没有开始处理。你可以结束本次请求，保留录音稍后再决定。" : state.draft?.state === "ready" && state.draft.proposal ? "已整理成草稿。确认日期和时间后，再保存到浏览器。" : state.draft?.state === "failed" ? "这次没有生成日程草稿，已有日程没有改变。" : "这次处理结果还在核对，请先查询本次结果。"}</p>
      {state.draft ? <p>本次计量 {state.draft.units} 秒 · {state.draft.usageState === "released" ? "已释放预占额度" : state.draft.usageState === "succeeded" ? "已使用语音额度" : "额度仍在核对"}</p> : null}
      <button type="button" disabled={state.busy} onClick={() => void controller.query()}>查询本次语音结果</button>
      {state.draft?.contentAvailable ? <VoiceResult key={state.draft.requestId} draft={state.draft} controller={controller} busy={state.busy} zone={state.timeZoneId} /> : state.draft ? <p>这份内容暂时无法查看。当前浏览器中已保存的日程不受影响。</p> : null}
      {state.rejectedBeforeTask || (state.draft && ["ready", "failed"].includes(state.draft.state)) ? <button type="button" disabled={state.busy} onClick={() => void controller.finish()}>{state.rejectedBeforeTask ? "结束本次未受理请求" : "结束查看本次语音结果"}</button> : null}
    </div> : null}
    {state.consent && !state.consent.revokedAt ? <details className={styles.help}><summary>语音处理授权</summary><p>撤回授权会停止本机录音并清除当前展示，不改变已保存在浏览器的日程。</p><button type="button" onClick={() => { setConfirmed(false); void controller.revoke(); }}>撤回语音处理授权</button></details> : null}
  </div>;
}
function LocalAudio({ clip }: { clip: VoiceClip }) {
  const player = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const audio = player.current;
    const url = URL.createObjectURL(new Blob([clip.wav.slice().buffer], { type: "audio/wav" })); if (audio) audio.src = url;
    // 撤回、切号、离开面板立即撤销试听 URL；音频不写 localStorage 或日志。
    return () => { if (audio) { audio.pause(); audio.removeAttribute("src"); audio.load(); } URL.revokeObjectURL(url); };
  }, [clip]);
  return <audio ref={player} controls preload="metadata" aria-label="试听本机录音" style={{ width: "100%" }} />;
}
function VoiceResult({ draft, controller, busy, zone }: { draft: VoiceDraft; controller: MemberVoiceController; busy: boolean; zone: string }) {
  const [manual, setManual] = useState(false), [transcript, setTranscript] = useState(draft.transcript ?? "");
  const proposal = draft.proposal;
  return <div>
    {draft.transcript ? <div className={styles.form}><label htmlFor="voice-transcript">转写文字（可自行修改，不会再次发送）</label><textarea id="voice-transcript" rows={5} value={transcript} maxLength={8000} onChange={e => setTranscript(e.target.value)} />{!proposal ? <button type="button" onClick={() => setManual(true)}>手动整理转写文字</button> : null}</div> : null}
    {proposal ? <MemberDraftForm initial={proposal.draft} zone={proposal.timeZoneId} notes={proposal.reviewNotes} busy={busy} onSave={(value, confirmed) => controller.save(servicePlannerRepository, value, confirmed)} /> :
      manual ? <MemberDraftForm manual initial={{ title: "", date: "", time: "", notes: "" }} zone={zone} notes={["请参考上方转写文字，自行填写本次日程。手动保存不调用 AI，也不表示未知请求已结算。"]} busy={busy} onSave={(value, confirmed) => controller.save(servicePlannerRepository, value, confirmed)} /> : null}
  </div>;
}
