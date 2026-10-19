import assert from "node:assert/strict";
import test from "node:test";
import { androidCandidate, createAndroidDownloadState } from "../app/download/androidRelease.ts";

const expectedPath = "/downloads/android/1.1-2/planchime-1.1-2-arm64-v8a.apk";
const approved = {
  PLANCHIME_ANDROID_PUBLICATION_APPROVED: "1",
  PLANCHIME_ANDROID_APK_SHA256: androidCandidate.sha256,
  PLANCHIME_ANDROID_APK_URL: `https://planchime.com${expectedPath}`,
};

test("候选包信息与冻结的正式签名产物一致", () => {
  assert.equal(androidCandidate.packageName, "com.planchime.app");
  assert.equal(androidCandidate.version, "1.1");
  assert.equal(androidCandidate.versionCode, 2);
  assert.equal(androidCandidate.sizeBytes, 112778980);
  assert.equal(androidCandidate.sha256, "088b5ac13a74320c64a4bf09dd630cfbd04b5c9045702e865c9490ca22560f1f");
  assert.match(androidCandidate.sha256, /^[0-9a-f]{64}$/);
});

test("没有批准、校验值或链接时下载默认关闭", () => {
  assert.deepEqual(createAndroidDownloadState({}), { status: "pending" });
  for (const key of Object.keys(approved)) {
    assert.deepEqual(createAndroidDownloadState({ ...approved, [key]: "" }), { status: "pending" }, key);
  }
  assert.deepEqual(createAndroidDownloadState({ ...approved, PLANCHIME_ANDROID_PUBLICATION_APPROVED: "true" }), { status: "pending" });
  assert.deepEqual(createAndroidDownloadState({ ...approved, PLANCHIME_ANDROID_APK_SHA256: "a".repeat(64) }), { status: "pending" });
});

test("只接受明确批准的自有 HTTPS 固定版本 APK 地址", () => {
  for (const host of ["planchime.com", "api.planchime.com"]) {
    const url = `https://${host}${expectedPath}`;
    assert.deepEqual(createAndroidDownloadState({ ...approved, PLANCHIME_ANDROID_APK_URL: url }), { status: "available", url });
  }
});

test("拒绝测试包、第三方、临时令牌、凭据与错误协议链接", () => {
  for (const url of [
    "not-a-url", `http://planchime.com${expectedPath}`, `//planchime.com${expectedPath}`,
    `https://example.com${expectedPath}`, `https://planchime.com.example.com${expectedPath}`,
    `https://planchime.com:8443${expectedPath}`, `https://user:password@planchime.com${expectedPath}`,
    `https://planchime.com${expectedPath}?token=example`, `https://planchime.com${expectedPath}#download`,
    "https://planchime.com/downloads/app-debug.apk", "https://planchime.com/downloads/latest.apk",
    `https://planchime.com${expectedPath.replace("1.1-2/", "1.0-1/")}`,
    `https://planchime.com${expectedPath.replace(/\.apk$/, ".aab")}`,
    "javascript:alert(1)",
  ]) {
    assert.deepEqual(createAndroidDownloadState({ ...approved, PLANCHIME_ANDROID_APK_URL: url }), { status: "pending" }, url);
  }
});
