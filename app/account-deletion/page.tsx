import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "../components/LegalPage";

export const metadata: Metadata = {
  title: "账号删除说明",
  description: "记上日成账号、已同步云端数据与设备本地数据的删除说明和申请入口。",
};

export default function AccountDeletionPage() {
  return (
    <LegalPage
      eyebrow="账号与数据"
      title="账号删除说明"
      summary="删除云账号与清除设备本地数据是两个独立动作。已登录用户可在 App 内发起账号注销；申请后有 7 天可取消宽限期，本页同时提供无法使用 App 时的备用联系入口。"
      version="1.1"
      status="现行有效"
      publishedAt="2026 年 9 月 8 日"
      effectiveAt="2026 年 9 月 8 日"
    >
      <LegalSection title="1. 当前状态">
        <div className="status-panel" role="note">
          <strong>优先在 App 内发起账号注销</strong>
          <p>进入“我的 → 账号与同步 → 删除账号”，核对影响范围并完成近期身份验证。提交后进入 7 天宽限期，期间可以取消。</p>
        </div>
        <p>如果你仅使用本地模式，可在 App 内删除事项，或通过设备系统清除该 App 的本地数据。这样不会自动删除系统云备份中的历史副本；是否存在设备备份以及如何清理，由用户的设备与系统设置控制。</p>
        <p>删除账号会处理可由我们控制的云账号与已同步数据，但不会自动清除每台离线设备上的本地副本。只想停止后续同步时，也可以撤回同步同意；这不会删除已经同步到云端的数据。</p>
      </LegalSection>

      <LegalSection title="2. 备用联系入口">
        <div className="status-panel" role="note">
          <strong>无法使用 App 时，可发送邮件</strong>
          <p><a className="inline-link" href="mailto:zhangxiao@planchime.com?subject=%E8%AE%B0%E4%B8%8A%E6%97%A5%E6%88%90%E8%B4%A6%E5%8F%B7%E5%88%A0%E9%99%A4">联系 zhangxiao@planchime.com</a>，主题请写“账号删除”。网页入口用于说明和备用联系，不会在未核验身份时直接删除数据。</p>
        </div>
        <p>通过备用入口申请时，只需要以下最少信息：</p>
        <ul>
          <li>你希望处理的范围：账号、已同步云端数据或客服邮件记录；</li>
          <li>曾使用的登录方式，以及可以继续完成原登录方式核验的说明；</li>
          <li>如有必要，提供已脱敏的账号标识或 App 版本号。</li>
        </ul>
        <p><strong>请不要发送</strong>密码、短信或邮箱验证码、身份证照片、人脸信息、完整银行卡、支付密码、无关日程正文或原始录音。一般请求不需要身份证；只有出现高风险冒用且没有更温和的核验方式时，我们才会说明必要性、范围和替代方案。</p>
      </LegalSection>

      <LegalSection title="3. App 内路径">
        <p>当前版本的入口为“我的 → 账号与同步 → 删除账号”。用户登录并完成必要的近期认证后，可以查看删除范围、未导出数据和关联登录方式，再作最终确认。</p>
        <p>如果 App 无法打开、账号无法登录或无障碍操作受阻，可使用本页的邮件备用入口。我们不会把联系客服设置为唯一正常删除方式，也不会要求购买会员。</p>
      </LegalSection>

      <LegalSection title="4. 删除范围与结果">
        <div className="legal-table-wrap">
          <table className="legal-table">
            <thead><tr><th>对象</th><th>删除账号后的处理</th></tr></thead>
            <tbody>
              <tr><td>云账号与登录绑定</td><td>解除可由我们控制的账号身份绑定并停止继续提供云账号服务；外部平台账号本身不由我们删除。</td></tr>
              <tr><td>云端日程、设置与同步数据</td><td>按确认页面所列范围删除或匿名化；删除完成后通常不可恢复。</td></tr>
              <tr><td>设备本地日程</td><td>不会因云端请求自动从所有离线设备消失。用户应在每台设备内删除、清除应用数据或卸载，并在操作前自行导出需要保留的内容。</td></tr>
              <tr><td>注销请求与最小墓碑</td><td>完成或取消的请求及最小不可逆 HMAC 墓碑保留 30 天，不包含账号原文、日程正文、手机号、令牌或验证码。</td></tr>
              <tr><td>安全记录与备份</td><td>网络及账号安全审计、身份防重放事件保留 180 天；加密数据库备份保留 30 天，到期轮转删除。</td></tr>
            </tbody>
          </table>
        </div>
      </LegalSection>

      <LegalSection title="5. 身份核验与处理">
        <p>为防止他人恶意删除账号，我们会优先通过已登录会话、原登录方式或发送到已验证邮箱的一次性链接核验。核验信息只用于本次请求，并采取与账号风险相称的最小范围。</p>
        <p>收到请求后，我们会先确认可核验范围，再按适用法律和实际系统状态说明处理步骤。注销提交后有 7 天可取消宽限期；到期后事务性删除账号、身份、会话、同步事项及相关业务数据。</p>
        <p>如因无法证明账号归属、请求可能损害他人合法权益或法律要求保留而不能全部删除，我们不会只回复“失败”，而会说明可处理范围和替代方案。</p>
      </LegalSection>

      <LegalSection title="6. 导出与撤回请求">
        <p>建议在删除前先导出需要保留的数据。导出正文或文件最多保留 7 天，一次性下载令牌有效 10 分钟且只能使用一次。</p>
        <p>用户可以在 7 天宽限期内通过 App 取消注销；一旦云端数据完成删除或不可逆匿名化，通常无法恢复。当前版本不提供付费或订阅，因此注销不涉及取消自动续费。</p>
      </LegalSection>

      <LegalSection title="7. 联系与投诉">
        <p>客服邮箱：zhangxiao@planchime.com。来信时请说明“账号删除”或“个人信息权利请求”。如对处理结果有异议，可回复原邮件要求复核，也可依法向有权监管部门投诉。</p>
        <p>更多个人信息处理规则见<Link className="inline-link" href="/privacy">《记上日成隐私政策》</Link>和<Link className="inline-link" href="/privacy/data-list">个人信息与第三方服务清单</Link>。</p>
      </LegalSection>
    </LegalPage>
  );
}
