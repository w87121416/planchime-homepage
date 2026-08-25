import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "../../components/LegalPage";

export const metadata: Metadata = {
  title: "个人信息与第三方服务清单",
  description: "记上日成 Android 1.0 当前实际处理的数据、权限、系统能力和第三方组件清单。",
};

export default function DataListPage() {
  return (
    <LegalPage
      eyebrow="公开透明清单"
      title="Android 1.0 数据与 SDK 清单"
      summary="本清单只列出记上日成 Android 1.0 正式安装包当前实际处理的数据、系统权限和组件，不把账号、AI、语音、天气、支付或其他未来能力写成已经启用。"
      version="1.1"
      status="现行有效"
      publishedAt="2026 年 8 月 18 日"
      effectiveAt="2026 年 8 月 18 日"
    >
      <LegalSection title="1. 当前结论">
        <p><strong>无需登录、仅本地处理、正式包不申请联网权限。</strong>本清单对应包名 <code>com.planchime.app</code>；日程、待办、提醒和应用偏好保存在用户设备。Android 1.0 没有广告、统计、崩溃上报、远程推送、支付、AI、语音、地图、社交登录、云存储或热更新 SDK。</p>
        <p>planchime.com 的基础访问日志由网站托管服务产生，与 Android App 数据分开。官网不会读取 App 内日程，也不接入广告或行为分析脚本。</p>
      </LegalSection>

      <LegalSection title="2. App 内本地处理清单">
        <div className="legal-table-wrap">
          <table className="legal-table wide-table">
            <thead><tr><th>数据或能力</th><th>用途与处理位置</th><th>是否离开设备</th></tr></thead>
            <tbody>
              <tr><td>日程与待办正文、日期、时间、重复和状态</td><td>SQLite 本地保存，用于创建、编辑、今日、日历、完成、稍后和改期</td><td><strong>否</strong></td></tr>
              <tr><td>提醒设置与登记状态</td><td>App 本地数据库与 Android 系统提醒服务，用于登记、取消和重启后恢复用户设置的提醒</td><td><strong>否</strong></td></tr>
              <tr><td>应用偏好</td><td>App 沙盒本地保存，用于保持用户明确选择的设置</td><td><strong>否</strong></td></tr>
              <tr><td>JSON 导出</td><td>由用户通过 Android 系统文件创建器选择保存位置</td><td>只写入用户选择的位置，不上传给开发者</td></tr>
              <tr><td>完整清理</td><td>两次确认后取消本地提醒并原子清空用户数据表</td><td><strong>否</strong></td></tr>
              <tr><td>软件许可证清单</td><td>随安装包内置，用于展示框架和开源组件的许可证信息</td><td><strong>否</strong></td></tr>
            </tbody>
          </table>
        </div>
      </LegalSection>

      <LegalSection title="3. 权限与特殊访问">
        <div className="legal-table-wrap">
          <table className="legal-table wide-table">
            <thead><tr><th>Android 声明</th><th>用途</th><th>拒绝或撤回后的影响</th></tr></thead>
            <tbody>
              <tr><td><code>POST_NOTIFICATIONS</code></td><td>展示用户主动设置的本地提醒</td><td>通知提醒不可用；创建、编辑、今日、日历和本地保存仍可用</td></tr>
              <tr><td><code>SCHEDULE_EXACT_ALARM</code></td><td>在系统允许时尽可能按用户设定时刻登记本地提醒</td><td>提醒准确性可能受限；App 会说明影响，不阻止保存事项</td></tr>
              <tr><td><code>RECEIVE_BOOT_COMPLETED</code></td><td>设备重启后恢复之前已登记的本地提醒</td><td>这是普通声明权限，无需用户单独授权；不用于联网或收集设备行为</td></tr>
            </tbody>
          </table>
        </div>
        <p>正式 APK 与 AAB 的权限清单一致，不包含 <code>INTERNET</code>。当前版本也不申请麦克风、相机、位置、通讯录、短信、通话记录或广泛存储读取权限。</p>
      </LegalSection>

      <LegalSection title="4. 第三方组件与服务状态">
        <div className="legal-table-wrap">
          <table className="legal-table wide-table">
            <thead><tr><th>类别</th><th>组件或提供方</th><th>当前用途与数据边界</th></tr></thead>
            <tbody>
              <tr><td>应用框架</td><td>React Native、Hermes、AndroidX</td><td>用于界面、JavaScript 执行环境和 Android 平台兼容；在设备本地运行</td></tr>
              <tr><td>本地数据</td><td>SQLite</td><td>保存日程、提醒状态和偏好；数据库位于 App 沙盒</td></tr>
              <tr><td>图片与原生加载</td><td>Fresco、SoLoader</td><td>框架传递组件，用于本地图片和原生库加载</td></tr>
              <tr><td>网络库传递依赖</td><td>OkHttp</td><td>由框架依赖带入；Android 1.0 正式包不声明互联网权限，不用于上传用户日程</td></tr>
              <tr><td>Android 系统能力</td><td>通知、AlarmManager、系统文件创建器</td><td>用于本地提醒和用户主动导出；由 Android 系统在设备上提供</td></tr>
              <tr><td>官网托管</td><td>当前 planchime.com 托管服务</td><td>可能处理 IP、请求时间、页面地址、浏览器和错误信息，用于页面交付与安全；与 App 本地数据分开</td></tr>
            </tbody>
          </table>
        </div>
        <p>完整组件名称、版本与许可证以 App 内“数据与帮助”展示和当前正式安装包所附许可证为准。</p>
      </LegalSection>

      <LegalSection title="5. 当前明确不提供">
        <ul>
          <li>不提供账号、登录、云同步或跨设备数据处理。</li>
          <li>不提供 AI、语音、天气、地图、远程推送或第三方诊断。</li>
          <li>不接入广告、统计、支付、订阅、社交登录或热更新 SDK。</li>
          <li>不读取邮箱、通讯录、短信、通话记录、位置、麦克风或相机。</li>
          <li>不出售个人信息，不基于日程正文建立广告画像。</li>
        </ul>
      </LegalSection>

      <LegalSection title="6. 更新与联系">
        <p>新增或更换 SDK、权限、接收方或信息类型前，我们会更新本清单并完成版本核对；不会仅因规划或代码预留就把未来服务写成已经启用。</p>
        <p>如发现实际处理与本清单不一致，请联系 <a className="inline-link" href="mailto:zhangxiao@planchime.com">zhangxiao@planchime.com</a>。一般处理规则见<Link className="inline-link" href="/privacy">《记上日成隐私政策》</Link>。</p>
      </LegalSection>
    </LegalPage>
  );
}

// 以下旧版跨平台清单仅作为后续能力设计参考，不会由当前公开页面渲染。
function FutureDataListReferencePage() {
  return (
    <LegalPage
      eyebrow="公开透明清单"
      title="个人信息与第三方服务清单"
      summary="本清单区分本地处理、用户主动使用的可选服务和尚未开放的能力。某项服务只有在当前版本提供、用户主动选择且必要授权成立时才会处理相应信息。"
      version="1.0"
      status="现行有效"
      publishedAt="2026 年 8 月 10 日"
      effectiveAt="2026 年 8 月 10 日"
    >
      <LegalSection title="1. 当前结论">
        <p><strong>基础日程以本地处理为主。</strong>手动创建、编辑、查看、统计和本地提醒无需云账号。语音、AI、系统日历、天气和购买等能力只在用户主动使用且当前版本支持时处理必要信息。</p>
        <p>planchime.com 不提供账号登录或在线日程处理，不接入广告或个性化推荐。GitHub Pages 可能为网页交付、安全防护和故障排查生成基础访问日志。</p>
      </LegalSection>

      <LegalSection title="2. 个人信息处理清单">
        <div className="legal-table-wrap">
          <table className="legal-table wide-table">
            <thead><tr><th>功能</th><th>信息范围</th><th>处理位置与接收方</th><th>状态</th></tr></thead>
            <tbody>
              <tr><td>本地日程、提醒与统计</td><td>标题、备注、时间、时区、重复、提醒、完成状态</td><td>默认仅在用户设备与操作系统提醒服务中处理，不因基础本地使用向记上日成服务器上传</td><td><strong>本地能力</strong></td></tr>
              <tr><td>附件导入与本机文字提取</td><td>用户主动选择的 PDF、图片或文本文件，以及文件名、类型、大小和提取文字</td><td>iOS 沙盒、系统文件/照片选择器及 PDFKit、Vision 等本机能力；若某版本提供联网识别，会在发送前另行说明</td><td>仅处理用户选择的文件；提取结果进入可编辑草稿或与指定事项关联</td></tr>
              <tr><td>客服邮件</td><td>发件地址、主题、用户主动提供的正文、附件和投递信息</td><td>记上日成客服及邮件服务提供方，用于答复请求和安全排查</td><td>仅在用户主动发送邮件时处理</td></tr>
              <tr><td>网站安全与交付</td><td>IP 地址、访问时间、请求地址、浏览器与错误信息等托管方可能生成的基础访问日志</td><td>GitHub Pages（GitHub, Inc.），用于 planchime.com 的页面交付、安全防护和故障排查；网站自身不设置广告追踪</td><td>访问网站时可能处理</td></tr>
              <tr><td>账号登录与找回</td><td>手机号、邮箱、Apple 或微信登录标识，验证状态、会话与安全记录</td><td>记上日成服务端及用户主动选择的身份提供方</td><td>仅在当前版本开放对应方式且用户主动登录时处理；在线云账号服务尚未公开开放</td></tr>
              <tr><td>本机生物识别保护</td><td>Face ID、Touch ID 或设备密码验证成功/失败结果</td><td>Apple LocalAuthentication 在用户设备内处理；生物特征模板由系统管理</td><td>用户主动开启本机保护时使用；记上日成不读取或上传生物特征模板</td></tr>
              <tr><td>云备份或同步</td><td>账号标识、用户选择上传的日程与设置、修订和同步记录</td><td>仅在云服务开放后由记上日成服务端和经披露的云基础设施处理</td><td>当前在线云同步尚未公开开放</td></tr>
              <tr><td>语音转写</td><td>用户主动录制的音频、转写文本、语言和必要错误信息</td><td>Apple Speech；音频或转写是否由 Apple 服务器处理取决于系统能力与设置</td><td>仅在用户按下语音按钮并授权后使用；不常驻或后台监听，原始录音在完成、失败或取消后清理，异常遗留不超过 24 小时</td></tr>
              <tr><td>AI 日程整理</td><td>用户选择提交的必要文字或转写、参考时间、时区、歧义项</td><td>记上日成服务端与阿里云百炼/千问，用于生成可编辑的结构化草稿</td><td>仅在当前版本提供、用户同意并主动提交时使用；不向千问发送原始录音，确认前不创建或修改日程</td></tr>
              <tr><td>系统日历连接</td><td>用户选择的日历、事件内容和授权状态</td><td>用户设备与 Apple EventKit；远程日历连接如有开放将另行披露</td><td>仅在当前版本提供且用户授权后处理</td></tr>
              <tr><td>天气辅助</td><td>手动城市，或经同意取得的使用期间粗略位置、地点时区</td><td>用户设备和当前版本明确展示的天气/地点服务</td><td>仅在用户主动同步天气时使用；不持续定位、不建立轨迹，可改用手动城市</td></tr>
              <tr><td>购买与权益</td><td>StoreKit 平台订单标识、商品、交易状态、权益有效期、退款或撤销状态</td><td>Apple 与记上日成权益服务；Apple 负责收款，记上日成不收集完整银行卡信息</td><td>当前没有可购买商品；仅在以后实际提供商品并由用户主动购买或恢复时处理</td></tr>
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
              <tr><td>Face ID / Touch ID</td><td>用户主动开启本机保护或确认敏感操作时，由系统完成验证</td><td>可继续使用未启用本机保护的基础功能；生物特征模板不会交给记上日成</td></tr>
              <tr><td>系统日历读取 / 写入</td><td>用户主动连接日历时按所选范围申请，写入前显示影响</td><td>不能连接系统日历，记上日成自己的本地日程仍可用</td></tr>
              <tr><td>使用期间的粗略位置</td><td>用户主动选择“使用当前位置”获取天气时申请</td><td>可改用手动城市；不影响其他日程功能</td></tr>
              <tr><td>照片、相机或文件选择</td><td>用户主动拍照或选择附件时，通过系统选择器或相机申请</td><td>不能从对应来源添加附件，已有日程与其他录入方式仍可用</td></tr>
              <tr><td>精确闹钟等系统特殊访问</td><td>仅在 Android / 鸿蒙平台确需更准确的用户设定提醒时，由系统页面说明并由用户选择</td><td>降级为平台允许的普通提醒，不影响日程数据</td></tr>
            </tbody>
          </table>
        </div>
        <p>各平台的隐私用途说明和权限清单应与本清单一致。我们不为基础日程功能申请通讯录、短信、通话记录、持续精确定位或广告标识权限；拍照、选图和文件导入只在用户主动添加附件时使用。</p>
      </LegalSection>

      <LegalSection title="4. 第三方服务与 SDK 状态">
        <div className="legal-table-wrap">
          <table className="legal-table wide-table">
            <thead><tr><th>类别</th><th>计划接收方</th><th>可能处理的信息与目的</th><th>当前状态</th></tr></thead>
            <tbody>
              <tr><td>官网托管</td><td>GitHub, Inc.；<a className="inline-link" href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement">GitHub 隐私声明</a></td><td>可能处理 IP 地址、请求时间、页面地址、浏览器与错误信息，用于静态页面交付、安全防护和故障排查</td><td>访问 planchime.com 时使用；官网不接入广告或行为分析脚本</td></tr>
              <tr><td>Apple 系统能力</td><td>Apple；<a className="inline-link" href="https://www.apple.com/legal/privacy/szh/">Apple 隐私政策</a></td><td>按用户操作提供通知、Apple Speech、LocalAuthentication、系统日历、系统文件/照片选择和 StoreKit 等能力</td><td>只在当前版本提供的对应功能中调用；具体范围受系统设置控制</td></tr>
              <tr><td>阿里云百炼 / 千问</td><td>阿里云计算有限公司；<a className="inline-link" href="https://terms.aliyun.com/legal-agreement/terms/suit_bu1_ali_cloud/suit_bu1_ali_cloud202107091605_49213.html">阿里云隐私政策</a></td><td>在用户主动同意并提交 AI 整理时，接收生成可编辑草稿所必需的文字、参考时间与时区；不接收原始录音</td><td>仅在当前版本已提供联网 AI 时调用；通过记上日成服务端接入，当前适配 qwen3.6-flash 北京地域</td></tr>
              <tr><td>Apple 登录</td><td>Apple</td><td>稳定登录标识，以及用户选择提供的姓名或邮箱，用于账号登录</td><td>条件能力；在线云账号服务尚未公开开放</td></tr>
              <tr><td>微信登录</td><td>微信开放平台 / 腾讯</td><td>授权码换取的稳定登录标识，用于账号登录；长期密钥只保存在服务端</td><td>计划能力，尚未作为公众登录方式开放</td></tr>
              <tr><td>企业邮件</td><td>记上日成使用的邮件服务提供方</td><td>用户主动发送的邮箱地址、邮件正文、附件和投递记录，用于客服与安全响应</td><td>仅在用户主动来信时处理</td></tr>
              <tr><td>云同步、天气与第三方诊断</td><td>以功能开启前展示的实际提供方为准</td><td>只有在完成必要性、安全与合规评估并向用户披露后，才处理相应最小信息</td><td>云账号与同步尚未公开开放；未在本清单列明的第三方诊断 SDK 不会静默启用</td></tr>
            </tbody>
          </table>
        </div>
        <p>如新增或更换第三方服务，我们会在其开始处理个人信息前更新本清单，说明提供方、目的、信息类型、调用时机和隐私政策；不会仅因代码中预留接口就把该服务写成已经启用。</p>
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
        <p>清单会在 SDK 新增或升级、接收方变化、信息类型变化前更新版本和生效日期。每个发布版本均应核对权限清单、首次使用、拒绝授权、联网调用和账号删除等场景。</p>
        <p>如发现实际处理与本清单不一致，请联系 zhangxiao@planchime.com。个人信息处理的一般规则见<Link className="inline-link" href="/privacy">《记上日成隐私政策》</Link>。</p>
      </LegalSection>
    </LegalPage>
  );
}

void FutureDataListReferencePage;
