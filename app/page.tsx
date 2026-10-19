/* eslint-disable @next/next/no-img-element -- 官网采用本地压缩素材，静态部署不依赖运行时图片代理。 */
import type { Metadata } from "next";
import Link from "next/link";
import { SiteFrame } from "./components/SiteFrame";
import { SchedulePreview } from "./components/SchedulePreview";
import { publicSiteFacts } from "./publicSiteFacts";
import { androidDownload } from "./download/androidRelease";
import styles from "./home.module.css";

export const metadata: Metadata = {
  title: { absolute: "记上日成 - 把时间留给生活" },
  description: "把事情记下，把时间留给生活。记上日成帮助你安排日程、待办与提醒；无需账号即可开始，本地优先，跨端同步由你确认。",
  alternates: { canonical: "/" },
};

const benefits = [
  ["01", "随手记下", "新建、编辑，思路不中断"],
  ["02", "一眼看清", "今天与日历，各有条理"],
  ["03", "从容处理", "完成、稍后、改期，由你决定"],
];

const faq = [
  ["需要登录才能使用吗？", "不需要。本地日程无需登录；需要跨端使用时，可再选择手机号、Apple 或微信登录。"],
  ["登录后，数据会自动上传吗？", "不会。登录不自动上传日程。只有你另行选择“仅从现在同步”或确认合并预览后，所选日程才会同步。"],
  ["提醒一定会响吗？", "提醒受通知权限、精确闹钟特殊访问、静音和设备省电策略影响，不承诺穿透静音或任何环境下必响。权限不足时，已保存的日程仍可查看和编辑。"],
  ["三个平台的功能完全一样吗？", "不完全一样。iOS、Android 与微信小程序分别发布，登录、同步和提醒能力以你正在使用的版本为准。小程序不能替代手机系统闹钟。"],
  ["当前有 AI、语音、天气或订阅吗？", "没有。1.1 不提供 AI、语音录入、邮箱读取、天气、支付、订阅或广告能力。"],
];

export default function Home() {
  const { appStoreUrl } = publicSiteFacts;
  return (
    <SiteFrame>
      <div className={styles.home}>
        <section className={styles.hero} aria-labelledby="home-title">
          <div className={styles.container + " " + styles.heroGrid}>
            <div className={styles.heroCopy}>
              <p className={styles.eyebrow}>日程有序，生活从容。</p>
              <h1 id="home-title">把事情记下，<br />把时间留给生活。</h1>
              <p className={styles.lead}>用清楚的日程和恰到好处的提醒，<br className={styles.desktopBreak} />安顿工作，也留住自己的节奏。</p>
              <div className={styles.actions}>
                <a className={styles.button} href={appStoreUrl ?? "#platforms"}>
                  {appStoreUrl ? "免费下载 iPhone 版" : "查看使用方式"}
                </a>
                <a className={styles.textLink} href="#platforms">其他使用方式 <span aria-hidden="true">↗</span></a>
              </div>
              <p className={styles.heroMeta}>无需账号即可开始 · 本地优先 · iOS 17+</p>
            </div>
            <figure className={styles.heroFigure}>
              <div className={styles.artStage}>
                <img src="/images/window-light.webp" alt="" width="1300" height="867" fetchPriority="high" className={styles.windowArt} />
                <div className={styles.phonePosition}><SchedulePreview /></div>
              </div>
              <figcaption>界面示意 · 以实际版本为准</figcaption>
            </figure>
          </div>
        </section>

        <section className={styles.container + " " + styles.benefits} aria-label="产品体验">
          {benefits.map(([number, title, description]) => (
            <article key={number}><span>{number}</span><div><h2>{title}</h2><p>{description}</p></div></article>
          ))}
        </section>

        <section className={styles.featureSection} id="features" aria-labelledby="feature-title">
          <div className={styles.container + " " + styles.featureGrid}>
            <div className={styles.featureIntro}>
              <p className={styles.eyebrow}>简单一点，安排好每一天</p>
              <h2 id="feature-title">装下大小事，<br />不把日子排得太满。</h2>
              <p>重要的事记得住，临时的变化接得住。<br />一份清楚的安排，让你更专注于眼前。</p>
              <div className={styles.dayNote} aria-label="产品原则">
                <span className={styles.noteMark} aria-hidden="true">“</span>
                <p>计划可以改变。<br />下一步，始终由你决定。</p>
                <span>记上日成 · 每天从容一点</span>
              </div>
            </div>
            <div className={styles.featureList}>
              <article><span>01 / 记录</span><h3>想到，就先记下来。</h3><p>创建事项，设好日期与时间。没有网络也可以保存，不必为了记一件小事，先完成一串设置。</p></article>
              <article><span>02 / 查看</span><h3>今天做什么，之后怎么安排。</h3><p>今日视图聚焦眼前，日历视图看清之后。工作与生活，都有一个清楚的位置。</p></article>
              <article><span>03 / 调整</span><h3>完成、稍后或改期，都顺手。</h3><p>提醒按需设置，已有日程不会被静默移动。计划有变化时，轻松调整，再往前走一步。</p></article>
            </div>
          </div>
        </section>

        <section className={styles.container + " " + styles.privacySection} aria-labelledby="privacy-title">
          <div><p className={styles.eyebrow}>属于你的安排，也由你掌握</p><h2 id="privacy-title">本地优先，<br />同步不替你做决定。</h2></div>
          <div className={styles.privacyCopy}>
            <p className={styles.largeCopy}>无需账号，先把日程用起来。<br />需要跨端时，再选择登录与同步。</p>
            <p>登录不自动上传。你可以选择仅从现在同步，或先看合并预览，再确认要同步的内容。</p>
            <p>也可以导出数据、清理本机、撤回后续同步，或申请注销账号。每一步，都会先说明影响范围。</p>
            <div className={styles.inlineLinks}><Link href="/privacy">了解隐私保护 <span aria-hidden="true">↗</span></Link><Link href="/privacy/data-list">数据与 SDK 清单 <span aria-hidden="true">↗</span></Link></div>
          </div>
        </section>

        <section className={styles.downloadSection} id="platforms" aria-labelledby="platform-title">
          <div className={styles.container}>
            <div className={styles.sectionHeading}><p className={styles.eyebrow}>下载与使用</p><h2 id="platform-title">从你顺手的地方开始。</h2><p>在手机上安排一天，也能在微信里随手记录。</p></div>
            <div className={styles.platforms}>
              <article className={styles.applePanel}>
                <img src="/images/app-icon.png" alt="" width="72" height="72" loading="lazy" />
                <div><p className={styles.platformStatus}>{appStoreUrl ? "iOS 1.1 已上线" : "商店入口核验中"}</p><h3>iPhone 与 iPad</h3><p>日程、待办与本地提醒。<br />需要跨端同步时，再登录并确认。</p></div>
                <a className={styles.button} href={appStoreUrl ?? "/support"}>{appStoreUrl ? "在 App Store 下载" : "联系支持"}</a>
                <small>iOS 17.0 及以上 · 可用性以所在地区商店为准</small>
              </article>
              <div className={styles.otherPlatforms}>
                <article id="mini-program"><p className={styles.platformStatus}>微信内使用</p><h3>微信小程序</h3><p>搜索“记上日成AI”，核对主体为<br />米堆（南京）网络科技有限公司。</p><details><summary>怎么打开 <span aria-hidden="true">＋</span></summary><ol><li>打开微信，进入“发现 → 小程序”。</li><li>搜索“记上日成AI”，核对名称与主体。</li><li>若暂未搜到，可通过帮助入口联系支持。</li></ol><p>小程序不能替代手机系统闹钟。</p></details></article>
                <article>
                  {/* 视觉更新不改变 Android 发布审批；和下载页共用同一门禁，未批准不展示 APK 或二维码。 */}
                  <p className={styles.platformStatus}>{androidDownload.status === "available" ? "官网安装包" : "下载暂未开放"}</p>
                  <h3>Android</h3><p>安装要求、版本信息与更新说明，<br />请前往官方安卓下载页查看。</p>
                  <Link className={styles.textLink} href="/download/">查看 Android 下载说明 <span aria-hidden="true">↗</span></Link>
                </article>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.container + " " + styles.faqSection} id="faq" aria-labelledby="faq-title">
          <div><p className={styles.eyebrow}>你可能想知道</p><h2 id="faq-title">把疑问，<br />也说清楚。</h2><Link className={styles.textLink} href="/support">更多帮助 <span aria-hidden="true">↗</span></Link></div>
          <div className={styles.faqList}>{faq.map(([question, answer]) => <details key={question}><summary>{question}<span aria-hidden="true">＋</span></summary><p>{answer}</p></details>)}</div>
        </section>

        <section className={styles.finalSection} aria-label="开始使用记上日成">
          <div className={styles.container}><p className={styles.eyebrow}>记上日成 · PlanChime</p><h2>留一点时间，<br className={styles.mobileBreak} />给生活本来的样子。</h2><a className={styles.button} href="#platforms">开始你的第一份安排 <span aria-hidden="true">↗</span></a><p className={styles.finalNote}>无需账号，即可开始。</p></div>
        </section>
      </div>
    </SiteFrame>
  );
}
