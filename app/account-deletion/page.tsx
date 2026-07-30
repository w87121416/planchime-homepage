import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "../components/LegalPage";

export const metadata: Metadata = {
  title: "账号删除说明",
  description: "记上日成账号、云端数据、本地数据与应用商店订阅的删除说明和申请入口。",
  robots: { index: false, follow: false },
};

export default function AccountDeletionPage() {
  return (
    <LegalPage
      eyebrow="账号与数据"
      title="账号删除说明"
      summary="删除云账号、清除设备本地数据和取消应用商店订阅是三个独立动作。本页先说明当前可做什么、上线后如何申请，以及每一步会产生什么影响。"
      version="0.1"
      status="发布前审查稿 · 云账号未上线"
      publishedAt="2026 年 7 月 22 日"
      effectiveAt="正式云账号服务开放前另行公布"
    >
      <LegalSection title="1. 当前状态">
        <div className="status-panel" role="note">
          <strong>当前无法提交云账号删除</strong>
          <p>记上日成尚未向公众开放账号注册或云服务，因此网站目前没有可登录、核验和自动执行的云账号删除系统，也不会假装已经提交成功。</p>
        </div>
        <p>如果你仅使用本地开发版或测试版，可在 App 内删除事项，或通过设备系统清除该 App 的本地数据。这样不会自动删除系统云备份中的历史副本；是否存在设备备份以及如何清理，由用户的 Apple、Android 或鸿蒙系统设置控制。</p>
        <p>如果你曾参加受邀内部测试并认为已经产生测试账号或服务端数据，请继续使用邀请方提供的原测试渠道核查。公开客服邮箱完成收发验收后，本页会再开放独立备用入口。</p>
      </LegalSection>

      <LegalSection title="2. 公开备用入口状态">
        <div className="status-panel" role="note">
          <strong>公开邮件申请暂未开放</strong>
          <p>正式客服邮箱将使用 support@planchime.com；独立收件与回复验收完成后，本页才会启用可点击的申请入口。</p>
        </div>
        <p>入口开放后，申请只需要以下最少信息：</p>
        <ul>
          <li>你希望处理的范围：测试账号、云端数据或客服邮件记录；</li>
          <li>曾使用的登录方式，以及可用于联系或核验的邮箱；</li>
          <li>如有必要，提供已脱敏的账号标识或测试版本号。</li>
        </ul>
        <p><strong>请不要发送</strong>密码、短信或邮箱验证码、身份证照片、人脸信息、完整银行卡、支付密码、无关日程正文或原始录音。一般请求不需要身份证；只有出现高风险冒用且没有更温和的核验方式时，我们才会说明必要性、范围和替代方案。</p>
      </LegalSection>

      <LegalSection title="3. 正式上线后的 App 内路径">
        <p>云账号正式开放时，App 将提供“设置 → 账号与数据 → 删除账号”。用户登录并完成必要的近期认证后，可以查看删除范围、未导出数据、关联登录方式、当前订阅状态和依法需保留的记录，再作最终确认。</p>
        <p>如果 App 无法打开、账号无法登录或无障碍操作受阻，正式版仍会提供免登录的客服备用入口。我们不会把联系客服设置为唯一正常删除方式，也不会要求购买 Pro。</p>
      </LegalSection>

      <LegalSection title="4. 删除范围与结果">
        <div className="legal-table-wrap">
          <table className="legal-table">
            <thead><tr><th>对象</th><th>删除账号后的处理</th></tr></thead>
            <tbody>
              <tr><td>云账号与登录绑定</td><td>解除可由我们控制的账号身份绑定并停止继续提供云账号服务；外部平台账号本身不由我们删除。</td></tr>
              <tr><td>云端日程、设置与同步数据</td><td>按确认页面所列范围删除或匿名化；删除完成后通常不可恢复。</td></tr>
              <tr><td>设备本地日程</td><td>不会因云端请求自动从所有离线设备消失。用户应在每台设备内删除、清除应用数据或卸载，并在操作前自行导出需要保留的内容。</td></tr>
              <tr><td>应用商店订阅</td><td>不会自动取消。用户须到实际购买平台关闭自动续费；已付权益、退款和扣款以平台状态为准。</td></tr>
              <tr><td>交易、安全与争议记录</td><td>法律、结算、防欺诈或争议处理要求保留的最小记录会隔离保存，到期后删除或匿名化，不再用于日常产品功能。</td></tr>
            </tbody>
          </table>
        </div>
      </LegalSection>

      <LegalSection title="5. 身份核验与处理时限">
        <p>为防止他人恶意删除账号，我们会优先通过已登录会话、原登录方式或发送到已验证邮箱的一次性链接核验。核验信息只用于本次请求，并采取与账号风险相称的最小范围。</p>
        <p>当前账号系统、客服工单、备份清理流程和服务时限尚未冻结，因此本草案不承诺未经验证的 3 日或 15 日时限。收到内部测试请求后，我们会先确认可核验范围，并告知与真实流程相符的预计时间；正式云账号开放前，将公布明确的受理、主库删除和隔离备份清理时限，并依法处理。</p>
        <p>如因无法证明账号归属、请求可能损害他人合法权益或法律要求保留而不能全部删除，我们不会只回复“失败”，而会说明可处理范围和替代方案。</p>
      </LegalSection>

      <LegalSection title="6. 取消订阅、导出与撤回请求">
        <p>建议在删除前先导出需要保留的数据并核对订阅。管理自动续费请在实际购买平台完成，规则见<Link className="inline-link" href="/subscription">《自动续费服务协议》</Link>。</p>
        <p>在删除实际执行前，用户可通过原申请渠道撤回请求；一旦云端数据完成删除或不可逆匿名化，通常无法恢复。</p>
      </LegalSection>

      <LegalSection title="7. 联系与投诉">
        <p>客服邮箱：support@planchime.com。来信时请说明“账号删除”或“个人信息权利请求”。如对处理结果有异议，可回复原邮件要求复核，也可依法向有权监管部门投诉。</p>
        <p>更多个人信息处理规则见<Link className="inline-link" href="/privacy">《记上日成隐私政策》</Link>和<Link className="inline-link" href="/privacy/data-list">个人信息与第三方服务清单</Link>。</p>
      </LegalSection>
    </LegalPage>
  );
}
