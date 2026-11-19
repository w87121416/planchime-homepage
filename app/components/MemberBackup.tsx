"use client";
import { useEffect, useRef, useState } from "react";
import { browserRepository, downloadText } from "../lib/planner/browser";
import { PlannerError, type PlannerDocument } from "../lib/planner/model";
import { previewBackupRestore, type BackupList, type DownloadedBackup, type BackupRestorePreview } from "../lib/services/backup";
import { MemberServicesController, serviceFailure } from "../lib/services/controller";
import { servicePlannerRepository } from "../lib/services/planner";
import { PurchaseClientError } from "../lib/purchase/protocol";
import styles from "./memberServices.module.css";

export function MemberBackup({ controller, accountId }: { controller: MemberServicesController; accountId: string }) {
  const [list, setList] = useState<BackupList | null>(null), [upload, setUpload] = useState<PlannerDocument | null>(null);
  const [download, setDownload] = useState<DownloadedBackup | null>(null), [pending, setPending] = useState<string | null>(null);
  const [restorePreview, setRestorePreview] = useState<BackupRestorePreview | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const lifecycle = useRef<{ signal: AbortController; alive: boolean }>({ signal: new AbortController(), alive: true });
  const acting = useRef(false);
  const client = controller.client;
  const current = () => lifecycle.current.alive && controller.getSnapshot().phase === "ready" && controller.getSnapshot().session?.accountId === accountId;
  const load = async (cursor?: string) => {
    const result = await client.backups(accountId, lifecycle.current.signal.signal, cursor);
    if (current()) setList(old => cursor && old ? { ...result, versions: [...old.versions, ...result.versions.filter(v => !old.versions.some(previous => previous.requestId === v.requestId))] } : result);
  };
  useEffect(() => {
    const run = { signal: new AbortController(), alive: true }; lifecycle.current = run;
    void Promise.all([client.backups(accountId, run.signal.signal), client.pending(accountId, "backup")]).then(([result, requestId]) => {
      if (run.alive) { setList(result); setPending(requestId); }
    }).catch(reason => { if (run.alive) {
      setError(serviceFailure(reason));
      if (reason instanceof PurchaseClientError && ["ACCOUNT_CHANGED", "AUTHENTICATION_REQUIRED", "PRO_DRAFT_IDENTITY_UNAVAILABLE"].includes(reason.code)) controller.invalidate();
    } });
    return () => { run.alive = false; run.signal.abort(); };
  }, [client, accountId, controller]);
  const act = async (work: () => Promise<void>) => {
    if (acting.current || !current()) return;
    acting.current = true; setBusy(true); setError(""); setNotice("");
    try { await work(); }
    catch (reason) {
      if (current()) {
        setError(reason instanceof PlannerError ? reason.message : serviceFailure(reason));
        if (reason instanceof PurchaseClientError && ["ACCOUNT_CHANGED", "AUTHENTICATION_REQUIRED", "PRO_DRAFT_IDENTITY_UNAVAILABLE"].includes(reason.code)) controller.invalidate();
      }
    } finally { acting.current = false; if (current()) setBusy(false); }
  };
  const preview = () => { try { setUpload(browserRepository().read()); setError(""); } catch (reason) { setError(serviceFailure(reason)); } };
  const byteLength = upload ? new TextEncoder().encode(JSON.stringify(upload)).byteLength : 0;
  const read = async (requestId: string) => {
    const result = await client.downloadBackup(accountId, requestId, lifecycle.current.signal.signal);
    if (!current()) return;
    setRestorePreview(previewBackupRestore(browserRepository().read(), result.document)); setDownload(result);
    if (requestId === pending) { await client.remember(accountId, null, "backup", requestId); if (current()) { setPending(null); setNotice("已核实本次备份保存成功，请核对下方保留期限。"); } }
  };
  return <div><h2>云备份</h2><p>上传由你确认。所有保留版本共同计入 100MB 容量；登录不会自动上传日程。</p>
    {list ? <div className={styles.disclosure}><p>已用 {list.usedBytes.toLocaleString()} / {list.capacityBytes.toLocaleString()} 字节</p><p>{list.membershipValidUntil ? `会员有效至：${new Date(list.membershipValidUntil).toLocaleString("zh-CN")}` : "当前没有可上传的会员有效期。"}</p>{!list.canUpload ? <p>当前不能上传新备份。已保存版本能否下载，以下方状态为准。</p> : null}<p>版本滚动保留 30 天；到期后 30 天可下载。每个版本以下方实际可下载截止时间为准。</p></div> : <p>{error ? "暂时无法查看备份，当前浏览器中的日程未改变。" : "正在核对备份容量与保留期限…"}</p>}
    {error ? <p role="alert" className={styles.error}>{error}</p> : null}<p role="status">{notice}</p>
    <button type="button" disabled={busy} onClick={() => void act(async () => { const requestId = await client.pending(accountId, "backup"); if (current()) setPending(requestId); await load(); })}>重新查看备份</button>
    {pending ? <div><p>这次备份结果还在核对，请先查询本次结果，不要重复上传。</p><button type="button" disabled={busy} onClick={() => void act(() => read(pending))}>查询本次备份</button></div> : <button type="button" disabled={busy || !list?.canUpload} onClick={preview}>预览当前浏览器日程</button>}
    {upload && !pending ? <section className={styles.disclosure} aria-label="云备份上传预览"><h3>上传预览</h3><p>目标账号：{accountId}</p><p>{upload.items.length} 条事项 · {byteLength.toLocaleString()} 字节。将上传标题、日期、时间、备注和完成状态。</p><p>本机仍保留原日程；不会把备份自动同步到其他设备。</p>
      <div className={styles.actions}><button className={styles.primary} type="button" disabled={busy || !list?.canUpload || byteLength > list.capacityBytes - list.usedBytes} onClick={() => void act(async () => {
        const requestId = client.uuid(); await client.remember(accountId, requestId, "backup"); if (!current()) return;
        setPending(requestId);
        const result = await client.uploadBackup(accountId, requestId, upload, lifecycle.current.signal.signal);
        if (!current()) return;
        await client.remember(accountId, null, "backup", requestId); if (!current()) return;
        setPending(null); setUpload(null); setNotice(`本次备份已保存，可下载至 ${new Date(result.downloadUntil).toLocaleString("zh-CN")}。`); await load();
      })}>确认上传这份日程</button><button type="button" disabled={busy} onClick={() => setUpload(null)}>暂不上传</button></div>
    </section> : null}
    <h3>已保存的版本</h3>{list && !list.versions.length ? <p>这个账号还没有云备份。</p> : null}
    <ul className={styles.versions}>{list?.versions.map(version => <li key={version.requestId}><strong>{new Date(version.createdAt).toLocaleString("zh-CN")}</strong><p>{version.itemCount} 条 · {version.byteLength.toLocaleString()} 字节<br />可下载至 {new Date(version.downloadUntil).toLocaleString("zh-CN")}</p><button type="button" disabled={busy || !version.available} onClick={() => void act(() => read(version.requestId))}>{version.available ? "查看恢复预览" : "已不可下载"}</button></li>)}</ul>
    {list?.nextCursor ? <button type="button" disabled={busy} onClick={() => void act(() => load(list.nextCursor!))}>查看更早版本</button> : null}
    {download && restorePreview ? <section className={styles.disclosure} aria-label="云备份恢复预览"><h3>恢复预览</h3><p>将新增 {restorePreview.added} 条，保留当前浏览器中已有的 {restorePreview.preserved} 条。</p><p>只添加本机尚未保存的事项，不覆盖已有修改。日程保存在当前浏览器，退出账号不会移除；网页不登记提醒。</p>
      <div className={styles.actions}><button className={styles.primary} type="button" disabled={busy} onClick={() => void act(async () => {
        const result = await servicePlannerRepository(current, () => {
          // 在真实本地写锁内重新核对，避免预览后其他标签页改变了用户将确认的数量。
          const latest = previewBackupRestore(browserRepository().read(), download.document);
          if (latest.localRevision !== restorePreview.localRevision) { setRestorePreview(latest); throw new PlannerError("conflict", "本机日程已更新，请重新核对恢复预览后确认。尚未写入备份内容。"); }
        }).merge(download.document); if (!current()) return;
        setNotice(`已合并 ${result.result.added} 条，保留本机已有的 ${result.document.items.length - result.result.added} 条。网页不登记提醒。`); setDownload(null);
      })}>确认合并到当前浏览器</button><button type="button" disabled={busy} onClick={() => downloadText(JSON.stringify(download.document), "记上日成云备份.json")}>下载备份文件</button><button type="button" onClick={() => setDownload(null)}>暂不恢复</button></div>
    </section> : null}
  </div>;
}
