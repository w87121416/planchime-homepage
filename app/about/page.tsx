import type { Metadata } from "next";
import Link from "next/link";
import { SiteFrame } from "../components/SiteFrame";
import { publicSiteFacts } from "../publicSiteFacts";

export const metadata: Metadata = {
  title: "关于我们",
  description: "了解记上日成的日程管理服务、产品理念，以及运营主体米堆（南京）网络科技有限公司。",
  alternates: { canonical: "/about/" },
};

export default function AboutPage() {
  return (
    <SiteFrame currentPage="关于我们">
      <section className="support-hero">
        <div className="shell support-shell">
          <p className="eyebrow">关于我们 · 记上日成</p>
          <h1>把安排理清，<br />把时间留给生活。</h1>
          <p>记上日成是一款日程、待办与提醒工具。我们希望把记录、查看和调整安排做得简单，让你按自己的节奏处理每天的事。</p>
        </div>
      </section>
      <article className="shell legal-shell legal-content">
        <section className="legal-section">
          <h2>我们提供什么</h2>
          <p>从新建一条日程开始，在今日与日历中查看安排，通过完成、稍后和改期应对变化。基础本地功能无需登录；需要跨端使用时，再由你选择登录并确认同步。</p>
          <p>iOS 在获得通知权限后可提供设备本地提醒。微信小程序提供日程记录与查询入口，不替代手机系统闹钟。实际可用能力以对应版本、设备权限和系统设置为准。</p>
          <p><Link className="inline-link" href="/services/">查看当前产品与服务</Link>，了解官方使用入口与各平台的开放状态。</p>
        </section>
        <section className="legal-section">
          <h2>我们的做事方式</h2>
          <ul>
            <li><strong>先把事情记好：</strong>基础记录尽量保持简单，网络不可用时仍可使用本地功能。</li>
            <li><strong>把决定留给你：</strong>登录不等于自动上传，提醒需要授权，安排的调整由你确认。</li>
            <li><strong>说清楚能力边界：</strong>设备通知受系统设置影响，未开放的服务不会写成已经可用。</li>
            <li><strong>让帮助有分寸：</strong>提供清晰的下一步，也保留稍后、修改或退出的选择。</li>
          </ul>
        </section>
        <section className="legal-section">
          <h2>运营主体与官方网站</h2>
          <p>记上日成由米堆（南京）网络科技有限公司运营，所在地为中国南京。本站为记上日成官方网站，域名为 planchime.com，提供产品介绍、官方使用入口和用户支持。</p>
          {/* 备案号复用已核实的公开配置，避免公司介绍与页脚出现不同编号。 */}
          {publicSiteFacts.filings.filter((record) => record.kind === "icp").map((record) => (
            <p key={record.number}>网站备案：<a className="inline-link" href={record.href} target="_blank" rel="noreferrer">{record.number}</a>。</p>
          ))}
          <p>当前会员及付费主题尚未开放购买，本站不提供下单、支付或自动续费。服务状态见<Link className="inline-link" href="/services/">产品与服务</Link>。</p>
        </section>
        <section className="legal-section">
          <h2>联系与反馈</h2>
          <p>使用问题、功能建议或隐私请求，请发邮件至 <a className="inline-link" href="mailto:zhangxiao@planchime.com">zhangxiao@planchime.com</a>。说明使用平台、版本与遇到的问题即可，请不要发送密码、验证码或银行卡信息。</p>
          <p><Link className="inline-link" href="/contact/">联系我们</Link> · <Link className="inline-link" href="/support/">帮助与支持</Link> · <Link className="inline-link" href="/privacy/">隐私政策</Link></p>
        </section>
      </article>
    </SiteFrame>
  );
}
