import React from "react";
import { createRoot } from "react-dom/client";
import { PurchasePortal } from "../../app/components/PurchasePortal";
import { SiteFrame } from "../../app/components/SiteFrame";
import { WebPurchaseClient } from "../../app/lib/purchase/commerce";
import { browserRuntime } from "../../app/lib/purchase/transport";
import "../../app/globals.css";

// 仅测试目录入口：没有 App Router 路由，不进入静态发布目录；所有 API 都必须由测试拦截器接管。
const runtime = { ...browserRuntime(), origin: "https://planchime.com" };
const parameters = new URL(location.href).searchParams;
// mode 只属于不发布的合成测试入口；正式页面不会读取 URL 来开启交易。
const config = { mode: parameters.get("mode") === "prelaunch" ? "prelaunch" as const : "sandbox" as const, apiOrigin: "https://api.planchime.com", wechatWebConfigured: parameters.get("mode") !== "prelaunch" };
const client = new WebPurchaseClient(config, runtime);
const requested = parameters.get("view");
const initialView = requested === "orders" || requested === "login" || requested === "confirm" || requested === "policy" ? requested : "catalog";
Object.assign(window, { purchaseQA: { client, config, runtime, newClient: () => new WebPurchaseClient(config, runtime) } });
createRoot(document.getElementById("root")!).render(<SiteFrame><PurchasePortal initialView={initialView} client={client} /></SiteFrame>);
