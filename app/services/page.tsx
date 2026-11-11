import type { Metadata } from "next";
import Link from "next/link";
import { SiteFrame } from "../components/SiteFrame";
import { publicSiteFacts } from "../publicSiteFacts";
import { PurchasePrelaunchStatus } from "../components/PurchasePrelaunchStatus";

export const metadata: Metadata = {
  title: "产品与服务",
  description: "记上日成当前免费功能、官方使用入口、运营主体、客服，以及会员和主题的开放状态。",
  alternates: { canonical: "/services/" },
};

export default function ServicesPage() {
  const { appStoreUrl, filings } = publicSiteFacts;

  return (
    <SiteFrame>
      {/* 保留已发布说明，只附加无凭据目录状态；不挂载登录或交易界面。 */}
      <div className="legal-hero">
        <div className="shell legal-shell">
          <p className="eyebrow">当前版本 · 免费基础服务</p>
          <h1>产品与服务</h1>
          <p className="legal-summary">现在可以使用什么、从哪里开始，以及尚未开放的服务，都在这里说明。</p>
        </div>
      </div>

      <article className="shell legal-shell legal-content">
        <section className="legal-section" aria-labelledby="available-services">
          <h2 id="available-services">当前可使用的免费服务</h2>
          <p>无需登录即可创建和编辑本地日程，通过今日与日历查看安排，并使用完成、稍后和改期处理变化。</p>
          <p>iOS 可在授权后设置设备本地提醒。需要跨端时，可以选择登录，并再次确认同步方式；登录本身不会上传日程。提醒仍受设备权限和系统设置影响。</p>
          <p>当前 1.1 不提供支付、订阅或付费主题商品，也不包含 AI、语音录入、邮箱读取、天气或广告能力。</p>
        </section>

        <section className="legal-section" aria-labelledby="official-product">
          <h2 id="official-product">官方版本与使用入口</h2>
          <ul>
            <li><strong>iPhone 与 iPad：</strong>Apple 中国区公开产品资料显示版本 1.1，免费下载，支持 iOS 17.0 及以上。不同地区的可用性以所在地区商店为准。</li>
            <li><strong>微信小程序：</strong>在微信搜索“记上日成AI”，核对主体为米堆（南京）网络科技有限公司。小程序不提供原生系统闹钟。</li>
            <li><strong>Android：</strong>安装包下载暂未开放，当前状态见<Link className="inline-link" href="/download/">Android 下载说明</Link>。</li>
          </ul>
          {appStoreUrl ? (
            <p><a className="inline-link" href={appStoreUrl}>打开 App Store 产品页，查看版本与下载入口</a></p>
          ) : <p>当前商店入口核验中，可通过<Link className="inline-link" href="/contact">官方客服</Link>了解使用方式。</p>}
        </section>

        <section className="legal-section" aria-labelledby="product-images">
          <h2 id="product-images">查看产品界面</h2>
          <p>首页的手机画面已标注为界面示意。开发者提供的商店截图可以在 App Store 产品页查看；具体界面与功能以安装的版本为准。</p>
          {appStoreUrl ? <p><a className="inline-link" href={appStoreUrl}>查看官方商店截图</a></p> : null}
          <p>体验基础流程无需账号：打开 App，新建一条日程，在今日和日历中查看，再按需要完成、稍后或改期。</p>
        </section>

        <section className="legal-section" aria-labelledby="planned-services">
          <h2 id="planned-services">会员与主题：尚未开放购买</h2>
          {/* 用户已确认拟售方案；披露计划不代表权益已交付，因此保留未开放状态且不创建购买入口。 */}
          <p>以下为已确定的拟售方案，相关功能仍在准备和验证中，当前版本尚不可购买或使用这些付费权益。</p>
          <ul>
            <li><strong>Pro 会员：</strong>¥12 / 30 天，单次购买，不自动续费。拟包含每 30 天 AI 文字处理 300 次、语音处理 60 分钟，以及 100MB 日程云备份空间；不保存原始录音，保留最近 30 天备份版本。会员到期后，备份继续保留 30 天供下载。</li>
            <li><strong>苔光书庭主题：</strong>¥6，单次购买、无需续费的应用外观主题。主题适用版本、可使用的平台及具体内容将在开放前明确展示。</li>
          </ul>
          <p>本网站目前不提供下单、支付、预付款、免费试用转扣费或自动续费。浏览本页、下载 App 或联系客服不会产生订阅。</p>
          <p>会员与主题将在实际功能、权益交付和支付验证完成后一起开放。届时会在购买页说明适用平台、版本、交付方式、退款路径与客服方式；当前免费基础服务可以继续使用。</p>
        </section>

        <PurchasePrelaunchStatus embedded />

        <section className="legal-section" aria-labelledby="operator">
          <h2 id="operator">运营主体与备案</h2>
          <p>运营主体：米堆（南京）网络科技有限公司。官方网站：planchime.com。</p>
          <p>Apple 产品页的开发者名称为 Midui (Nanjing) Network Technology Co., Ltd.。</p>
          {filings.filter((record) => record.kind === "icp").map((record) => (
            <p key={record.number}>网站备案：{record.href ? <a className="inline-link" href={record.href} target="_blank" rel="noreferrer">{record.number}</a> : record.number}。</p>
          ))}
        </section>

        <section className="legal-section" aria-labelledby="service-support">
          <h2 id="service-support">使用支持与服务反馈</h2>
          <p>使用、账号、数据或服务状态问题，可发邮件至 <a className="inline-link" href="mailto:zhangxiao@planchime.com">zhangxiao@planchime.com</a>。请说明使用平台、版本、问题和希望得到的帮助，必要时附脱敏截图。</p>
          <p>若有付款相关疑问，请提供对应页面链接和问题描述。当前官网未开放收款，请勿通过邮件发送密码、验证码、完整银行卡信息或进行预付款。</p>
          <p><Link className="inline-link" href="/support">帮助与支持</Link> · <Link className="inline-link" href="/contact">联系我们</Link> · <Link className="inline-link" href="/privacy">隐私政策</Link> · <Link className="inline-link" href="/terms">用户协议</Link></p>
        </section>
      </article>
    </SiteFrame>
  );
}
