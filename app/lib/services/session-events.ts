// 通知不携带账号或令牌；来源仅用于忽略同一页面自己发出的失效事件。
const source = typeof window === "undefined" ? "server" : crypto.randomUUID();
const channelName = "planchime:service-session:v1";
export function broadcastServiceInvalidation() {
  if (typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel(channelName); channel.postMessage({ type: "invalidate", source }); channel.close();
}
export function subscribeServiceInvalidation(invalidate: () => void) {
  if (typeof BroadcastChannel === "undefined") return () => {};
  const channel = new BroadcastChannel(channelName);
  channel.onmessage = event => { if (event.data?.type === "invalidate" && event.data.source !== source) invalidate(); };
  return () => channel.close();
}
