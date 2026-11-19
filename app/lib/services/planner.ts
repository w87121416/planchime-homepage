import { PlannerError, PlannerRepository, PLANNER_KEY, validateDraft, type PlannerDocument, type PlannerDraft } from "../planner/model.ts";
export async function confirmedDraftDocument(draft: PlannerDraft, accountId: string, requestId: string): Promise<PlannerDocument> {
  const clean = validateDraft(draft);
  const id = await confirmedDraftId(accountId, requestId), now = new Date().toISOString();
  // 同账号同请求重复确认只添加一次；后续手动编辑仍以本地版本为准，不被旧草稿覆盖。
  return { format: "planchime-web-planner", version: 1, items: [{ ...clean, id, revision: crypto.randomUUID(), completed: false, createdAt: now, updatedAt: now }] };
}
export async function confirmedDraftId(accountId: string, requestId: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify([accountId, requestId])));
  return `pro-${Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("")}`;
}
/** 用户确认保存后若等待本地锁期间退出/切号，拒绝旧草稿写入；已完成的本地保存不撤回。 */
export function servicePlannerRepository(canSave: () => boolean, validateLocked?: () => void): PlannerRepository {
  return new PlannerRepository({
    storage: { getItem: key => localStorage.getItem(key), setItem: (key, value) => {
      if (!canSave()) throw new PlannerError("conflict", "账号状态已变化，这份草稿尚未保存。"); localStorage.setItem(key, value);
    } },
    exclusive: action => {
      if (!navigator.locks) throw new PlannerError("unsupported", "当前浏览器暂不支持安全保存，草稿仍保留着。");
      return navigator.locks.request(PLANNER_KEY, () => { if (!canSave()) throw new PlannerError("conflict", "账号状态已变化，这份草稿尚未保存。"); validateLocked?.(); return action(); });
    }, uuid: () => crypto.randomUUID(), now: () => new Date().toISOString(),
  });
}
