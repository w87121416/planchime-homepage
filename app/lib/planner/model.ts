/** 网页日程与 App 账号隔离：日期/时间保留用户输入的本地意图，不伪装为 UTC 提醒。 */
export type PlannerItem = {
  id: string;
  revision: string;
  title: string;
  date: string;
  time: string;
  notes: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
};
export type PlannerDraft = Pick<PlannerItem, "title" | "date" | "time" | "notes">;
export type PlannerDocument = { format: "planchime-web-planner"; version: 1; items: PlannerItem[] };
export const MAX_ITEMS = 500;
export const MAX_BACKUP_BYTES = 2_000_000;
export const PLANNER_KEY = "planchime.web-planner.v1";

export class PlannerError extends Error {
  code: "invalid" | "capacity" | "conflict" | "storage" | "corrupt" | "unsupported";
  constructor(code: PlannerError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const bounded = (value: unknown, max: number): value is string => typeof value === "string" && value.length <= max;
const identifier = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(value);

export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (year < 1900 || month < 1 || month > 12 || day < 1) return false;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= lastDay;
}

export function validateDraft(input: PlannerDraft): PlannerDraft {
  if (!bounded(input.title, 100) || !input.title.trim()) throw new PlannerError("invalid", "请写下要安排的事情（最多 100 字）。");
  if (!bounded(input.notes, 2000)) throw new PlannerError("invalid", "备注请控制在 2000 字以内，已输入的内容还在。");
  if (!bounded(input.date, 10) || (input.date !== "" && !validDate(input.date))) throw new PlannerError("invalid", "日期无效，请重新选择日期。");
  if (!bounded(input.time, 5) || (input.time !== "" && !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time))) throw new PlannerError("invalid", "时间无效，请重新选择时间。");
  if (input.time && !input.date) throw new PlannerError("invalid", "要设置时间，请先选择日期；也可以清空时间，保留为待安排。");
  return { title: input.title.trim(), date: input.date, time: input.time, notes: input.notes.trim() };
}

const validInstant = (value: unknown): value is string => typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;

export function emptyDocument(): PlannerDocument {
  return { format: "planchime-web-planner", version: 1, items: [] };
}

/** 导入和读取都走同一校验；未知版本或坏记录整份拒绝，避免静默丢失部分日程。 */
export function parseDocument(text: string): PlannerDocument {
  if (new TextEncoder().encode(text).byteLength > MAX_BACKUP_BYTES) throw new PlannerError("invalid", "文件超过 2MB，暂不支持导入。");
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new PlannerError("invalid", "文件不是有效的记上日成网页备份，现有日程未改变。"); }
  if (!record(value) || value.format !== "planchime-web-planner" || value.version !== 1 || !Array.isArray(value.items)) {
    throw new PlannerError("invalid", "暂不支持这个备份格式或版本，请选择本网页导出的 JSON 文件。");
  }
  if (value.items.length > MAX_ITEMS) throw new PlannerError("capacity", "单个日程本最多保存 500 条事项，请先整理备份。");
  const ids = new Set<string>();
  const items = value.items.map((row: unknown): PlannerItem => {
    if (!record(row) || !identifier(row.id) || !identifier(row.revision) || ids.has(row.id) ||
      typeof row.completed !== "boolean" || !validInstant(row.createdAt) || !validInstant(row.updatedAt)) {
      throw new PlannerError("invalid", "备份中有无效或重复的记录，现有日程未改变。");
    }
    const draft = validateDraft(row as PlannerDraft);
    ids.add(row.id);
    // 仅取公开字段，不把导入文件中的额外属性、脚本或账号字段带进本地数据。
    return { ...draft, id: row.id, revision: row.revision, completed: row.completed, createdAt: row.createdAt, updatedAt: row.updatedAt };
  });
  return { format: "planchime-web-planner", version: 1, items };
}

export function localDate(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function sortItems(items: readonly PlannerItem[]): PlannerItem[] {
  return [...items].sort((a, b) => Number(a.completed) - Number(b.completed) ||
    (a.date || "9999-99-99").localeCompare(b.date || "9999-99-99") ||
    (a.time || "99:99").localeCompare(b.time || "99:99") || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

export type PlannerRuntime = {
  storage: Pick<Storage, "getItem" | "setItem">;
  exclusive: <T>(action: () => T) => Promise<T>;
  uuid: () => string;
  now: () => string;
};

/** 所有写入串行读取最新快照；同一事项修订不匹配时保留输入，不能覆盖另一个标签页的修改。 */
export class PlannerRepository {
  private runtime: PlannerRuntime;
  constructor(runtime: PlannerRuntime) { this.runtime = runtime; }
  read(): PlannerDocument {
    let raw: string | null;
    try { raw = this.runtime.storage.getItem(PLANNER_KEY); }
    catch { throw new PlannerError("storage", "浏览器不允许读取本地日程。请允许本站存储后重试；不要清除现有数据。"); }
    if (raw === null) return emptyDocument();
    try { return parseDocument(raw); }
    catch { throw new PlannerError("corrupt", "本地日程暂时无法读取，原始内容未被覆盖。请先下载原始数据，再联系支持。"); }
  }
  private change<T>(action: (doc: PlannerDocument) => T): Promise<{ document: PlannerDocument; result: T }> {
    return this.runtime.exclusive(() => {
      const document = this.read();
      const result = action(document);
      if (document.items.length > MAX_ITEMS) throw new PlannerError("capacity", "本地已有 500 条事项，请先导出并整理后再新增。");
      const serialized = JSON.stringify(document);
      // 保证任何已保存文档仍能由同一读取/导入器打开，中文备注也按 UTF-8 字节计算。
      if (new TextEncoder().encode(serialized).byteLength > MAX_BACKUP_BYTES) throw new PlannerError("capacity", "日程内容已接近 2MB，请先导出并整理部分备注，再保存。输入仍保留着。");
      try { this.runtime.storage.setItem(PLANNER_KEY, serialized); }
      catch { throw new PlannerError("storage", "还没保存成功，输入仍保留着。浏览器存储可能已满或被限制，请允许存储后重试，或下载输入备份。"); }
      return { document, result };
    });
  }
  save(draft: PlannerDraft, expected?: Pick<PlannerItem, "id" | "revision">) {
    const clean = validateDraft(draft);
    return this.change((doc) => {
      const previous = expected ? doc.items.find((item) => item.id === expected.id) : undefined;
      if (expected && (!previous || previous.revision !== expected.revision)) throw new PlannerError("conflict", "这条事项已在另一个页面改变。输入仍保留着，请取消编辑并查看最新记录后再修改。");
      const now = this.runtime.now();
      const item: PlannerItem = { ...clean, id: previous?.id ?? this.runtime.uuid(), revision: this.runtime.uuid(),
        completed: previous?.completed ?? false, createdAt: previous?.createdAt ?? now, updatedAt: now };
      doc.items = previous ? doc.items.map((row) => row.id === item.id ? item : row) : [...doc.items, item];
      return item.id;
    });
  }
  setCompleted(expected: PlannerItem, completed: boolean) {
    return this.change((doc) => {
      const item = doc.items.find((row) => row.id === expected.id);
      if (!item || item.revision !== expected.revision) throw new PlannerError("conflict", "事项已在另一个页面更新。已保留最新记录，请重新查看后操作。");
      item.completed = completed; item.revision = this.runtime.uuid(); item.updatedAt = this.runtime.now();
    });
  }
  remove(expected: PlannerItem) {
    return this.change((doc) => {
      const item = doc.items.find((row) => row.id === expected.id);
      if (!item || item.revision !== expected.revision) throw new PlannerError("conflict", "事项已改变，未执行删除，请先查看最新记录。");
      doc.items = doc.items.filter((row) => row.id !== expected.id);
    });
  }
  merge(backup: PlannerDocument) {
    // 二次校验防止预览后参数变化；恢复只添加缺失 ID，不覆盖用户现有或已修改的事项。
    const incoming = parseDocument(JSON.stringify(backup));
    return this.change((doc) => {
      const ids = new Set(doc.items.map((item) => item.id));
      const additions = incoming.items.filter((item) => !ids.has(item.id));
      doc.items.push(...additions);
      return { added: additions.length, skipped: incoming.items.length - additions.length };
    });
  }
}
