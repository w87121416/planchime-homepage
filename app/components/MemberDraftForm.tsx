"use client";
import { useState } from "react";
import type { PlannerDraft } from "../lib/planner/model";
import styles from "./memberServices.module.css";

/** 文字和语音共用编辑与独立保存确认；调用方必须先通过各自来源/账号契约。 */
export function MemberDraftForm({ initial, zone, notes, busy, onSave, manual = false }: {
  initial: PlannerDraft; zone: string; notes: readonly string[]; busy: boolean; manual?: boolean; onSave: (draft: PlannerDraft, confirmed: boolean) => Promise<void>;
}) {
  const [draft, setDraft] = useState(initial), [confirmed, setConfirmed] = useState(false);
  const update = (key: keyof PlannerDraft, value: string) => { setDraft(old => ({ ...old, [key]: value })); setConfirmed(false); };
  return <form className={styles.form} onSubmit={e => { e.preventDefault(); void onSave(draft, confirmed); }}>
    <p className={styles.hint}>{manual ? "请自行核对日期、时间与时区。网页按输入保存，不转换时区，也不发送到点提醒。" : `草稿按 ${zone} 解释。保存前请核对；网页不转换为其他时区，也不发送到点提醒。`}</p>
    {notes.length ? <ul>{notes.map(note => <li key={note}>{note}</li>)}</ul> : null}
    <label htmlFor="draft-title">事情</label><input id="draft-title" value={draft.title} maxLength={100} required onChange={e => update("title", e.target.value)} />
    <div className={styles.dateFields}><div><label htmlFor="draft-date">日期</label><input id="draft-date" type="date" value={draft.date} onChange={e => update("date", e.target.value)} /></div><div><label htmlFor="draft-time">时间</label><input id="draft-time" type="time" value={draft.time} onChange={e => update("time", e.target.value)} /></div></div>
    <label htmlFor="draft-notes">备注</label><textarea id="draft-notes" rows={4} value={draft.notes} maxLength={2000} onChange={e => update("notes", e.target.value)} />
    <label className={styles.checkbox}><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />我已核对，保存到当前浏览器；退出账号后仍保留。</label>
    <button className={styles.primary} disabled={busy || !confirmed}>确认保存到浏览器</button>
  </form>;
}
