/* eslint-disable @next/next/no-img-element -- 水墨资源已在构建前压缩；vinext 的 next/image 代理在边缘预览中缺少稳定 ASSETS 绑定。 */
import type { Metadata } from "next";
import Link from "next/link";
import { SiteFrame } from "./components/SiteFrame";

export const metadata: Metadata = {
  title: { absolute: "记上日成 - 日程、待办与提醒" },
  description:
    "说一句，把事情稳稳记上日程。记上日成是一款本地优先、由你确认的日程、待办与提醒工具。",
  alternates: { canonical: "/" },
};

const steps = [
  {
    number: "01",
    title: "说出来",
    text: "语音、文字，或附上文件。先把事情交代清楚，不必先研究表单。",
  },
  {
    number: "02",
    title: "看一眼",
    text: "事项、时间、优先级与提醒被整理成简洁草稿；有歧义时再问一句。",
  },
  {
    number: "03",
    title: "确认后安排",
    text: "你确认后才保存。冲突先展示影响，再由你决定保留、调整或重排。",
  },
];

const capabilityRows = [
  ["一句话录入", "从一句自然表达中提炼事情、时间和优先级。"],
  ["提前与准点", "可选提前 1 天、30 分钟、15 分钟、5 分钟，或仅准点。"],
  ["冲突不覆盖", "已有安排始终被保护，任何改期都要经过确认。"],
  ["回顾有分寸", "基于真实完成记录生成日、周、月回顾，不用焦虑催促。"],
];

const faq = [
  [
    "需要登录才能使用吗？",
    "不需要。基础本地功能无需账号；使用 AI、云端备份和跨端会员时才需要登录。",
  ],
  [
    "AI 会直接修改我的日程吗？",
    "不会。AI 只生成可编辑草稿，日期、时间、重复、提醒与冲突处理都由你确认。",
  ],
  [
    "提醒一定会响吗？",
    "普通通知受权限、静音、专注模式和系统设置影响。产品会如实显示当前能力，不承诺绕过系统限制。",
  ],
  [
    "会一直监听麦克风吗？",
    "不会。只有你主动按下语音按钮后才开始当前录入，不做常驻监听、后台监听或自定义唤醒词。",
  ],
  [
    "支持哪些平台？",
    "iOS 首发；Android 与微信小程序后续接入。微信订阅消息不能替代手机系统提醒。",
  ],
];

export default function Home() {
  return (
    <SiteFrame>
      <section className="home-hero" aria-labelledby="home-title">
        <div className="shell home-hero-grid">
          <div className="home-hero-copy">
            <p className="eyebrow">记上日成 · PlanChime</p>
            <h1 id="home-title">
              说一句，
              <span>接下来的事就有安排。</span>
            </h1>
            <p className="home-hero-lead">
              语音、文字或文件快速记录，系统把事情整理成清楚的草稿。你确认后保存，到点再给你一个简单、温和的下一步。
            </p>
            <div className="home-hero-actions">
              <Link className="primary-button" href="#how-it-works">
                看看怎么使用
              </Link>
              <Link className="quiet-link" href="/#privacy">
                查看真实能力边界 <span aria-hidden="true">→</span>
              </Link>
            </div>
            <p className="release-note">iOS 首发准备中，尚未开放正式下载或收费。</p>
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
                <span aria-hidden="true">● ◔</span>
              </div>
              <div className="phone-heading">
                <div>
                  <small>7 月 31 日 · 周五</small>
                  <strong>日程</strong>
                </div>
                <span className="weather-chip">南京 · 28°</span>
              </div>
              <div className="phone-next">
                <small>下一件</small>
                <strong>确认产品首页</strong>
                <span>10:00 · 提前 15 分钟提醒</span>
              </div>
              <div className="phone-row">
                <time>14:30</time>
                <div>
                  <strong>项目进度沟通</strong>
                  <span>工作 · 普通</span>
                </div>
                <i aria-hidden="true" />
              </div>
              <div className="phone-row">
                <time>18:30</time>
                <div>
                  <strong>晚间散步</strong>
                  <span>生活 · 每周重复</span>
                </div>
                <i aria-hidden="true" />
              </div>
              <div className="voice-dock">
                <span aria-hidden="true">⌁</span>
                <strong>按住说话</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="truth-strip" aria-label="产品基本原则">
        <div className="shell truth-strip-inner">
          <span>本地功能无需登录</span>
          <span>AI 只整理草稿</span>
          <span>确认后才创建</span>
          <span>权限拒绝仍能使用</span>
        </div>
      </section>

      <section className="home-section" id="how-it-works">
        <div className="shell">
          <div className="editorial-heading">
            <p className="eyebrow">三步就够</p>
            <h2>想到、说出、确认。</h2>
            <p>忙的时候，工具应该替你减少步骤，而不是再布置一份填写任务。</p>
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
            <h2>帮你整理，但不替你做主。</h2>
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
            <h2>会帮你，也懂得安静。</h2>
            <p>
              忙的时候，只把下一件重要的事讲清楚；完成以后，用真实进度给你一份有分寸的回应。庆祝、书信与表达温度都可以关闭。
            </p>
            <blockquote>
              <span>今天完成 4 件</span>
              <p>重要的几步已经落稳，剩下的可以从容一点。</p>
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

      <section className="home-section plan-section" id="plans">
        <div className="shell plan-layout">
          <div className="plan-intro">
            <p className="eyebrow">简单、透明</p>
            <h2>基础日程，始终免费。</h2>
            <p>不强制登录，也不会因为会员到期锁住已有日程。</p>
          </div>
          <div className="plan-columns">
            <article>
              <span>免费版</span>
              <h3>日常安排正常使用</h3>
              <ul>
                <li>手动创建与编辑</li>
                <li>本地提醒与日历</li>
                <li>常用重复规则</li>
                <li>本地数据长期可用</li>
              </ul>
            </article>
            <article className="pro-plan">
              <span>记上日成 Pro · 规划中</span>
              <h3>需要云与 AI 时再升级</h3>
              <ul>
                <li>AI 文字与语音整理</li>
                <li>云端备份与跨端同步</li>
                <li>会员专属回顾书信</li>
              </ul>
              <p>正式开放前会清楚展示价格、额度与续费规则。</p>
            </article>
          </div>
        </div>
      </section>

      <section className="home-section trust-section" id="privacy">
        <div className="shell trust-layout">
          <div>
            <p className="eyebrow">可靠与隐私</p>
            <h2>先保护你交代的事。</h2>
          </div>
          <div className="trust-points">
            <article>
              <h3>本地优先</h3>
              <p>没有网络时仍能创建、编辑、查看，并接收已经安排好的本地提醒。</p>
            </article>
            <article>
              <h3>权限按需</h3>
              <p>只有使用对应功能时才请求麦克风、通知、定位或日历权限。</p>
            </article>
            <article>
              <h3>不静默改动</h3>
              <p>AI、语音和冲突建议都先变成可编辑预览，确认后才写入日程。</p>
            </article>
            <article>
              <h3>披露再使用</h3>
              <p>未来启用 AI、云备份或同步时，会先说明服务商、数据范围和处理方式。</p>
            </article>
          </div>
        </div>
      </section>

      <section className="home-section faq-section" id="faq">
        <div className="shell faq-grid">
          <div>
            <p className="eyebrow">常见问题</p>
            <h2>重要边界，提前说清楚。</h2>
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
            <p className="eyebrow">记上日成</p>
            <h2>记下来，今天就从容一点。</h2>
          </div>
          <Link className="light-button" href="/support">
            查看上线进度
          </Link>
        </div>
      </section>
    </SiteFrame>
  );
}
