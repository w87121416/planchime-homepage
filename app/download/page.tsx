/* eslint-disable @next/next/no-img-element -- 复用本地品牌图标，静态下载页不依赖图片代理。 */
import type { Metadata } from "next";
import Link from "next/link";
import { SiteFrame } from "../components/SiteFrame";
import { androidCandidate, androidDownload } from "./androidRelease";
import "./download.css";

export const metadata: Metadata = {
  title: "Android 下载",
  description: "记上日成 Android 官方下载入口、版本信息、安装指引与数据保护说明。",
  alternates: { canonical: "/download/" },
};

export default function DownloadPage() {
  const available = androidDownload.status === "available";

  return (
    <SiteFrame>
      <div className="download-page shell">
        <section className="download-hero" aria-labelledby="download-title">
          <div className="download-intro">
            <p className="eyebrow">记上日成 · 官方下载</p>
            <h1 id="download-title">把要做的事，<br />安放在手机里。</h1>
            <p className="download-lead">今日看安排，日历看全局。完成、稍后或改期，按自己的节奏来。</p>
            <ul className="download-features">
              <li>无需登录，也能记录本地日程</li>
              <li>支持新建、编辑、完成与重新安排</li>
              <li>本地提醒受系统权限与设备设置影响</li>
            </ul>
            <a className="download-text-link" href="#installation">先看看如何安装 <span aria-hidden="true">↓</span></a>
          </div>

          <section className="download-card" aria-labelledby="android-title">
            <div className="download-app-heading">
              <img src="/images/app-icon.png" alt="" width="80" height="80" />
              <div><p className="download-platform">ANDROID</p><h2 id="android-title">记上日成</h2><p>版本 {androidCandidate.version} · {available ? "正式下载" : "发布准备中"}</p></div>
            </div>
            <dl className="download-specs">
              <div><dt>系统要求</dt><dd>{androidCandidate.minimumSystem} 及以上</dd></div>
              <div><dt>设备架构</dt><dd>{androidCandidate.architecture}（64 位）</dd></div>
              <div><dt>安装包大小</dt><dd>{(androidCandidate.sizeBytes / 1_000_000).toFixed(1)} MB</dd></div>
            </dl>
            {androidDownload.status === "available" ? (
              <>
                <a className="download-button" href={androidDownload.url}>下载 Android 安装包 <span aria-hidden="true">↓</span></a>
                <p className="download-status" id="download-status">官网下载 APK，无需跳转应用商店。安装前请阅读下方说明。</p>
              </>
            ) : (
              <>
                {/* 未通过发布验收时只显示真实禁用按钮，不提供旧包或占位下载地址。 */}
                <button className="download-button" type="button" disabled aria-describedby="download-status">下载暂未开放</button>
                <p className="download-status" id="download-status">正在完成发布前验证。登录与同步服务尚未就绪，安装包暂不开放下载。</p>
              </>
            )}
            <p className="download-privacy">了解我们如何保护数据：<Link href="/privacy">隐私政策</Link> · <Link href="/privacy/data-list">数据与 SDK 清单</Link></p>
          </section>
        </section>

        <section className="download-installation" id="installation" aria-labelledby="installation-title">
          <div className="download-section-heading"><p className="eyebrow">{available ? "安装指引" : "下载开放后"}</p><h2 id="installation-title">三步，开始记录。</h2><p>第一次安装多一步确认，之后就可以轻松使用。</p></div>
          <ol className="download-steps">
            <li><span aria-hidden="true">01</span><h3>在手机浏览器打开</h3><p>使用 Android 手机访问本页。若微信内无法下载，打开右上角菜单，选择在浏览器中打开。</p></li>
            <li><span aria-hidden="true">02</span><h3>下载并确认安装</h3><p>下载 APK 后，按系统提示允许当前浏览器安装此应用。若出现风险提示，先核对来源或联系我们，不要关闭安全防护。</p></li>
            <li><span aria-hidden="true">03</span><h3>先记一件小事</h3><p>打开记上日成，无需登录即可新建日程。需要提醒时再按提示授权；不授权也能继续记录和查看。</p></li>
          </ol>
        </section>

        <section className="download-help" aria-labelledby="download-help-title">
          <div><p className="eyebrow">安心安装</p><h2 id="download-help-title">你可能想知道</h2><p>遇到不确定的提示，先保留数据，再处理问题。</p><Link className="download-text-link" href="/contact">联系我们 <span aria-hidden="true">↗</span></Link></div>
          <div className="download-faq">
            <details><summary>已经装过，更新时要卸载吗？</summary><p>不要先卸载，也不要清除应用数据。本地日程可能随卸载被删除。更新前请先导出备份；若系统提示签名冲突或无法覆盖安装，请停止操作并联系支持。</p></details>
            <details><summary>华为手机可以安装吗？</summary><p>此包是 Android APK，不是原生鸿蒙安装包。仅适用于仍兼容 Android 应用、且满足系统与架构要求的设备；不支持 Android 应用的鸿蒙系统不能使用此包。</p></details>
            <details><summary>账号和日程现在能跨设备同步吗？</summary><p>{available ? "本地记录不要求登录。使用云端能力前，请核对 App 内的服务状态和同步范围；登录本身不代表日程已上传。" : "当前登录与同步服务尚未完成上线验证，本页不把跨设备同步标为可用。下载开放前会一并核验。"}</p></details>
            <details><summary>{available ? "版本与安装包校验信息" : "待发布安装包信息"}</summary><dl className="download-file-facts"><div><dt>包名</dt><dd>{androidCandidate.packageName}</dd></div><div><dt>版本 / 构建号</dt><dd>{androidCandidate.version} / {androidCandidate.versionCode}</dd></div><div><dt>文件大小</dt><dd>{androidCandidate.sizeBytes.toLocaleString("en-US")} 字节</dd></div><div><dt>SHA-256</dt><dd><code>{androidCandidate.sha256}</code></dd></div></dl><p>校验值用于比对安装文件，不代表完成了真机验收。文件或版本变化时，校验值也必须重新核实。</p></details>
          </div>
        </section>
      </div>
    </SiteFrame>
  );
}
