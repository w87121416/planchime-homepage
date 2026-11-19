"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { browserRepository, downloadText } from "../lib/planner/browser";
import { emptyDocument, localDate, MAX_BACKUP_BYTES, parseDocument, PLANNER_KEY, PlannerError, sortItems, type PlannerDocument, type PlannerDraft, type PlannerItem } from "../lib/planner/model";
import styles from "./planner.module.css";

const blank: PlannerDraft = { title: "", date: "", time: "", notes: "" };
const failure = (error: unknown) => error instanceof PlannerError ? error.message : "这次操作还没有完成，内容仍保留着。请重试或联系支持。";

export function PlannerWorkbench() {
  const repository = useRef<ReturnType<typeof browserRepository> | null>(null);
  const [document, setDocument] = useState<PlannerDocument>(emptyDocument);
  const [loaded, setLoaded] = useState(false);
  const [readError, setReadError] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [draft, setDraft] = useState<PlannerDraft>(blank);
  const [editing, setEditing] = useState<PlannerItem | null>(null);
  const [filter, setFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [today, setToday] = useState("");
  const [pendingImport, setPendingImport] = useState<PlannerDocument | null>(null);
  const [backupText, setBackupText] = useState("");
  const [deleting, setDeleting] = useState<PlannerItem | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  const importGeneration = useRef(0);
  const titleRef = useRef<HTMLInputElement>(null);
  const dirty = editing ? Object.keys(blank).some((key) => draft[key as keyof PlannerDraft] !== editing[key as keyof PlannerDraft]) : Object.values(draft).some(Boolean);

  const reload = useCallback(() => {
    try { setDocument(repository.current!.read()); setReadError(""); }
    catch (reason) { setReadError(failure(reason)); }
    setLoaded(true);
  }, []);

  useEffect(() => {
    repository.current = browserRepository();
    // 首次挂载才读取用户浏览器存储和本地日期；服务端静态导出不能假定这些外部状态。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload(); setToday(localDate(new Date()));
    const refresh = () => { setToday(localDate(new Date())); reload(); };
    const changed = (event: StorageEvent) => {
      if (event.key === PLANNER_KEY || event.key === null) {
        reload(); setNotice("另一页面更新了日程，列表已刷新；当前输入保持不变。");
      }
    };
    window.addEventListener("storage", changed); window.addEventListener("focus", refresh);
    const clock = window.setInterval(() => setToday(localDate(new Date())), 60_000);
    return () => { window.removeEventListener("storage", changed); window.removeEventListener("focus", refresh); window.clearInterval(clock); };
  }, [reload]);

  useEffect(() => {
    const leave = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ""; } };
    const navigate = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!dirty || !target || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || target.getAttribute("target") === "_blank") return;
      const url = new URL(target.getAttribute("href")!, window.location.href);
      if (url.origin === window.location.origin && url.pathname === window.location.pathname) return;
      if (!window.confirm("当前输入还没有保存。要离开此页并放弃这次输入吗？")) {
        event.preventDefault(); event.stopImmediatePropagation();
      }
    };
    // 浏览器关闭或刷新可能丢失尚未保存的输入；只在确有草稿时请求原生确认。
    window.addEventListener("beforeunload", leave);
    window.document.addEventListener("click", navigate, true);
    return () => { window.removeEventListener("beforeunload", leave); window.document.removeEventListener("click", navigate, true); };
  }, [dirty]);

  useEffect(() => {
    if (deleting) { dialogRef.current?.showModal(); keepRef.current?.focus(); }
    else dialogRef.current?.close();
  }, [deleting]);

  const act = async (operation: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError(""); setNotice("");
    try { await operation(); }
    catch (reason) { setError(failure(reason)); reload(); }
    finally { busyRef.current = false; setBusy(false); }
  };
  const save = (event: FormEvent) => {
    event.preventDefault();
    void act(async () => {
      const saved = await repository.current!.save(draft, editing ?? undefined);
      setDocument(saved.document); setDraft(blank); setEditing(null); setFilter("all"); setDateFilter("");
      setNotice("已保存在当前浏览器，列表已切换为全部日程。"); titleRef.current?.focus();
    });
  };
  const discardAllowed = () => !dirty || window.confirm("当前输入还没有保存。要放弃这次输入吗？");
  const edit = (item: PlannerItem) => {
    if (!discardAllowed()) return;
    setEditing(item); setDraft({ title: item.title, date: item.date, time: item.time, notes: item.notes }); setError(""); setNotice("");
    titleRef.current?.focus(); titleRef.current?.scrollIntoView({ block: "center", behavior: "instant" });
  };
  const download = (text: string, name: string) => {
    setBackupText(text);
    try { downloadText(text, name); setNotice("备份文件已准备好，请确认下载已完成。也可复制下方备份文本。"); }
    catch { setError("下载未能启动，内容仍保留。请复制下方备份文本，保存为 JSON 文件。"); }
  };
  const exportSaved = () => {
    try {
      const latest = repository.current!.read(); setDocument(latest);
      // 使用与持久化一致的紧凑格式，防止缩进把接近2MB上限的备份扩到不可恢复。
      download(JSON.stringify(latest), `记上日成网页日程-${localDate(new Date())}.json`);
    } catch (reason) { setError(failure(reason)); }
  };
  const exportDraft = () => {
    // 未保存的草稿单独导出，不冒充可恢复的已保存日程或成功提交。
    download(JSON.stringify({ format: "planchime-unsaved-draft", ...draft }, null, 2), "记上日成-未保存输入.json");
  };
  const readBackup = async (file?: File) => {
    if (!file) return;
    const generation = ++importGeneration.current;
    setError(""); setPendingImport(null);
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new PlannerError("invalid", "文件超过 2MB，暂不支持导入。");
      const parsed = parseDocument(await file.text());
      if (generation === importGeneration.current) setPendingImport(parsed);
    } catch (reason) { if (generation === importGeneration.current) setError(failure(reason)); }
  };

  if (!loaded) return <p className={styles.loading} role="status">正在读取当前浏览器中的日程…</p>;
  const visible = sortItems(document.items).filter((item) =>
    dateFilter ? item.date === dateFilter : filter === "today" ? item.date === today : filter === "unscheduled" ? !item.date : true);
  const pending = visible.filter((item) => !item.completed);
  const completed = visible.filter((item) => item.completed);
  const locked = busy || Boolean(readError);
  const field = (key: keyof PlannerDraft, value: string) => {
    setDraft((old) => ({ ...old, [key]: value }));
    // 新输入尚未写入时撤下旧的成功反馈，不能让上次保存替本次草稿背书。
    setNotice(""); setError("");
  };

  const row = (item: PlannerItem) => <li key={item.id} className={styles.item}>
    <label className={styles.completion}><input type="checkbox" checked={item.completed} disabled={locked} aria-label={`${item.completed ? "撤销完成" : "完成"}：${item.title}`} onChange={() => void act(async () => {
      const result = await repository.current!.setCompleted(item, !item.completed); setDocument(result.document);
      if (editing?.id === item.id) setEditing(result.document.items.find((next) => next.id === item.id) ?? null);
      setNotice(item.completed ? "已恢复为待办，并保存在当前浏览器。" : "已完成，并保存在当前浏览器。");
    })} /><span className={styles.srOnly}>{item.completed ? "已完成" : "待办"}</span></label>
    <div className={styles.itemBody}>
      <h3 className={item.completed ? styles.done : undefined}>{item.title}</h3>
      <p className={styles.itemDate}>{item.date ? `${item.date} · ${item.time || "未设时间"}` : "待安排"}{!item.completed && item.date && item.date < today ? " · 原定日期已过" : ""}</p>
      {item.notes ? <p className={styles.notes}>{item.notes}</p> : null}
      <div className={styles.rowActions}><button type="button" onClick={() => edit(item)} disabled={locked} aria-label={`编辑：${item.title}`}>编辑</button><button type="button" className={styles.danger} onClick={() => { setError(""); setDeleting(item); }} disabled={locked} aria-label={`删除：${item.title}`}>删除</button></div>
    </div>
  </li>;

  return <div className={styles.workbench}>
    {readError ? <div className={styles.error} role="alert"><p>{readError}</p><button type="button" onClick={reload}>重新读取</button><button type="button" onClick={() => {
      try { const raw = window.localStorage.getItem(PLANNER_KEY); if (raw === null) throw new Error(); download(raw, "记上日成-原始本地数据.json"); }
      catch { setError("浏览器仍不允许读取原始数据。请保留当前浏览器数据并联系支持。"); }
    }}>下载原始数据</button></div> : null}
    <div className={styles.feedback}>
      <p role="status">{notice}</p>
      {error ? <p role="alert" className={styles.error}>{error}</p> : null}
    </div>
    <div className={styles.columns}>
      <form className={styles.editor} onSubmit={save} aria-labelledby="editor-title">
        <div className={styles.editorHeading}><h2 id="editor-title">{editing ? "修改这件事" : "记下一件事"}</h2><span>免费</span></div>
        <label htmlFor="planner-title">事情 <span>必填</span></label>
        <input id="planner-title" ref={titleRef} value={draft.title} onChange={(e) => field("title", e.target.value)} maxLength={100} required disabled={busy} placeholder="例如：周末去图书馆" autoComplete="off" />
        <div className={styles.dateFields}>
          <div><label htmlFor="planner-date">日期 <span>选填</span></label><input id="planner-date" type="date" min="1900-01-01" max="9999-12-31" value={draft.date} onChange={(e) => field("date", e.target.value)} disabled={busy} /></div>
          <div><label htmlFor="planner-time">时间 <span>选填</span></label><input id="planner-time" type="time" value={draft.time} onChange={(e) => field("time", e.target.value)} disabled={busy} /></div>
        </div>
        <p className={styles.hint}>时间没定也可以先保存，不会自动设置提醒。</p>
        <label htmlFor="planner-notes">备注 <span>选填</span></label>
        <textarea id="planner-notes" rows={3} maxLength={2000} value={draft.notes} onChange={(e) => field("notes", e.target.value)} disabled={busy} placeholder="留一点线索，方便之后接着做" />
        {dirty ? <p className={styles.hint}>当前输入尚未保存。</p> : null}
        <button type="submit" className={styles.primary} disabled={locked}>{busy ? "正在保存…" : editing ? "保存修改" : "保存日程"}</button>
        {editing ? <button type="button" className={styles.cancel} disabled={busy} onClick={() => { if (discardAllowed()) { setEditing(null); setDraft(blank); setError(""); reload(); } }}>取消编辑</button> : null}
        {(error || readError) && dirty ? <button type="button" className={styles.cancel} onClick={exportDraft}>下载未保存的输入</button> : null}
      </form>

      <section className={styles.schedule} aria-labelledby="schedule-title">
        <div className={styles.listHeading}><h2 id="schedule-title">我的日程</h2><span>当前浏览器 · {document.items.length} 条</span></div>
        <div className={styles.filters} role="group" aria-label="筛选日程">
          {[["all", "全部"], ["today", "今天"], ["unscheduled", "待安排"]].map(([value, label]) => <button type="button" key={value} aria-pressed={!dateFilter && filter === value} onClick={() => { setFilter(value); setDateFilter(""); }}>{label}</button>)}
          <div className={styles.dateFilter}><label htmlFor="filter-date">按日期查看</label><input id="filter-date" type="date" value={dateFilter} onChange={(e) => { setDateFilter(e.target.value); setFilter("all"); }} /></div>
        </div>
        {!readError ? <>
          {pending.length ? <ul className={styles.list} aria-label="待办日程">{pending.map(row)}</ul> : <div className={styles.empty}><span aria-hidden="true">○</span><h3>{!document.items.length ? "给下一件事，留个位置。" : completed.length ? "当前列表已全部完成。" : "这里暂时没有安排。"}</h3><p>{!document.items.length ? "先记下一件事，时间可以以后再安排。" : "可以换个日期看看，也可以继续记下新的事情。"}</p>{document.items.length > 0 && (dateFilter || filter !== "all") ? <button onClick={() => { setDateFilter(""); setFilter("all"); }}>查看全部</button> : null}</div>}
          {completed.length > 0 ? <details className={styles.completed}><summary>已完成（{completed.length}）</summary><ul className={styles.list} aria-label="已完成日程">{completed.map(row)}</ul></details> : null}
        </> : <p className={styles.hint}>读取恢复前暂停修改，避免覆盖原始内容。</p>}
      </section>
    </div>

    <details className={styles.backup}>
      <summary>备份与恢复 <span>把日程留一份在自己手里</span></summary>
      <p>导出包含全部已保存事项，不受筛选影响。恢复仅添加缺失事项，已有事项保留当前版本，不会被备份覆盖。文件仅在当前浏览器读取，不会上传。</p>
      <div className={styles.backupActions}><button type="button" onClick={exportSaved} disabled={locked}>导出全部日程</button><label className={styles.fileLabel}>选择备份文件<input type="file" accept=".json,application/json" disabled={locked} onChange={(e) => { void readBackup(e.target.files?.[0]); e.target.value = ""; }} /></label></div>
      {pendingImport ? <div className={styles.importPreview} role="region" aria-label="恢复预览"><h3>恢复前，先确认一下</h3><p>备份包含 {pendingImport.items.length} 条事项。将添加 {pendingImport.items.filter((item) => !document.items.some((current) => item.id === current.id)).length} 条。已存在的事项会跳过，即使内容有变化，也保留当前版本。</p><ul>{pendingImport.items.slice(0, 5).map((item) => <li key={item.id}>{item.title} · {item.date || "待安排"}</li>)}</ul>{pendingImport.items.length > 5 ? <p>以及其余 {pendingImport.items.length - 5} 条事项。</p> : null}<button type="button" disabled={locked} className={styles.primary} onClick={() => void act(async () => {
        const result = await repository.current!.merge(pendingImport); setDocument(result.document); setPendingImport(null);
        setNotice(result.result.added ? `已恢复 ${result.result.added} 条，跳过 ${result.result.skipped} 条已有记录。` : "这些日程已经存在，没有添加重复记录。");
      })}>确认恢复</button><button type="button" disabled={busy} onClick={() => setPendingImport(null)}>取消恢复</button></div> : null}
    </details>
    {backupText ? <details className={styles.backup} open><summary>备份文本（备用复制）</summary><p>包含你的日程内容，请自行妥善保存，不要发到公开渠道。未保存输入文件仅供查阅，不作为日程备份恢复。</p><textarea aria-label="备份文本" value={backupText} readOnly rows={5} onFocus={(e) => e.target.select()} /><button type="button" onClick={() => setBackupText("")}>收起备份文本</button></details> : null}
    <dialog ref={dialogRef} className={styles.dialog} onCancel={() => setDeleting(null)} aria-labelledby="delete-title" aria-describedby="delete-description">
      <h2 id="delete-title">删除这一条日程？</h2><p id="delete-description">“{deleting?.title}”将从当前浏览器移除，其他日程不受影响。删除后无法撤销，可先导出备份。</p>{error ? <p role="alert" className={styles.error}>{error}</p> : null}<div><button type="button" ref={keepRef} disabled={busy} onClick={() => setDeleting(null)}>保留</button><button type="button" className={styles.danger} disabled={locked} onClick={() => void act(async () => {
        const result = await repository.current!.remove(deleting!); setDocument(result.document);
        if (editing?.id === deleting?.id) { setEditing(null); setDraft(blank); }
        setDeleting(null); setNotice("这一条日程已删除，其他日程保持原样。"); titleRef.current?.focus();
      })}>删除这条</button></div>
    </dialog>
  </div>;
}
