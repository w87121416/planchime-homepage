export const androidCandidate = {
  name: "记上日成",
  packageName: "com.planchime.app",
  version: "1.1",
  versionCode: 2,
  sizeBytes: 112778980,
  minimumSystem: "Android 7.0",
  architecture: "ARM64",
  sha256: "088b5ac13a74320c64a4bf09dd630cfbd04b5c9045702e865c9490ca22560f1f",
} as const;

export type AndroidDownloadState =
  | Readonly<{ status: "pending" }>
  | Readonly<{ status: "available"; url: string }>;

export function createAndroidDownloadState(
  environment: Readonly<Record<string, string | undefined>>,
): AndroidDownloadState {
  // 页面完成不代表安装包获准公开；必须显式批准，并绑定验收过的精确字节。
  // 这里仅防止误配，不替代真机测试、线上完整下载及正式发布审批。
  if (
    environment.PLANCHIME_ANDROID_PUBLICATION_APPROVED !== "1" ||
    environment.PLANCHIME_ANDROID_APK_SHA256 !== androidCandidate.sha256
  ) return { status: "pending" };

  try {
    const url = new URL(environment.PLANCHIME_ANDROID_APK_URL ?? "");
    const trustedHosts = new Set(["planchime.com", "api.planchime.com"]);
    const expectedPath = "/downloads/android/1.1-2/planchime-1.1-2-arm64-v8a.apk";
    // 不接受第三方跳转、临时令牌链接或 AAB，避免误发旧包、测试包和凭据。
    if (
      url.protocol !== "https:" || !trustedHosts.has(url.hostname) ||
      url.port || url.username || url.password || url.search || url.hash ||
      url.pathname !== expectedPath
    ) return { status: "pending" };
    return { status: "available", url: url.toString() };
  } catch {
    return { status: "pending" };
  }
}

export const androidDownload = createAndroidDownloadState(process.env);
