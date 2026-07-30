import type { Metadata } from "next";
import Link from "next/link";
import { SiteFrame } from "../components/SiteFrame";

export const metadata: Metadata = {
  title: "支持与账号删除",
  description: "记上日成支持、数据处理和账号删除说明。",
  alternates: { canonical: "/support" },
};

export default function SupportPage() {
  return (
    <SiteFrame>
      <section className="support-hero">
        <div className="shell support-shell">
          <p className="eyebrow">帮助与支持</p>
          <h1>先把每一条路径说清楚</h1>
          <p>
            记上日成仍在开发，尚未开放下载、账号注册或订阅。以下是上线前已确定的支持与数据处理原则。
          </p>
        </div>
      </section>

      <section className="section support-section">
        <div className="shell support-grid">
          <article className="support-card featured">
            <span>01</span>
            <h2>客服渠道</h2>
            <p>
              正式客服邮箱将使用 <strong>support@planchime.com</strong>。产品公开开放前会先完成独立收件与回复验收；当前无需发送测试请求，也请勿发送密码、验证码、证件或支付信息。
            </p>
            <p className="support-meta">运营主体：米堆（南京）网络科技有限公司</p>
          </article>
          <article className="support-card">
            <span>02</span>
            <h2>删除账号</h2>
            <p>
              云账号尚未开放，因此当前不能在线提交删除。网站已提供免登录的<Link className="card-text-link" href="/account-deletion">账号删除说明</Link>，并明确本地数据、云数据和订阅的区别。
            </p>
          </article>
          <article className="support-card">
            <span>03</span>
            <h2>管理订阅</h2>
            <p>
              自动续费由实际购买平台管理。删除账号不会自动取消应用商店订阅；产品会提供“管理订阅”和“恢复购买”入口。
            </p>
          </article>
          <article className="support-card">
            <span>04</span>
            <h2>数据与第三方清单</h2>
            <p>
              <Link className="card-text-link" href="/privacy/data-list">公开清单</Link>会把当前已启用和计划但未启用的数据、权限、接收方与 SDK 分开。未完成披露的联网能力不会开放生产使用。
            </p>
          </article>
        </div>
      </section>

      <section className="section faq-section">
        <div className="shell faq-grid">
          <div><p className="eyebrow">常见问题</p><h2>产品边界</h2></div>
          <div className="faq-list">
            <details>
              <summary>现在可以下载记上日成吗？</summary>
              <p>暂时不可以。产品仍在开发和合规准备阶段，尚未在任何应用商店或小程序平台发布。</p>
            </details>
            <details>
              <summary>基础功能需要订阅吗？</summary>
              <p>不需要。手动创建与编辑、本地通知、今日与日历、基础重复计划永久免费。</p>
            </details>
            <details>
              <summary>提醒一定会响吗？</summary>
              <p>不会作这种承诺。提醒受系统权限、静音或专注模式、电量和平台规则影响，产品会明确展示当前能力和降级方式。</p>
            </details>
            <details>
              <summary>AI 会直接改我的日程吗？</summary>
              <p>不会。AI 只生成可编辑草稿，时间、重复、提醒和任何冲突处理都需要用户确认。</p>
            </details>
            <details>
              <summary>现在可以删除账号吗？</summary>
              <p>公众云账号还没上线，所以目前没有可在线核验和删除的云账号；内部测试数据可通过账号删除页的邮件入口申请核查。本地数据需在设备内处理。</p>
            </details>
          </div>
        </div>
      </section>

      <section className="support-links">
        <div className="shell support-link-row">
          <Link href="/privacy">隐私政策草案 <span aria-hidden="true">→</span></Link>
          <Link href="/privacy/data-list">数据与 SDK 清单 <span aria-hidden="true">→</span></Link>
          <Link href="/account-deletion">账号删除说明 <span aria-hidden="true">→</span></Link>
          <Link href="/terms">用户协议草案 <span aria-hidden="true">→</span></Link>
          <Link href="/subscription">订阅协议草案 <span aria-hidden="true">→</span></Link>
        </div>
      </section>
    </SiteFrame>
  );
}
