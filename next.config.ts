import type { NextConfig } from "next";

const isStaticExport = process.env.PLANCHIME_STATIC_EXPORT === "1";

const nextConfig: NextConfig = {
  // GitHub Pages 只托管静态文件；官网页面不依赖运行时接口，因此同时保留一份可审计的静态产物。
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  typescript: {
    // 静态发布前会先由 typecheck:static 严格检查全部官网源码；这里仅避免 Next 再扫描 Worker/D1 专用代码。
    ignoreBuildErrors: isStaticExport,
  },
};

export default nextConfig;
