import { createServer } from "vite";
import react from "@vitejs/plugin-react";
// 独立 localhost 浏览器验收，不复用任何账号 profile，也不启用生产后端。
const port = Number(process.env.PLANCHIME_QA_PORT ?? "4192");
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("local QA port required");
const server = await createServer({ configFile: false, plugins: [react()], define: { "process.env": "{}" }, cacheDir: process.env.PLANCHIME_QA_CACHE ?? "/private/tmp/pay-r4-vite-cache",
  server: { host: "127.0.0.1", port, strictPort: true }, optimizeDeps: { include: ["react", "react-dom/client", "next/link"] } });
await server.listen();
console.log(`Purchase component QA: http://127.0.0.1:${port}/tests/browser/purchase-harness.html`);
