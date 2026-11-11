import type { Metadata } from "next";
import { SiteFrame } from "../../components/SiteFrame";
import { PurchasePortal } from "../../components/PurchasePortal";
export const metadata: Metadata = { title: "主题与服务说明" };
export default function PurchaseInformationPage() { return <SiteFrame><PurchasePortal initialView="policy" /></SiteFrame>; }
