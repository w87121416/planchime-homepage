import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "../../components/LegalPage";

export const metadata: Metadata = {
  title: "个人信息与第三方服务清单",
  description: "记上日成个人信息、设备权限、共享对象与第三方服务发布前清单。",
  // 该清单会随生产 SDK 与托管方案继续校正，当前仅供公开审查。
  robots: { index: false, follow: false },
};

export default function DataListPage() {
  return (
    <LegalPage
      eyebrow="公开透明清单"
      title="个人信息与第三方服务清单"
      summary="本清单把“当前已启用”和“计划但未启用”分开。正式上架前会用发布候选安装包逐项核对权限、网络请求、SDK 版本与接收方，不会把规划项写成已经发生的数据处理。"
      version="0.1"
      status="发布前审查稿"
      publishedAt="2026 年 7 月 22 日"
      effectiveAt="正式服务开放前另行公布"
    >
      <LegalSection title="1. 当前结论">
        <p><strong>当前没有启用的第三方业务 SDK。</strong>公众 App、Android 应用、鸿蒙应用和微信小程序尚未发布，公众账号、云同步、远程 AI/语音、天气、诊断和付费商品均未开放。</p>
        <p>本草案网站不设登录、表单、广告、个性化推荐、Cookie 偏好或行为分析。官网计划通过 Sites 托管平台以 planchime.com 公开交付；正式客服邮箱会在公开服务开放前完成独立收件与回复验收。</p>
      </LegalSection>

      <LegalSection title="2. 个人信息处理清单">
        <div className="legal-table-wrap">
          <table className="legal-table wide-table">
            <thead><tr><th>功能</th><th>信息范围</th><th>处理位置与接收方</th><th>状态</th></tr></thead>
            <tbody>
              <tr><td>本地日程、提醒与统计</td><td>标题、备注、时间、时区、重复、提醒、完成状态</td><td>默认仅在用户设备与操作系统提醒服务中处理，不向我们服务器上传</td><td><strong>本地功能开发中</strong></td></tr>
              <tr><td>附件导入与本机文字提取</td><td>用户主动选择的 PDF、图片或纯文本文件，以及文件名、类型、大小和提取文字</td><td>iOS 沙盒临时副本及 PDFKit、Vision 或本机文本解码；当前 Alpha 不上传云端</td><td>正常完成立即删除副本；异常残留最多约 24 小时后清理；提取文字可进入草稿，直至用户放弃、编辑或保存为日程</td></tr>
              <tr><td>客服邮件</td><td>发件地址、主题、用户主动提供的正文与附件、投递信息</td><td>记上日成客服及阿里云计算有限公司提供的阿里邮箱；用于答复请求和安全排查</td><td><strong>公开服务开放前完成独立收件与回复验收</strong></td></tr>
              <tr><td>网站安全与交付</td><td>IP 地址、访问时间、请求地址、浏览器与错误信息等托管方可能生成的基础访问日志</td><td>Sites 托管平台，用于 planchime.com 的静态页面交付、安全防护和故障排查；网站自身不设置分析脚本或广告追踪</td><td>域名绑定后按实际服务条款复核托管运营主体、基础日志范围和留存期限</td></tr>
              <tr><td>账号登录与找回</td><td>Apple、微信或邮箱登录标识，验证状态、会话与安全记录</td><td>记上日成服务端及用户主动选择的身份提供方</td><td>未启用</td></tr>
              <tr><td>云备份或同步</td><td>账号标识、用户选择上传的日程与设置、修订和同步记录</td><td>记上日成境内服务端及经审查的云基础设施</td><td>未启用，提供商待定</td></tr>
              <tr><td>语音转写</td><td>主动录制的音频、转写文本、语言和必要错误信息</td><td>优先本地或系统能力；如需远程服务会在调用前展示接收方与规则</td><td>生产功能未启用</td></tr>
              <tr><td>AI 日程整理</td><td>用户选择提交的文字或转写、参考时间、时区、歧义项</td><td>记上日成服务端和经审查的 AI 提供商；不得未经确认直接落库</td><td>未启用，提供商待定</td></tr>
              <tr><td>系统日历连接</td><td>用户选择的日历、事件内容和授权状态</td><td>用户设备与系统日历服务；远程连接另行披露</td><td>未启用</td></tr>
              <tr><td>天气辅助</td><td>手动城市，或经同意取得的粗粒度位置、地点时区</td><td>用户设备、记上日成服务端及经审查的天气/地理编码提供商</td><td>未启用，提供商待定</td></tr>
              <tr><td>购买与权益</td><td>平台订单标识、商品、交易状态、权益有效期、退款或撤销状态</td><td>实际收款应用商店和记上日成权益服务；不收集完整银行卡信息</td><td>当前没有可购买商品</td></tr>
              <tr><td>崩溃与性能诊断</td><td>应用版本、设备和系统版本、错误堆栈、匿名结果与耗时区间</td><td>优先最小化自有日志；如使用第三方会先更新本清单</td><td>第三方诊断 SDK 未启用</td></tr>
            </tbody>
          </table>
        </div>
      </LegalSection>

      <LegalSection title="3. 设备权限与特殊访问">
        <div className="legal-table-wrap">
          <table className="legal-table wide-table">
            <thead><tr><th>权限或能力</th><th>使用时机</th><th>拒绝后的影响</th></tr></thead>
            <tbody>
              <tr><td>通知 / 提醒授权</td><td>用户首次设置需要系统展示的提醒时申请</td><td>无法展示依赖通知的提醒；创建、编辑、查看和本地保存仍可用</td></tr>
              <tr><td>麦克风与语音识别</td><td>用户主动点击语音录入时申请，不常驻或后台监听</td><td>不能语音录入，仍可手动或文字输入</td></tr>
              <tr><td>系统日历读取 / 写入</td><td>用户主动连接日历时按所选范围申请，写入前显示影响</td><td>不能连接系统日历，记上日成自己的本地日程仍可用</td></tr>
              <tr><td>使用期间的粗略位置</td><td>用户主动选择“使用当前位置”获取天气时申请</td><td>可改用手动城市；不影响其他日程功能</td></tr>
              <tr><td>精确闹钟等系统特殊访问</td><td>仅在 Android / 鸿蒙平台确需更准确的用户设定提醒时，由系统页面说明并由用户选择</td><td>降级为平台允许的普通提醒，不影响日程数据</td></tr>
            </tbody>
          </table>
        </div>
        <p>正式版的 iOS 隐私用途说明、Android 清单、鸿蒙权限声明和微信小程序接口声明必须与本清单一致。我们不计划为基础功能申请通讯录、短信、通话记录、相机、相册、人脸、持续精确定位或广告标识权限。</p>
      </LegalSection>

      <LegalSection title="4. 第三方服务与 SDK 状态">
        <div className="legal-table-wrap">
          <table className="legal-table wide-table">
            <thead><tr><th>类别</th><th>计划接收方</th><th>可能处理的信息与目的</th><th>当前状态</th></tr></thead>
            <tbody>
              <tr><td>操作系统提醒、语音与支付</td><td>用户设备对应的 Apple、Android 或鸿蒙系统与应用商店</td><td>按用户操作处理授权状态、提醒内容、语音或订单信息；范围以系统提示为准</td><td>仅允许使用经发布包核对的系统原生能力</td></tr>
              <tr><td>Apple 登录</td><td>Apple</td><td>稳定登录标识、用户选择提供的姓名或邮箱，用于账号登录</td><td>计划项，公众账号未启用</td></tr>
              <tr><td>微信登录</td><td>微信开放平台 / 腾讯</td><td>授权码换取的稳定登录标识，用于账号登录；长期密钥仅在服务端</td><td>计划项，尚未接入生产</td></tr>
              <tr><td>Android / 鸿蒙渠道登录与支付</td><td>实际首发应用市场</td><td>渠道账号标识、订单和权益状态</td><td>渠道与 SDK 版本待定，未启用</td></tr>
              <tr><td>企业邮件</td><td>阿里云计算有限公司（阿里邮箱）；<a className="inline-link" href="https://terms.aliyun.com/legal-agreement/terms/suit_bu1_ali_cloud/suit_bu1_ali_cloud201902221539_46514.html">阿里邮箱隐私权政策</a></td><td>用户主动发送的邮箱地址、邮件正文、附件和投递记录，用于客服与安全通知</td><td>公开服务开放前完成收发验收，并依据合同与控制台核验数据地域和客服邮件留存期限</td></tr>
              <tr><td>云、AI / 语音、天气与诊断</td><td>尚未选定</td><td>只有在完成功能必要性、数据区域、保存期限、安全和合同评估后才可能处理相应最小信息</td><td>全部未启用</td></tr>
            </tbody>
          </table>
        </div>
        <p>正式上架前，本表会补齐每个实际 SDK 的完整名称、版本、提供方全称、处理目的、信息类型、调用时机、权限、数据区域和隐私政策链接。未完成一项即不在生产包启用该 SDK。</p>
      </LegalSection>

      <LegalSection title="5. 我们不做什么">
        <ul>
          <li>不出售个人信息，不接入广告联盟，不基于日程正文建立广告画像。</li>
          <li>不因绑定邮箱而读取收件箱，不要求用户提交邮箱密码或验证码给客服。</li>
          <li>不持续定位、不保存位置轨迹，不申请与当前功能无关的设备权限。</li>
          <li>不把完整日程、原始录音、密钥、令牌或验证码写入诊断日志。</li>
          <li>不把规划中的服务商或功能写成已经启用，也不在未告知的情况下远程开启。</li>
        </ul>
      </LegalSection>

      <LegalSection title="6. 更新与核对方式">
        <p>清单会在正式发布、SDK 新增或升级、接收方变化、信息类型变化前更新版本和生效日期。发布候选版还需通过静态依赖、权限清单、冷启动网络、首次使用、拒绝授权和账号注销等场景核对。</p>
        <p>如发现实际处理与本清单不一致，请联系 support@planchime.com。个人信息处理的一般规则见<Link className="inline-link" href="/privacy">《记上日成隐私政策》</Link>。</p>
      </LegalSection>
    </LegalPage>
  );
}
