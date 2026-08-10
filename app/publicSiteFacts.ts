type BuildEnvironment = Readonly<Record<string, string | undefined>>;

export type StorePrice = Readonly<{
  product: "月会员" | "年会员" | "AI 次数补充包";
  displayPrice: string;
}>;

export type FilingRecord = Readonly<{
  kind: "icp" | "public-security" | "app";
  number: string;
  href?: string;
}>;

export type PublicSiteFacts = Readonly<{
  appStoreUrl?: string;
  filings: readonly FilingRecord[];
  storePrices: readonly StorePrice[];
}>;

function cleanPublicText(value: string | undefined, maxLength: number): string | undefined {
  const cleaned = value?.trim().replace(/\s+/g, " ");
  if (!cleaned || cleaned.length > maxLength) return undefined;
  return cleaned;
}

function allowHttpsUrl(
  value: string | undefined,
  allowedHosts: ReadonlySet<string>,
): string | undefined {
  const cleaned = cleanPublicText(value, 500);
  if (!cleaned) return undefined;

  try {
    const url = new URL(cleaned);
    // 官网只接受已知官方域名，避免把构建变量误配成不可信下载或备案链接。
    if (url.protocol !== "https:" || !allowedHosts.has(url.hostname.toLowerCase())) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

function cleanStorePrice(value: string | undefined): string | undefined {
  const cleaned = cleanPublicText(value, 32);
  // 商店价格必须是人工从真实商品页抄录的完整展示文字；空值或明显不是价格的值一律不公开。
  if (!cleaned || !/\p{N}/u.test(cleaned)) return undefined;
  return cleaned;
}

function cleanAppStoreProductUrl(value: string | undefined): string | undefined {
  const trustedUrl = allowHttpsUrl(value, new Set(["apps.apple.com"]));
  if (!trustedUrl) return undefined;

  const url = new URL(trustedUrl);
  // 只接受带 Apple 数字应用 ID 的公开产品页，订阅管理页或普通 Apple 页面不能冒充下载入口。
  return /\/id\d+\/?$/u.test(url.pathname) ? trustedUrl : undefined;
}

export function createPublicSiteFacts(environment: BuildEnvironment): PublicSiteFacts {
  const appStoreUrl = cleanAppStoreProductUrl(environment.PLANCHIME_APP_STORE_URL);

  const filings: FilingRecord[] = [];
  const icpNumber = cleanPublicText(environment.PLANCHIME_ICP_NUMBER, 80);
  const publicSecurityNumber = cleanPublicText(environment.PLANCHIME_PUBLIC_SECURITY_NUMBER, 80);
  const appFilingNumber = cleanPublicText(environment.PLANCHIME_APP_FILING_NUMBER, 80);

  if (icpNumber) {
    filings.push({
      kind: "icp",
      number: icpNumber,
      href: "https://beian.miit.gov.cn/",
    });
  }
  if (publicSecurityNumber) {
    filings.push({
      kind: "public-security",
      number: publicSecurityNumber,
      href: allowHttpsUrl(
        environment.PLANCHIME_PUBLIC_SECURITY_URL,
        new Set(["beian.gov.cn", "www.beian.gov.cn"]),
      ),
    });
  }
  if (appFilingNumber) filings.push({ kind: "app", number: appFilingNumber });

  const storePrices: StorePrice[] = [];
  const monthlyPrice = cleanStorePrice(environment.PLANCHIME_MONTHLY_STORE_PRICE);
  const annualPrice = cleanStorePrice(environment.PLANCHIME_ANNUAL_STORE_PRICE);
  const topUpPrice = cleanStorePrice(environment.PLANCHIME_TOP_UP_STORE_PRICE);

  if (monthlyPrice) storePrices.push({ product: "月会员", displayPrice: monthlyPrice });
  if (annualPrice) storePrices.push({ product: "年会员", displayPrice: annualPrice });
  if (topUpPrice) storePrices.push({ product: "AI 次数补充包", displayPrice: topUpPrice });

  return { appStoreUrl, filings, storePrices };
}

// 这些值在构建时固化到静态官网；没有经过确认的事实保持空值，页面不会渲染占位链接、备案号或价格。
export const publicSiteFacts = createPublicSiteFacts(process.env);
