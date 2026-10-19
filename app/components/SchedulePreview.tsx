/* eslint-disable @next/next/no-img-element -- 使用 Figma 导出的本地 SVG，不依赖第三方图标网络。 */
import styles from "../home.module.css";

/** 展示用示意界面不冒充真实产品截图，也不提供无法执行的网页按钮。 */
export function SchedulePreview() {
  return (
    <div className={styles.phone} role="img" aria-label="日程界面示意：今日三件安排，一件已完成；非实际版本截图">
      <div className={styles.phoneScreen} aria-hidden="true">
        <div className={styles.phoneIsland} />
        <div className={styles.phoneStatus}><span>9:41</span><span>••• ▰</span></div>
        <div className={styles.phoneBrand}><span>记上日成</span><span>＋</span></div>
        <div className={styles.phoneTitle}><strong>今天</strong><span>10月17日 周六</span></div>
        <div className={styles.phoneWeek}>{["一", "二", "三", "四", "五", "六", "日"].map((day, index) => <div key={day}><span>{day}</span><b className={index === 5 ? styles.selectedDay : undefined}>{12 + index}</b></div>)}</div>
        <div className={styles.phoneCount}><span>3 件安排</span><span>已完成 1</span></div>
        <div className={styles.phoneTasks}>
          {[["10:00", "整理本周计划", true], ["14:30", "和同事讨论新方案", false], ["18:00", "留一点时间散步", false]].map(([time, title, completed]) => <div key={String(time)}><time>{time}</time><span className={completed ? styles.taskCompleted : undefined}>{title}</span><img src={completed ? "/images/schedule-completed.svg" : "/images/schedule-pending.svg"} alt="" width="15" height="15" /></div>)}
        </div>
        <div className={styles.phoneTabs}><span>今天</span><span>日历</span><span>我的</span></div>
        <div className={styles.homeIndicator} />
      </div>
    </div>
  );
}
