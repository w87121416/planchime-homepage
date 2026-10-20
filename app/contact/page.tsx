import type { Metadata } from "next";
import Link from "next/link";
import { SiteFrame } from "../components/SiteFrame";

export const metadata: Metadata = {
  title: "联系我们",
  description: "记上日成官方联系信息与个人信息权利请求入口。",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <SiteFrame>
      <section className="support-hero">
        <div className="shell support-shell">
          <p className="eyebrow">无需登录 · 联系我们</p>
          <h1>一封邮件，就能找到我们。</h1>
          <p>产品使用、账号、服务状态或隐私问题，都可以从这里联系。当前会员和主题商品尚未开放购买。</p>
        </div>
      </section>

      <section className="section support-section">
        <div className="shell support-grid">
          <article className="support-card featured">
            <span>01</span>
            <h2>官方邮箱</h2>
            <p><a className="card-text-link" href="mailto:zhangxiao@planchime.com">zhangxiao@planchime.com</a></p>
            <p className="support-meta">请在主题中写明“产品支持”“服务反馈”“账号删除”或“隐私请求”。如有付款疑问，请附对应页面链接和脱敏截图，不要发送支付凭据。</p>
          </article>
          <article className="support-card">
            <span>02</span>
            <h2>运营主体</h2>
            <p>米堆（南京）网络科技有限公司</p>
            <p className="support-meta">中国 · 南京。提供记上日成日程与待办管理服务；当前服务及会员、主题的开放状态见<Link className="card-text-link" href="/services/">产品与服务</Link>。</p>
          </article>
          <article className="support-card">
            <span>03</span>
            <h2>发送前</h2>
            <p>写明设备型号、系统版本、App 版本和遇到的现象即可。</p>
          </article>
          <article className="support-card">
            <span>04</span>
            <h2>请勿发送</h2>
            <p>密码、短信或邮箱验证码、身份证、银行卡、支付密码、无关日程正文或原始录音。</p>
          </article>
        </div>
      </section>

      <section className="support-links">
        <div className="shell support-link-row">
          <Link href="/services/">产品与服务 <span aria-hidden="true">→</span></Link>
          <Link href="/support">帮助与支持 <span aria-hidden="true">→</span></Link>
          <Link href="/privacy">隐私政策 <span aria-hidden="true">→</span></Link>
          <Link href="/account-deletion">账号删除说明 <span aria-hidden="true">→</span></Link>
        </div>
      </section>
    </SiteFrame>
  );
}
