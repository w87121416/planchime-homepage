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
  ["03", "从容处理", "完成、稍后或改期，由你决定"],
];

const journeys = [
  {
    number: "01",
    kicker: "记下来",
    title: "想到的事，先有一个清楚的位置。",
    description: "创建事项，设好日期与时间。没有网络也可以保存，不必为了记一件小事，先完成一串设置。",
    image: "/images/ink-reminder-desk.jpg",
    imageAlt: "暖光书桌与城市窗景的水彩插画",
    note: "本地保存 · 随时可改",
  },
  {
    number: "02",
    kicker: "看清楚",
    title: "眼前这一件，与之后的安排，各有条理。",
    description: "今日视图聚焦眼前，日历视图看清之后。工作与生活不必挤在一起，也不会被系统悄悄挪动。",
    image: "/images/ink-home-district.jpg",
    imageAlt: "雨后城市街区与朱砂路径的水彩插画",
    note: "今日 · 日历 · 待办",
  },
  {
    number: "03",
    kicker: "从容调整",
    title: "计划会变，下一步仍然由你决定。",
    description: "完成、稍后或改期，都从当前安排继续。提醒按需设置；平台或权限受限时，日程仍然保留。",
    image: "/images/ink-achievement-evening.jpg",
    imageAlt: "傍晚城市灯光与朱砂路径的水彩插画",
    note: "完成 · 稍后 · 改期",
  },
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
          <img className={styles.heroBackdrop} src="/images/og-ink-city-v1-1200x630.png" alt="" width="1200" height="630" fetchPriority="high" />
          <div className={styles.heroVeil} />
          <div className={styles.container + " " + styles.heroGrid}>
            <div className={styles.heroCopy}>
              <p className={styles.eyebrow}>记上日成 · PlanChime</p>
              <h1 id="home-title">把事情记下。<br /><span>把时间留给<br className={styles.mobileBreak} />生活。</span></h1>
              <p className={styles.lead}>清楚安排日程、待办与提醒。<br className={styles.desktopBreak} />不催促，不替你决定，只把下一步准备好。</p>
              <div className={styles.actions}>
                <a className={styles.button} href={appStoreUrl ?? "#platforms"}>
                  {appStoreUrl ? "免费下载 iPhone 版" : "查看使用方式"}
                </a>
                <a className={styles.textLink} href="#experience">看看怎么用 <span aria-hidden="true">↓</span></a>
              </div>
              <div className={styles.heroFacts} aria-label="产品特点">
                <span>无需账号即可开始</span>
                <span>本地优先</span>
                <span>iOS 17+</span>
              </div>
            </div>
            <figure className={styles.heroFigure}>
              <div className={styles.productStage}>
                <div className={styles.orbitLabel + " " + styles.orbitLabelTop}>
                  <span>今天</span><strong>3 件安排</strong>
                </div>
                <div className={styles.phonePosition}><SchedulePreview /></div>
                <div className={styles.orbitLabel + " " + styles.orbitLabelBottom}>
                  <i aria-hidden="true" />
                  <div><strong>本地已保存</strong><span>同步由你再次确认</span></div>
                </div>
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

        <section className={styles.experienceSection} id="experience" aria-labelledby="feature-title">
          <div className={styles.container}>
            <div className={styles.experienceHeading}>
              <div><p className={styles.eyebrow}>一天的节奏，不必交给复杂设置</p><h2 id="feature-title">从记下，到收好。<br />每一步都很轻。</h2></div>
              <p>重要的事记得住，临时的变化接得住。忙的时候只看下一件；想回顾时，再展开完整安排。</p>
            </div>
            <div className={styles.journeyList}>
              {journeys.map((journey, index) => (
                <article className={styles.journey} key={journey.number}>
                  <figure className={styles.journeyArt}>
                    <img src={journey.image} alt={journey.imageAlt} width="1200" height="900" loading="lazy" />
                    <figcaption>{journey.note}</figcaption>
                  </figure>
                  <div className={styles.journeyCopy}>
                    <span className={styles.journeyNumber}>{journey.number}</span>
                    <p>{journey.kicker}</p>
                    <h3>{journey.title}</h3>
                    <p>{journey.description}</p>
                    {index === 1 ? <div className={styles.timelineSample} aria-label="一天安排示意"><span>09:30</span><i /><strong>确认产品方案</strong><span>14:00</span><i /><strong>项目沟通</strong><span>18:30</span><i /><strong>晚间散步</strong></div> : null}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.privacySection} aria-labelledby="privacy-title">
          <div className={styles.privacyArt} aria-hidden="true"><img src="/images/ink-reminder-desk.jpg" alt="" width="1200" height="900" loading="lazy" /></div>
          <div className={styles.container + " " + styles.privacyGrid}>
            <div><p className={styles.eyebrow}>属于你的安排，也由你掌握</p><h2 id="privacy-title">先在本地安心使用。<br />需要时，再连接更多设备。</h2></div>
            <div className={styles.privacyCopy}>
              <p className={styles.largeCopy}>无需账号，先把日程用起来。<br />登录，也不会自动上传。</p>
              <p>你可以选择仅从现在同步，或先看合并预览，再确认要同步的内容。已有事项不会被系统静默移动。</p>
              <p>导出数据、清理本机、撤回后续同步或申请注销前，都会先说明影响范围。</p>
              <div className={styles.inlineLinks}><Link href="/privacy">了解隐私保护 <span aria-hidden="true">↗</span></Link><Link href="/privacy/data-list">数据与 SDK 清单 <span aria-hidden="true">↗</span></Link></div>
            </div>
          </div>
        </section>

        <section className={styles.downloadSection} id="platforms" aria-labelledby="platform-title">
          <div className={styles.container}>
            <div className={styles.sectionHeading}><p className={styles.eyebrow}>下载与使用</p><h2 id="platform-title">从你顺手的地方开始。</h2><p>在手机上安排一天，也能在微信里随手记录。不同平台的提醒能力会如实说明。</p></div>
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
          <div><p className={styles.eyebrow}>你可能想知道</p><h2 id="faq-title">把疑问，<br />也说清楚。</h2><Link className={styles.textLink} href="/support">更多帮助 <span aria-hidden="true">↗</span></Link><p><Link className={styles.textLink} href="/services/">产品与服务状态 <span aria-hidden="true">↗</span></Link></p></div>
          <div className={styles.faqList}>{faq.map(([question, answer]) => <details key={question}><summary>{question}<span aria-hidden="true">＋</span></summary><p>{answer}</p></details>)}</div>
        </section>

        <section className={styles.finalSection} aria-label="开始使用记上日成">
          <img src="/images/og-ink-city-v1-1200x630.png" alt="" width="1200" height="630" loading="lazy" />
          <div className={styles.container}><p className={styles.eyebrow}>记上日成 · PlanChime</p><h2>把事情收好，<br className={styles.mobileBreak} />然后好好生活。</h2><a className={styles.button} href="#platforms">开始你的第一份安排 <span aria-hidden="true">↗</span></a><p className={styles.finalNote}>无需账号，即可开始。</p></div>
        </section>
      </div>
    </SiteFrame>
  );
}
