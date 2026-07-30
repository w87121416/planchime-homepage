import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date("2026-07-31T00:00:00+08:00");

  // 只收录已经适合作为官网入口的页面；审查稿不进入站点地图。
  return [
    {
      url: "https://planchime.com/",
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: "https://planchime.com/support",
      lastModified,
      changeFrequency: "monthly",
      priority: 0.6,
    },
  ];
}
