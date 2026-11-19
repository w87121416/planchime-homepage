import type { Metadata } from "next";
import { SiteFrame } from "../../components/SiteFrame";
import { MemberServices } from "../../components/MemberServices";

export const metadata: Metadata = { title: "我的服务", description: "查看本人权益与网页会员服务的开放情况。免费网页日程可继续使用，登录不会自动上传本地日程。", alternates: { canonical: "/services/use/" } };
export default function MemberServicesPage() {
  return <SiteFrame currentPage="我的服务"><MemberServices /><noscript><p>请启用 JavaScript 查看账号与服务状态。你仍可查看<a href="/services/">服务说明</a>。</p></noscript></SiteFrame>;
}
