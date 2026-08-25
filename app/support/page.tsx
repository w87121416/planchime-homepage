import type { Metadata } from "next";
import Link from "next/link";
import { SiteFrame } from "../components/SiteFrame";

export const metadata: Metadata = {
  title: "帮助与支持",
  description: "记上日成 Android 1.0 的通知、精确闹钟、数据导出、完整清理与联系说明。",
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
              Android 1.0 无需账号。你可以在 App 的“数据与帮助”中导出 JSON 副本，或经过两次确认后完整清理本机数据。
            </p>
          </article>
          <article className="support-card">
            <span>03</span>
            <h2>当前版本</h2>
            <p>
              当前版本提供离线日程、今日、日历、完成、稍后、改期和本地提醒；不包含账号、AI、语音、天气、广告、支付或订阅。
            </p>
          </article>
          <article className="support-card">
            <span>04</span>
            <h2>隐私与联系</h2>
            <p>
              查看<Link className="card-text-link" href="/privacy">隐私政策</Link>与<Link className="card-text-link" href="/privacy/data-list">数据与 SDK 清单</Link>，了解当前版本的本地处理与系统权限。
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
              <p>请在 Android“设置 → 应用 → 记上日成 → 通知”中检查通知权限，并确认当前通知类别没有被关闭。部分设备还会受到静音、省电或后台限制影响。即使通知不可用，日程仍会保存在本机。</p>
            </details>
            <details>
              <summary>为什么需要精确闹钟特殊访问？</summary>
              <p>只有你明确设置按时提醒时才需要。未开启时，App 会说明提醒能力受限，但不会阻止创建、编辑、今日或日历功能。</p>
            </details>
            <details>
              <summary>数据会上传吗？</summary>
              <p>不会。Android 1.0 不申请互联网访问权限，日程和设置保存在设备本地，不上传给开发者。</p>
            </details>
            <details>
              <summary>如何导出数据？</summary>
              <p>在 App 的“数据与帮助”中选择导出，Android 系统会让你选择 JSON 文件的保存位置。App 不需要读取整个存储空间。</p>
            </details>
            <details>
              <summary>如何删除本地数据？</summary>
              <p>在“数据与帮助”中选择完整清理，阅读范围说明并进行第二次确认。App 会先取消本地提醒，再清理用户数据。也可以使用 Android 系统的“清除存储”或卸载 App。</p>
            </details>
            <details>
              <summary>当前有账号、AI、语音、天气或订阅吗？</summary>
              <p>没有。Android 1.0 不提供这些能力，也不需要审核账号或购买商品。</p>
            </details>
          </div>
        </div>
      </section>

      <section className="support-links">
        <div className="shell support-link-row">
          <Link href="/privacy">隐私政策 <span aria-hidden="true">→</span></Link>
          <Link href="/privacy/data-list">数据与 SDK 清单 <span aria-hidden="true">→</span></Link>
          <Link href="/terms">用户协议 <span aria-hidden="true">→</span></Link>
        </div>
      </section>
    </SiteFrame>
  );
}
