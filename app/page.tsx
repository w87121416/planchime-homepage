/* eslint-disable @next/next/no-img-element -- 水墨资源已在构建前压缩；vinext 的 next/image 代理在边缘预览中缺少稳定 ASSETS 绑定。 */
import type { Metadata } from "next";
import Link from "next/link";
import { SiteFrame } from "./components/SiteFrame";
import { publicSiteFacts } from "./publicSiteFacts";

export const metadata: Metadata = {
  title: { absolute: "记上日成 - 日程、待办与提醒" },
  description:
    "说一句，把事情稳稳记上日程。记上日成是一款本地优先、由你确认的日程、待办与提醒工具。",
  alternates: { canonical: "/" },
};

const steps = [
  {
    number: "01",
    title: "说，或直接写",
    text: "像交代给助理一样，把要做的事和时间告诉它。",
  },
  {
    number: "02",
    title: "看一眼草稿",
    text: "事情、时间、优先级和提醒，被整理在一张清楚的确认卡里。",
  },
  {
    number: "03",
    title: "确认后记上",
    text: "确认才保存；遇到冲突，先说明再由你选择。",
  },
];

const capabilityRows = [
  ["一句话成稿", "从语音或文字中提炼事情、时间和优先级。"],
  ["确认才创建", "所有结果都能直接修改，不替你擅自做主。"],
  ["冲突先说明", "已有安排不会被静默覆盖，调整前先看清影响。"],
  ["本地也可用", "没有网络，仍能查看、编辑和接收已登记的本地提醒。"],
];

const faq = [
  [
    "需要登录才能使用吗？",
    "基础本地功能可以不登录。账号与同步能力以 App 内实际开放状态为准。",
  ],
  [
    "智能整理会直接改日程吗？",
    "不会。它只生成可编辑草稿，日期、时间、提醒与冲突处理都由你确认。",
  ],
  [
    "提醒一定会响吗？",
    "普通通知受权限、静音、专注模式和系统设置影响。产品会如实显示当前能力，不承诺绕过系统限制。",
  ],
  [
    "会一直监听麦克风吗？",
    "不会。只有你主动按下语音按钮后才录入，不做常驻或后台监听。",
  ],
];

const reviewLinks = [
  { href: "/support", title: "帮助与支持", text: "使用问题与联系入口" },
  { href: "/privacy", title: "隐私政策", text: "数据与权限说明" },
  { href: "/terms", title: "用户协议", text: "服务规则与边界" },
  { href: "/account-deletion", title: "删除账号", text: "删除范围与办理方式" },
];

export default function Home() {
  const { appStoreUrl } = publicSiteFacts;

  return (
    <SiteFrame>
      <section className="home-hero" aria-labelledby="home-title">
        <div className="shell home-hero-grid">
          <div className="home-hero-copy">
            <p className="eyebrow">记上日成 · PlanChime</p>
            <h1 id="home-title">
              把事情交代一句，
              <span>接下来就有安排。</span>
            </h1>
            <p className="home-hero-lead">
              语音或文字快速记事，整理成可编辑日程。你确认后才保存，提醒按系统设置执行。
            </p>
            <div className="home-hero-actions">
              <Link className="primary-button" href="#how-it-works">
                看看三步怎么用
              </Link>
              <Link className="quiet-link" href="/support">
                帮助与支持
              </Link>
            </div>
            <p className="release-status">
              <i aria-hidden="true" />
              {appStoreUrl ? (
                <a href={appStoreUrl} target="_blank" rel="noreferrer">已在 App Store 上线</a>
              ) : "iOS 即将上线"}
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
                <span className="weather-chip">南京 28°</span>
              </div>
              <div className="phone-next">
                <small>下一件</small>
                <strong>确认产品首页</strong>
                <span>10:00 · 提前 15 分钟</span>
              </div>
              <div className="phone-row">
                <time>14:30</time>
                <div>
                  <strong>项目进度沟通</strong>
                  <span className="category-work">工作 · 普通</span>
                </div>
                <i aria-hidden="true" />
              </div>
              <div className="phone-row">
                <time>18:30</time>
                <div>
                  <strong>晚间散步</strong>
                  <span className="category-life">生活 · 每周重复</span>
                </div>
                <i aria-hidden="true" />
              </div>
              <div className="phone-composer">
                <span className="phone-add-mark" />
                <span className="phone-input-copy">打字记事</span>
                <strong>按住说话</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="truth-strip" aria-label="产品基本原则">
        <div className="shell truth-strip-inner">
          <span>基础功能本地可用</span>
          <span>智能整理只做草稿</span>
          <span>确认后才创建</span>
          <span>不静默改动日程</span>
        </div>
      </section>

      <section className="home-section" id="how-it-works">
        <div className="shell">
          <div className="editorial-heading">
            <p className="eyebrow">三步就够</p>
            <h2>说完，看一眼，就记好了。</h2>
            <p>常用流程只有一个确认动作，其他细节需要时再改。</p>
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
            <p className="eyebrow">可靠秘书</p>
            <h2>替你整理，决定权留给你。</h2>
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
            <p className="eyebrow">温暖伙伴</p>
            <h2>回顾一天，也照顾节奏。</h2>
            <p>
              日、周、月完成记录会整理成简洁回顾。诗信来自真实事项，表达温度可以调整，也可以关闭。
            </p>
            <blockquote>
              <span>今天完成 4 件</span>
              <p>重要的几步已经落稳，今天可以从容收尾。</p>
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
            <figcaption>默认主题「墨息浮光」</figcaption>
          </figure>
        </div>
      </section>

      <section className="home-section trust-section" id="privacy">
        <div className="shell trust-layout">
          <div>
            <p className="eyebrow">可靠与隐私</p>
            <h2>把能力边界，说清楚。</h2>
            <p className="trust-intro">审核、隐私与账号相关页面，都可以从这里直接找到。</p>
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
            <p className="eyebrow">{appStoreUrl ? "已在 App Store 上线" : "iOS 即将上线"}</p>
            <h2>把事情记上，也把时间还给自己。</h2>
          </div>
          {appStoreUrl ? (
            <a className="light-button" href={appStoreUrl} target="_blank" rel="noreferrer">
              前往 App Store
            </a>
          ) : (
            <Link className="light-button" href="/support">
              查看帮助与支持
            </Link>
          )}
        </div>
      </section>
    </SiteFrame>
  );
}
