/* eslint-disable @next/next/no-img-element -- 品牌图标已固定尺寸并本地托管，避免 vinext 边缘图片代理带来运行时依赖。 */
import Link from "next/link";
import { publicSiteFacts } from "../publicSiteFacts";
import { MobileMenu } from "./MobileMenu";
import styles from "./siteFrame.module.css";

const navigation = [
  // 独立内容页置于主导航，手机和桌面都能直接了解服务与运营主体。
  { href: "/services/", label: "产品与服务" },
  { href: "/#experience", label: "产品体验" },
  { href: "/about/", label: "关于我们" },
  { href: "/contact/", label: "联系我们" },
  { href: "/support/", label: "帮助" },
];

const footerNavigation = [
  { href: "/", label: "首页" },
  { href: "/#platforms", label: "下载与使用" },
  { href: "/download/", label: "Android 下载" },
  { href: "/services/", label: "产品与服务" },
  { href: "/about/", label: "关于我们" },
  { href: "/privacy", label: "隐私政策" },
  { href: "/privacy/data-list", label: "数据与 SDK 清单" },
  { href: "/terms", label: "用户协议" },
  { href: "/support", label: "帮助与支持" },
  { href: "/contact", label: "联系我们" },
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
            item.href.includes("#") ? <a href={item.href} key={item.href}>{item.label}</a> : <Link href={item.href} key={item.href}>{item.label}</Link>
          ))}
        </nav>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- 静态站页内定位使用原生锚点，避免客户端路由重复拼接 hash。 */}
        <a className="development-pill" href="/#platforms">立即下载</a>
        <MobileMenu />
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
          <p className="footer-note">无需登录即可使用；同步始终由你确认。</p>
        </div>
        <div className="footer-links" aria-label="页脚导航">
          {/* 服务说明明确当前免费范围与未开放商品；入口可见不代表付费能力已上线。 */}
          {footerNavigation.map((item) => (
            item.href.includes("#") ? (
              <a href={item.href} key={item.href}>{item.label}</a>
            ) : (
              <Link href={item.href} key={item.href}>{item.label}</Link>
            )
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

export function SiteFrame({ children, currentPage }: { children: React.ReactNode; currentPage?: string }) {
  return (
    <div className={`site-frame ${styles.frame}`}>
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <SiteHeader />
      <main id="main-content">
        {currentPage ? (
          // 独立页面保留可直接访问的标准链接，低网速或禁用脚本也能返回首页、继续浏览服务和主体信息。
          <nav className={`shell ${styles.pageNavigation}`} aria-label="网站栏目">
            <Link href="/">首页</Link>
            {navigation.filter((item) => !item.href.includes("#")).map((item) => (
              item.label === currentPage ? <span key={item.href} aria-current="page">{item.label}</span> :
                <a key={item.href} href={item.href}>{item.label}</a>
            ))}
          </nav>
        ) : null}
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
