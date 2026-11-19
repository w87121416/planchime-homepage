import type { PurchaseConfiguration } from "../purchase/transport.ts";

export type ServiceConfiguration = Readonly<{
  transport: PurchaseConfiguration;
  textEnabled: boolean;
  /** 只能来自已审核部署说明，不能拿备份期限代替 AI 原文/结果的留存政策。 */
  textRetentionDisclosure: string | null;
  themeEnabled: boolean;
  backupEnabled: boolean;
  voiceEnabled: boolean;
  voiceRetentionDisclosure: string | null;
}>;

// 不读查询串、localStorage 或运行时全局变量开通功能；正式审批前所有服务保持关闭。
export const serviceConfiguration: ServiceConfiguration = Object.freeze({
  transport: Object.freeze({ mode: "disabled", apiOrigin: "https://api.planchime.com", servicesApproved: false }),
  textEnabled: false,
  textRetentionDisclosure: "原文和草稿在服务器加密保留 24 小时，到期清除。你明确保存到当前浏览器的日程不受此期限影响。",
  themeEnabled: false, backupEnabled: false,
  voiceEnabled: false,
  voiceRetentionDisclosure: "转写文字和日程草稿在米堆服务器加密保留 24 小时，到期清除。你明确保存到当前浏览器的日程不受此期限影响。",
});
export const TEXT_RETENTION_POLICY = "pro-text-retention.24h.20261119.v1";
