import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://planchime.com"),
  title: {
    default: "记上日成 - 日程、待办与提醒",
    template: "%s｜记上日成",
  },
  description:
    "记上日成 Android 1.0 是一款无需登录的离线日程、待办与本地提醒工具。",
  applicationName: "记上日成",
  authors: [{ name: "米堆（南京）网络科技有限公司" }],
  icons: {
    icon: "/images/app-icon.png",
    shortcut: "/images/app-icon.png",
    apple: "/images/app-icon.png",
  },
  openGraph: {
    type: "website",
    locale: "zh_CN",
    url: "https://planchime.com",
    siteName: "记上日成",
    title: "记上日成 - 日程、待办与提醒",
    description: "无需登录，把日程、待办和本地提醒稳稳保存在设备上。",
    images: [
      {
        url: "/images/og-ink-city-v1-1200x630.png",
        width: 1200,
        height: 630,
        alt: "记上日成水墨城市主题",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "记上日成 - 日程、待办与提醒",
    description: "无需登录，把日程、待办和本地提醒稳稳保存在设备上。",
    images: ["/images/og-ink-city-v1-1200x630.png"],
  },
  robots: {
    // 官网与审核页面均为正式公开入口，搜索抓取口径保持一致。
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f4edde",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
