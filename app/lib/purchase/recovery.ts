import { PurchaseClientError } from "./protocol.ts";

/** 页面未来使用稳定代码选择恢复文案，不能按供应商报错正文推测注册或付款成功。 */
export function purchaseRecovery(error: unknown): Readonly<{ message: string; action: "sign-in" | "view-order" | "retry-same-intent" | "wait" | "review" }> {
  const code = error instanceof PurchaseClientError ? error.code : "UNKNOWN";
  if (code === "PURCHASE_READ_ONLY") return { message: "尚未开放购买。当前只能查看商品目录开放状态，网页登录与订单服务仍在准备。", action: "wait" };
  if (code === "COMMERCE_METADATA_REQUIRED") return { message: "购买信息尚未准备完整，暂未开放购买。", action: "wait" };
  if (code === "COMMERCE_CATALOG_REVISION_CONFLICT") return { message: "购买信息已更新，请重新核对后确认。", action: "review" };
  if (code === "RECOVERY_RECORD_UPDATE_FAILED") return { message: "订单已存在，但本机恢复记录未能更新。请在我的订单中核对原单，不要重新下单或重复付款。", action: "view-order" };
  if (["RECOVERY_STORAGE_UNAVAILABLE", "RECOVERY_LOG_INVALID", "RECOVERY_LOG_CHANGED", "RECOVERY_PRICE_CHANGED"].includes(code)) return { message: "本机恢复记录暂不可用，已停止下单。你仍可以登录后查看服务端的原订单；不要重复购买。", action: "view-order" };
  if (["PURCHASE_DISABLED", "COMMERCE_CONFIGURATION_REQUIRED"].includes(code)) return { message: "官网购买与订单服务暂未开放。现有免费功能保持不变，可通过帮助与支持了解服务状态。", action: "wait" };
  if (["DESKTOP_PAYMENT_REQUIRED", "H5_PAYMENT_REQUIRED"].includes(code)) return { message: "此设备暂不支持这笔订单的付款方式。订单仍可查询，请使用支持原付款方式的浏览器继续。", action: "view-order" };
  if (code === "RECOVERY_CHANNEL_CHANGED") return { message: "已有购买操作使用另一种付款方式。请先查看原订单，不会自动改换渠道或新建订单。", action: "view-order" };
  if (["AUTHENTICATION_REQUIRED", "ACCOUNT_CHANGED"].includes(code)) return { message: "登录状态已变化。请先确认账号，再继续；这不会开启日程同步。", action: "sign-in" };
  if (code === "COMMERCE_ALREADY_OWNED") return { message: "当前账号已拥有这项权益，无需重复购买。", action: "review" };
  if (code === "COMMERCE_PURCHASE_IN_PROGRESS") return { message: "已有一笔订单正在处理，请先查看原订单，不要重复付款。", action: "view-order" };
  if (["ORIGINAL_ORDER_CHECK_REQUIRED", "COMMERCE_ORDER_EXPIRED", "PAYMENT_DESTINATION_REJECTED"].includes(code)) return { message: "原订单需要先核对状态。暂未打开支付页面，也不会自动创建新订单；请先查询原单。", action: "view-order" };
  if (code === "COMMERCE_ORDER_CLOSED") return { message: "支付渠道已确认原订单关闭。重新购买前需要再次核对商品与账号。", action: "review" };
  if (["PHONE_LOGIN_NOT_CONFIGURED", "TEMPORARILY_UNAVAILABLE"].includes(code)) return { message: "网页登录暂不可用。可以稍后再试，或在 App 内核对已有账号的手机号绑定；此操作不会自动注册或合并账号。", action: "wait" };
  if (code.startsWith("OTP_") || code === "RATE_LIMITED") return { message: "验证码暂未通过验证。请检查验证码或稍后重试，不会自动重新发送短信。", action: "wait" };
  if (error instanceof PurchaseClientError && error.outcome === "unknown") return { message: "请求结果暂未确认。请查询原订单，或重试同一次操作；不要新建订单或重复付款。", action: "retry-same-intent" };
  return { message: "这一步暂时无法继续，尚未确认购买成功。请保留当前页面，稍后核对服务状态。", action: "wait" };
}
