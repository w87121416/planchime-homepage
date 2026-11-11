import type { Metadata } from "next";
import { SiteFrame } from "../../components/SiteFrame";
import { PurchasePortal } from "../../components/PurchasePortal";
export const metadata: Metadata = { title: "网页登录开放状态", robots: { index: false, follow: false } };
export default function SignInPage() { return <SiteFrame><PurchasePortal initialView="login" /></SiteFrame>; }
