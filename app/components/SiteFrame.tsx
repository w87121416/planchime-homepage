/* eslint-disable @next/next/no-img-element -- 品牌图标已固定尺寸并本地托管，避免 vinext 边缘图片代理带来运行时依赖。 */
import Link from "next/link";
import { publicSiteFacts } from "../publicSiteFacts";

const navigation = [
  { href: "/", label: "首页" },
  { href: "/privacy", label: "隐私政策" },
  { href: "/privacy/data-list", label: "数据与 SDK" },
  { href: "/terms", label: "用户协议" },
  { href: "/support", label: "帮助与支持" },
];

const footerNavigation = [
  { href: "/", label: "首页" },
  { href: "/privacy", label: "隐私政策" },
  { href: "/privacy/data-list", label: "数据与 SDK 清单" },
  { href: "/terms", label: "用户协议" },
  { href: "/support", label: "帮助与支持" },
];

export function Brand() {
  return (
    <Link className="brand" href="/" aria-label="记上日成首页">
      <img
        className="brand-mark"
        src="/images/app-icon.png"
        alt=""
        width="42"
        height="42"
      />
      <span className="brand-copy">
        <strong>记上日成</strong>
        <small>PlanChime</small>
      </span>
    </Link>
  );
}

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Brand />
        <nav className="site-nav" aria-label="主导航">
          {navigation.map((item) => (
            <Link href={item.href} key={item.href}>{item.label}</Link>
          ))}
        </nav>
        <Link className="development-pill" href="/support">Android 1.0 发布准备中</Link>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const { filings } = publicSiteFacts;

  return (
    <footer className="site-footer">
      <div className="shell footer-grid">
        <div>
          <Brand />
          <p className="footer-note">无需登录，把日程稳稳记在本机。</p>
        </div>
        <div className="footer-links" aria-label="页脚导航">
          {/* Android 离线首发版只突出当前真实能力，避免把未来账号或订阅误写成已上线。 */}
          {footerNavigation.map((item) => (
            <Link href={item.href} key={item.href}>{item.label}</Link>
          ))}
        </div>
        <div className="company-note">
          <p>米堆（南京）网络科技有限公司</p>
          <p>中国 · 南京</p>
          <p><a href="mailto:zhangxiao@planchime.com">zhangxiao@planchime.com</a></p>
          {filings.map((record) => (
            <p key={`${record.kind}-${record.number}`}>
              {record.href ? (
                <a href={record.href} target="_blank" rel="noreferrer">{record.number}</a>
              ) : record.kind === "app" ? `App 备案：${record.number}` : record.number}
            </p>
          ))}
          <p>© 2026 记上日成 · PlanChime</p>
        </div>
      </div>
    </footer>
  );
}

export function SiteFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="site-frame">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <SiteHeader />
      <main id="main-content">{children}</main>
      <SiteFooter />
    </div>
  );
}
