import type { MetadataRoute } from "next";

// 审核入口均为稳定公开地址，静态导出可保证 Apple 审核时无需运行时服务。
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date("2026-08-10T00:00:00+08:00");

  // Apple 审核和用户自助入口都必须能被公开发现，因此正式页面统一进入站点地图。
  const routes: Array<{
    path: string;
    changeFrequency: "weekly" | "monthly";
    priority: number;
  }> = [
    { path: "/", changeFrequency: "weekly", priority: 1 },
    { path: "/support", changeFrequency: "monthly", priority: 0.8 },
    { path: "/contact", changeFrequency: "monthly", priority: 0.7 },
    { path: "/privacy", changeFrequency: "monthly", priority: 0.8 },
    { path: "/privacy/data-list", changeFrequency: "monthly", priority: 0.6 },
    { path: "/terms", changeFrequency: "monthly", priority: 0.7 },
    { path: "/subscription", changeFrequency: "monthly", priority: 0.7 },
    { path: "/account-deletion", changeFrequency: "monthly", priority: 0.8 },
  ];

  return routes.map(({ path, changeFrequency, priority }) => ({
    url: new URL(path, "https://planchime.com").toString(),
    lastModified,
    changeFrequency,
    priority,
  }));
}
