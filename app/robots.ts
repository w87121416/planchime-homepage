import type { MetadataRoute } from "next";

// GitHub Pages 没有运行时服务器；抓取规则固定导出，避免部署后依赖动态路由。
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      // 官网、支持与法律入口均为正式公开页面，不再依赖页面级 noindex 隐藏审核内容。
      allow: "/",
    },
    sitemap: "https://planchime.com/sitemap.xml",
  };
}
