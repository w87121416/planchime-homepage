/* eslint-disable @next/next/no-img-element -- 水墨资源已在构建前压缩；vinext 的 next/image 代理在边缘预览中缺少稳定 ASSETS 绑定。 */
import type { Metadata } from "next";
import Link from "next/link";
import { SiteFrame } from "./components/SiteFrame";

export const metadata: Metadata = {
  title: { absolute: "记上日成 - 日程、待办与提醒" },
  description:
    "记上日成 Android 1.0 是一款无需登录的离线日程、待办与本地提醒工具。",
  alternates: { canonical: "/" },
};

const steps = [
  {
    number: "01",
    title: "写下安排",
    text: "填好事情、日期与时间；没有网络也可以保存。",
  },
  {
    number: "02",
    title: "按需设提醒",
    text: "提醒由你主动设置；权限不足时会说明影响，不会丢掉日程。",
  },
  {
    number: "03",
    title: "从容处理变化",
    text: "完成、稍后或改期都由你决定，不会静默移动已有事项。",
  },
];

const capabilityRows = [
  ["无需登录", "打开即可使用，不要求注册账号。"],
  ["本地优先", "日程保存在设备本地，正式版本不申请联网权限。"],
  ["今日与日历", "用两个清楚的视图查看现在与之后的安排。"],
  ["变化好处理", "支持完成、稍后和改期，把决定权留给你。"],
];

const faq = [
  [
    "需要登录才能使用吗？",
    "不需要。Android 1.0 打开即可使用，当前版本不提供账号或云同步。",
  ],
  [
    "数据会上传吗？",
    "不会。Android 1.0 不申请互联网访问权限，日程和设置保存在设备本地。",
  ],
  [
    "提醒一定会响吗？",
    "提醒受通知权限、精确闹钟特殊访问、静音和设备省电策略影响，不承诺穿透静音或任何环境下必响。",
  ],
  [
    "当前有 AI、语音、天气或订阅吗？",
    "没有。Android 1.0 不包含这些能力，也没有广告、支付或远程推送。",
  ],
];

const reviewLinks = [
  { href: "/support", title: "帮助与支持", text: "使用问题与联系入口" },
  { href: "/privacy", title: "隐私政策", text: "本地数据与权限说明" },
  { href: "/terms", title: "用户协议", text: "服务规则与提醒边界" },
  { href: "/privacy/data-list", title: "数据与 SDK 清单", text: "当前版本的透明清单" },
];

export default function Home() {
  return (
    <SiteFrame>
      <section className="home-hero" aria-labelledby="home-title">
        <div className="shell home-hero-grid">
          <div className="home-hero-copy">
            <p className="eyebrow">记上日成 · PlanChime</p>
            <h1 id="home-title">
              把日程稳稳
              <span>记在本机。</span>
            </h1>
            <p className="home-hero-lead">
              记上日成是一款无需登录的本地日程与待办工具。离线也能创建和编辑事项，在今日与日历中查看安排，并用完成、稍后和改期处理变化。
            </p>
            <div className="home-hero-actions">
              <Link className="primary-button" href="#capabilities">
                查看 Android 1.0 能力
              </Link>
              <Link className="quiet-link" href="/support">
                帮助与支持
              </Link>
            </div>
            <p className="release-status">
              <i aria-hidden="true" />
              Android 1.0 发布准备中
            </p>
          </div>

          <div
            className="home-hero-visual"
            role="img"
            aria-label="记上日成水墨城市主题与日程界面概念预览"
          >
            <img
              className="hero-art"
              src="/images/ink-home-district.jpg"
              alt=""
              width="1200"
              height="900"
              fetchPriority="high"
            />
            <div className="phone-preview" aria-hidden="true">
              <div className="phone-status">
                <span>09:41</span>
                <span className="phone-system-status"><i /><i /><i /></span>
              </div>
              <div className="phone-heading">
                <div>
                  <small>今天 · 7 月 31 日</small>
                  <strong>日程</strong>
                </div>
                <span className="weather-chip">离线可用</span>
              </div>
              <div className="phone-next">
                <small>下一件</small>
                <strong>整理发布材料</strong>
                <span>10:00 · 提前 15 分钟</span>
              </div>
              <div className="phone-row">
                <time>14:30</time>
                <div>
                  <strong>查看今日安排</strong>
                  <span className="category-work">工作 · 普通</span>
                </div>
                <i aria-hidden="true" />
              </div>
              <div className="phone-row">
                <time>18:30</time>
                <div>
                  <strong>晚间散步</strong>
                  <span className="category-life">生活 · 本地提醒</span>
                </div>
                <i aria-hidden="true" />
              </div>
              <div className="phone-composer">
                <span className="phone-add-mark" />
                <span className="phone-input-copy">新建日程</span>
                <strong>保存到本机</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="truth-strip" aria-label="产品基本原则">
        <div className="shell truth-strip-inner">
          <span>无需登录</span>
          <span>正式版不申请联网权限</span>
          <span>本地提醒</span>
          <span>完成、稍后与改期</span>
        </div>
      </section>

      <section className="home-section" id="how-it-works">
        <div className="shell">
          <div className="editorial-heading">
            <p className="eyebrow">三步就够</p>
            <h2>写下，设好，需要时再调整。</h2>
            <p>基础功能不依赖网络；权限被拒绝时，日程仍会完整保存在本机。</p>
          </div>
          <div className="flow-list">
            {steps.map((step) => (
              <article key={step.number}>
                <span>{step.number}</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="home-section capability-section" id="capabilities">
        <div className="shell capability-layout">
          <div className="capability-art">
            <img
              src="/images/ink-reminder-desk.jpg"
              alt=""
              width="1200"
              height="900"
              loading="lazy"
            />
            <div className="reminder-note">
              <span>09:45</span>
              <strong>确认产品首页</strong>
              <small>还有 15 分钟</small>
            </div>
          </div>
          <div className="capability-copy">
            <p className="eyebrow">Android 离线首发版</p>
            <h2>需要的能力，先做稳。</h2>
            <div className="capability-rows">
              {capabilityRows.map(([title, text], index) => (
                <article key={title}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <h3>{title}</h3>
                    <p>{text}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="home-section companion-section" id="companion">
        <div className="shell companion-layout">
          <div className="companion-copy">
            <p className="eyebrow">本地数据</p>
            <h2>能导出，也能完整清理。</h2>
            <p>
              你可以在 App 内把数据导出为 JSON 文件，也可以经过两次确认后清理本机数据。导出位置由你通过 Android 系统选择。
            </p>
            <blockquote>
              <span>提醒能力受限时</span>
              <p>日程已经保存；你仍可继续查看和编辑，并按提示调整系统权限。</p>
            </blockquote>
          </div>
          <figure className="evening-figure">
            <img
              src="/images/ink-achievement-evening.jpg"
              alt="雨后办公街区亮起灯光，一条朱砂色路径沿街延伸"
              width="1200"
              height="900"
              loading="lazy"
            />
            <figcaption>本地优先，能力边界说清楚</figcaption>
          </figure>
        </div>
      </section>

      <section className="home-section trust-section" id="privacy">
        <div className="shell trust-layout">
          <div>
            <p className="eyebrow">可靠与隐私</p>
            <h2>把能力边界，说清楚。</h2>
            <p className="trust-intro">当前版本的数据、权限、SDK 和提醒限制都可以免登录查看。</p>
          </div>
          <div className="review-link-grid">
            {reviewLinks.map((item) => (
              <Link href={item.href} key={item.href}>
                <span>{item.title}</span>
                <small>{item.text}</small>
                <b>打开</b>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="home-section faq-section" id="faq">
        <div className="shell faq-grid">
          <div>
            <p className="eyebrow">常见问题</p>
            <h2>常用问题，直接回答。</h2>
          </div>
          <div className="faq-list">
            {faq.map(([question, answer]) => (
              <details key={question}>
                <summary>{question}</summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="home-cta">
        <div className="shell home-cta-inner">
          <img src="/images/app-icon.png" alt="" width="96" height="96" />
          <div>
            <p className="eyebrow">Android 1.0 发布准备中</p>
            <h2>把事情记上，也把时间还给自己。</h2>
          </div>
          <Link className="light-button" href="/support">
            查看帮助与支持
          </Link>
        </div>
      </section>
    </SiteFrame>
  );
}
