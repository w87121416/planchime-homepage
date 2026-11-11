import type { Metadata } from "next";
import { SiteFrame } from "../../components/SiteFrame";
import { PurchasePortal } from "../../components/PurchasePortal";
export const metadata: Metadata = { title: "查询原订单", robots: { index: false, follow: false } };
// 返回 URL 的 paid/sign/out_trade_no 都不是可信付款事实，统一通过本人订单查询恢复。
export default function PaymentReturnPage() { return <SiteFrame><PurchasePortal initialView="orders" /></SiteFrame>; }
