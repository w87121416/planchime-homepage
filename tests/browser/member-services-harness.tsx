import React from "react";
import { createRoot } from "react-dom/client";
import { MemberServices } from "../../app/components/MemberServices";
import { MemberTheme } from "../../app/components/MemberTheme";
import { SiteFrame } from "../../app/components/SiteFrame";
import { PlannerWorkbench } from "../../app/planner/PlannerWorkbench";
import { MemberServicesController } from "../../app/lib/services/controller";
import { memberFixture } from "../fixtures/member-services";
import { WebMemberServiceClient } from "../../app/lib/services/client";
import "../../app/globals.css";
import plannerStyles from "../../app/planner/planner.module.css";

// 只有未发布的测试入口读取场景参数；fixture拦截全部API，不允许真实账号/模型/订单请求。
const parameters = new URL(location.href).searchParams;
const synthetic = memberFixture({ closed: parameters.has("closed"), anonymous: parameters.has("anonymous"), storage: localStorage });
// 浏览器验证使用真实 Web Locks；仅网络响应由合成内存后端代替。
const fixture = { ...synthetic, client: new WebMemberServiceClient(synthetic.configuration, { ...synthetic.runtime, locks: navigator.locks }) };
const controller = new MemberServicesController(fixture.client);
Object.assign(window, { memberQA: { fixture, controller } });
createRoot(document.getElementById("root")!).render(<SiteFrame currentPage="我的服务">{parameters.get("view") === "planner" ? <MemberTheme client={fixture.client}><div className={plannerStyles.workspace}><header className={plannerStyles.intro}><p>记上日成 · 免费网页服务</p><h1>先记下来，慢慢安排。</h1><p>免费使用，无需登录。网页不发送到点提醒。</p></header><PlannerWorkbench /></div></MemberTheme> : <MemberServices controller={controller} />}</SiteFrame>);
