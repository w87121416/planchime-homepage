import { PlannerError, PlannerRepository, PLANNER_KEY } from "./model";

export function browserRepository() {
  return new PlannerRepository({
    // 延迟访问 localStorage，浏览器禁用存储时由仓库转换为可恢复的错误。
    storage: {
      getItem: (key) => window.localStorage.getItem(key),
      setItem: (key, value) => window.localStorage.setItem(key, value),
    },
    exclusive: async (action) => {
      // Web Locks 跨标签页串行化读改写；不以不可靠的“先读再写”降级覆盖用户数据。
      if (!navigator.locks || !crypto.randomUUID) throw new PlannerError("unsupported", "当前浏览器暂不支持安全保存，请使用最新版 Chrome、Edge 或 Safari。已有日程仍可导出。");
      return navigator.locks.request(PLANNER_KEY, action);
    },
    uuid: () => crypto.randomUUID(),
    now: () => new Date().toISOString(),
  });
}

export function downloadText(text: string, filename: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url; link.download = filename;
  document.body.append(link); link.click(); link.remove();
  // 给浏览器足够时间读取下载对象；不把日程放进网络地址或请求。
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
