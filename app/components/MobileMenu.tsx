"use client";
/* eslint-disable @next/next/no-html-link-for-pages -- 目录静态站采用原生锚点，避免框架重复拼接 hash。 */

import { useState } from "react";
import styles from "./siteFrame.module.css";

export function MobileMenu() {
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.mobileMenu}>
      <button className={styles.menuButton} type="button" aria-label={open ? "关闭导航菜单" : "打开导航菜单"} aria-expanded={open} aria-controls="mobile-navigation" onClick={() => setOpen(!open)}>
        <span aria-hidden="true">{open ? "×" : <><i /><i /></>}</span>
      </button>
      {/* 选择锚点后收起菜单，避免手机端导航遮住目标内容；Escape 也可直接退出。 */}
      <nav id="mobile-navigation" aria-label="手机导航" hidden={!open} onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }}>
        <a href="/#experience" onClick={() => setOpen(false)}>产品体验</a>
        <a href="/#platforms" onClick={() => setOpen(false)}>下载与使用</a>
        <a href="/support/" onClick={() => setOpen(false)}>帮助与支持</a>
        <a href="/privacy/" onClick={() => setOpen(false)}>隐私政策</a>
      </nav>
    </div>
  );
}
