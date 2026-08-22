import type { Metadata } from "next";
import Link from "next/link";
import { SiteFrame } from "../components/SiteFrame";

export const metadata: Metadata = {
  title: "正在打开记上日成",
  description: "记上日成微信开放能力的安全跳转页。",
  alternates: { canonical: "/wechat" },
};

export default function WeChatUniversalLinkPage() {
  return (
    <SiteFrame>
      <section className="support-hero">
        <div className="shell support-shell">
          <p className="eyebrow">安全跳转</p>
          <h1>正在打开记上日成。</h1>
          <p>
            如果 App 没有自动打开，你仍然可以返回官网查看产品信息或联系支持。
          </p>
          <div className="hero-actions">
            {/* Universal Link 未唤起 App 时保留明确退路，避免用户停留在空白页面。 */}
            <Link className="primary-button" href="/">返回官网</Link>
            <Link className="text-link" href="/support">联系支持</Link>
          </div>
        </div>
      </section>
    </SiteFrame>
  );
}
