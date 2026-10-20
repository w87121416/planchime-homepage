import type { Metadata } from "next";
import Link from "next/link";
import { SiteFrame } from "../components/SiteFrame";

export const metadata: Metadata = {
  title: "帮助与支持",
  description: "记上日成 1.1 的提醒、登录、同步、数据导出、账号注销与联系说明。",
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
            <p><a className="card-text-link" href="mailto:zhangxiao@planchime.com">zhangxiao@planchime.com</a></p>
            <p className="support-meta">米堆（南京）网络科技有限公司 · 中国南京</p>
          </article>
          <article className="support-card">
            <span>02</span>
            <h2>本地数据</h2>
            <p>
              无需登录即可使用本地日程。登录后仍需再次确认同步方式；也可以导出、撤回同步或申请注销账号。
            </p>
          </article>
          <article className="support-card">
            <span>03</span>
            <h2>当前版本</h2>
            <p>
              1.1 提供本地日程、今日、日历、完成、稍后、改期、移动端本地提醒，以及可选登录和确认后的跨端同步。
            </p>
          </article>
          <article className="support-card">
            <span>04</span>
            <h2>隐私与联系</h2>
            <p>
              查看<Link className="card-text-link" href="/privacy">隐私政策</Link>、<Link className="card-text-link" href="/privacy/data-list">数据与 SDK 清单</Link>和<Link className="card-text-link" href="/account-deletion">账号删除说明</Link>。
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
              <p>iPhone 请在“设置 → 通知 → 记上日成”检查权限；Android 请在“设置 → 应用 → 记上日成 → 通知”检查权限。静音、专注模式、省电和厂商后台策略也可能影响展示。即使通知不可用，日程仍会保存在本机。</p>
            </details>
            <details>
              <summary>为什么需要精确闹钟特殊访问？</summary>
              <p>只有你明确设置按时提醒时才需要。未开启时，App 会说明提醒能力受限，但不会阻止创建、编辑、今日或日历功能。</p>
            </details>
            <details>
              <summary>数据会上传吗？</summary>
              <p>登录不会自动上传日程。只有你另行选择“仅从现在同步”或确认合并预览后，所选日程才会同步到账号。</p>
            </details>
            <details>
              <summary>如何导出数据？</summary>
              <p>在 App 的账号与数据页面选择导出。登录用户可以请求账号数据导出；设备本地数据仍按系统文件能力保存，不需要读取整个存储空间。</p>
            </details>
            <details>
              <summary>如何删除本地数据？</summary>
              <p>在“数据与帮助”中选择完整清理，阅读范围说明并进行第二次确认。App 会先取消本地提醒，再清理用户数据。也可以使用 Android 系统的“清除存储”或卸载 App。</p>
            </details>
            <details>
              <summary>当前有哪些登录方式？</summary>
              <p>iOS 支持手机号验证码、Apple 和微信；Android 支持手机号验证码和微信；微信小程序使用微信登录。1.1 不提供 AI、邮箱读取、天气、支付、订阅或广告。</p>
            </details>
            <details>
              <summary>会员和主题可以购买了吗？</summary>
              <p>尚未开放购买。当前使用免费基础服务，官网没有下单、支付或自动扣费入口。会员和主题的开放状态、运营主体及使用入口见<Link className="inline-link" href="/services/">产品与服务</Link>。</p>
            </details>
          </div>
        </div>
      </section>

      <section className="support-links">
        <div className="shell support-link-row">
          <Link href="/services/">产品与服务 <span aria-hidden="true">→</span></Link>
          <Link href="/contact">联系我们 <span aria-hidden="true">→</span></Link>
          <Link href="/privacy">隐私政策 <span aria-hidden="true">→</span></Link>
          <Link href="/privacy/data-list">数据与 SDK 清单 <span aria-hidden="true">→</span></Link>
          <Link href="/terms">用户协议 <span aria-hidden="true">→</span></Link>
        </div>
      </section>
    </SiteFrame>
  );
}
