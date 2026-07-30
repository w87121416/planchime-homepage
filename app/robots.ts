import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      // 审查稿允许抓取，页面自身的 noindex 才能被搜索引擎正确读取。
      allow: "/",
    },
    sitemap: "https://planchime.com/sitemap.xml",
  };
}
