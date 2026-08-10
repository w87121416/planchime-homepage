import type { Metadata } from "next";
import Link from "next/link";
import { SiteFrame } from "../components/SiteFrame";

export const metadata: Metadata = {
  title: "帮助与支持",
  description: "联系记上日成，并查看通知、语音、AI、账号、订阅与账号删除的常见问题。",
  alternates: { canonical: "/support" },
};

export default function SupportPage() {
  return (
    <SiteFrame>
      <section className="support-hero">
        <div className="shell support-shell">
          <p className="eyebrow">官方支持</p>
          <h1>需要帮助，直接告诉我们。</h1>
          <p>说明遇到的问题、设备型号和 App 版本即可。请勿在邮件中发送密码或验证码。</p>
        </div>
      </section>

      <section className="section support-section">
        <div className="shell support-grid">
          <article className="support-card featured">
            <span>01</span>
            <h2>邮件支持</h2>
            <p><a className="card-text-link" href="mailto:support@planchime.com">support@planchime.com</a></p>
            <p className="support-meta">米堆（南京）网络科技有限公司 · 中国南京</p>
          </article>
          <article className="support-card">
            <span>02</span>
            <h2>账号与数据</h2>
            <p>
              <Link className="card-text-link" href="/account-deletion">删除账号</Link>、清除本地数据和取消订阅是不同操作，页面会分别说明。
            </p>
          </article>
          <article className="support-card">
            <span>03</span>
            <h2>订阅与购买</h2>
            <p>
              商品、价格和权益以 App 内购买确认页为准。自动续费由实际购买平台管理，删除账号不会自动取消订阅。
            </p>
          </article>
          <article className="support-card">
            <span>04</span>
            <h2>隐私与联系</h2>
            <p>
              查看<Link className="card-text-link" href="/privacy">隐私政策</Link>与<Link className="card-text-link" href="/privacy/data-list">数据清单</Link>，或前往<Link className="card-text-link" href="/contact">联系页面</Link>。
            </p>
          </article>
        </div>
      </section>

      <section className="section faq-section">
        <div className="shell faq-grid">
          <div><p className="eyebrow">常见问题</p><h2>直接解决问题</h2></div>
          <div className="faq-list">
            <details>
              <summary>通知没有出现怎么办？</summary>
              <p>先在 iPhone“设置 → 通知 → 记上日成”中允许通知，再检查静音、专注模式和 App 内提醒设置。系统设置会影响声音与展示方式。</p>
            </details>
            <details>
              <summary>语音会一直监听吗？</summary>
              <p>不会。只有主动按下语音按钮后才用于本次录入，不做常驻或后台监听；识别失败时仍可改用文字。</p>
            </details>
            <details>
              <summary>AI 会直接改变日程吗？</summary>
              <p>不会。AI 只把文字或语音整理成可编辑草稿，时间、提醒、冲突处理和保存都需要你确认。</p>
            </details>
            <details>
              <summary>必须登录才能使用吗？</summary>
              <p>不需要。基础本地日程可以直接使用；登录不会自动上传设备上的本地日程，云端能力以 App 内明确选择为准。</p>
            </details>
            <details>
              <summary>如何管理或恢复订阅？</summary>
              <p>在 App 的“个人 → 会员功能”中查看权益并恢复购买；关闭自动续费或处理退款，请使用实际购买平台的订阅管理入口。</p>
            </details>
            <details>
              <summary>如何删除账号？</summary>
              <p>按<Link className="card-text-link" href="/account-deletion">账号删除说明</Link>操作。删除云账号不会自动清除每台设备的本地数据，也不会自动取消应用商店订阅。</p>
            </details>
          </div>
        </div>
      </section>

      <section className="support-links">
        <div className="shell support-link-row">
          <Link href="/contact">联系我们 <span aria-hidden="true">→</span></Link>
          <Link href="/privacy">隐私政策 <span aria-hidden="true">→</span></Link>
          <Link href="/privacy/data-list">数据与 SDK 清单 <span aria-hidden="true">→</span></Link>
          <Link href="/account-deletion">账号删除说明 <span aria-hidden="true">→</span></Link>
          <Link href="/terms">用户协议 <span aria-hidden="true">→</span></Link>
          <Link href="/subscription">订阅规则 <span aria-hidden="true">→</span></Link>
        </div>
      </section>
    </SiteFrame>
  );
}
