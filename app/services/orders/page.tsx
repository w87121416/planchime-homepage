import type { Metadata } from "next";
import { SiteFrame } from "../../components/SiteFrame";
import { PurchasePortal } from "../../components/PurchasePortal";
export const metadata: Metadata = { title: "订单服务开放状态", robots: { index: false, follow: false } };
export default function OrdersPage() { return <SiteFrame><PurchasePortal initialView="orders" /></SiteFrame>; }
