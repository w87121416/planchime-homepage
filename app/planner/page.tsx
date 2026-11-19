import type { Metadata } from "next";
import Link from "next/link";
import { SiteFrame } from "../components/SiteFrame";
import { PlannerWorkbench } from "./PlannerWorkbench";
import styles from "./planner.module.css";

export const metadata: Metadata = {
  title: "免费网页日程本",
  description: "直接在网页记录、修改、完成日程，并导出备份。免费、无需登录，数据仅在当前浏览器保存，不提供到点提醒或跨端同步。",
  alternates: { canonical: "/planner/" },
};

export default function PlannerPage() {
  return <SiteFrame currentPage="网页日程">
    <div className={styles.workspace}>
      <header className={styles.intro}>
        <p className={styles.eyebrow}>记上日成 · 免费网页服务</p>
        <h1>先记下来，慢慢安排。</h1>
        <p>免费使用，无需登录。日程仅保存在当前浏览器，不会同步到 App 或其他设备。网页不发送到点提醒。</p>
      </header>
      <noscript><div className={styles.error}>网页日程需要启用 JavaScript 才能读取和保存。你仍可查看<Link href="/services/">产品与服务说明</Link>，或<Link href="/contact/">联系支持</Link>。</div></noscript>
      <PlannerWorkbench />
      <aside className={styles.help}>
        <strong>你的日程，由你保管。</strong>
        <p>清理浏览器数据、卸载浏览器或结束无痕窗口可能清除日程。建议按需导出备份；最多保存 500 条事项。已经打开的日程本可在断网后继续编辑，不保证断网时能重新打开网站。</p>
        <p>服务提供方：米堆（南京）网络科技有限公司 · <Link href="/services/">服务说明与价格</Link> · <Link href="/privacy/">隐私政策</Link> · <Link href="/terms/">用户协议</Link> · <Link href="/contact/">帮助与反馈</Link></p>
      </aside>
    </div>
  </SiteFrame>;
}
