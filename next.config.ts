import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 当前官网保持静态资源直出，避免引入运行时图片代理或不必要的动态依赖。
};

export default nextConfig;
