"use client";
/* eslint-disable @next/next/no-html-link-for-pages -- 目录静态站采用原生锚点，避免框架重复拼接 hash。 */

import styles from "./siteFrame.module.css";

export function MobileMenu() {
  return (
    // 原生 details 在脚本未加载时仍可展开；增强事件只负责收起，不作为导航可用的前提。
    <details className={styles.mobileMenu} onKeyDown={(event) => {
      if (event.key === "Escape") {
        event.currentTarget.open = false;
        event.currentTarget.querySelector("summary")?.focus();
      }
    }}>
      <summary className={styles.menuButton} aria-label="导航菜单" aria-controls="mobile-navigation">
        <span className={styles.menuLines} aria-hidden="true"><i /><i /></span>
        <span className={styles.menuClose} aria-hidden="true">×</span>
      </summary>
      <nav id="mobile-navigation" aria-label="手机导航" onClick={(event) => {
        if (event.target instanceof Element && event.target.closest("a")) {
          event.currentTarget.closest("details")?.removeAttribute("open");
        }
      }}>
        <a href="/services/">产品与服务</a>
        <a href="/#experience">产品体验</a>
        <a href="/#platforms">下载与使用</a>
        <a href="/about/">关于我们</a>
        <a href="/contact/">联系我们</a>
        <a href="/support/">帮助与支持</a>
        <a href="/privacy/">隐私政策</a>
      </nav>
    </details>
  );
}
