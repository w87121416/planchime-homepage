import type { Metadata } from "next";
import { SiteFrame } from "../../components/SiteFrame";
import { PurchasePortal } from "../../components/PurchasePortal";
export const metadata: Metadata = { title: "购买开放状态", robots: { index: false, follow: false } };
export default function CheckoutPage() { return <SiteFrame><PurchasePortal initialView="confirm" /></SiteFrame>; }
