/* eslint-disable @next/next/no-img-element -- 品牌图标已固定尺寸并本地托管，避免 vinext 边缘图片代理带来运行时依赖。 */
import Link from "next/link";

const navigation = [
  { href: "/", label: "首页" },
  { href: "/#how-it-works", label: "怎么使用" },
  { href: "/#capabilities", label: "主要功能" },
  { href: "/#privacy", label: "隐私与边界" },
  { href: "/support", label: "支持" },
];

const footerNavigation = [
  { href: "/privacy", label: "隐私政策" },
  { href: "/terms", label: "用户协议" },
  { href: "/subscription", label: "订阅规则" },
  { href: "/support", label: "帮助与支持" },
  { href: "/contact", label: "联系我们" },
  { href: "/privacy/data-list", label: "数据清单" },
  { href: "/account-deletion", label: "删除账号" },
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
        <Link className="development-pill" href="/support">iOS 即将上线</Link>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell footer-grid">
        <div>
          <Brand />
          <p className="footer-note">把事情记上日程，让每天都有所成。</p>
        </div>
        <div className="footer-links" aria-label="页脚导航">
          {/* 合规清单与账号删除必须能从公开页面直接到达，不能只依赖 App 内深层入口。 */}
          {footerNavigation.map((item) => (
            <Link href={item.href} key={item.href}>{item.label}</Link>
          ))}
        </div>
        <div className="company-note">
          <p>米堆（南京）网络科技有限公司</p>
          <p>中国 · 南京</p>
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
