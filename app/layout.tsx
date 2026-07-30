import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://planchime.com"),
  title: {
    default: "记上日成 - 日程、待办与提醒",
    template: "%s｜记上日成",
  },
  description:
    "记上日成是一款本地优先、由你确认的日程、待办与提醒工具。说一句，把事情稳稳记上日程。",
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
    description: "说一句，把事情稳稳记上日程。",
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
    description: "说一句，把事情稳稳记上日程。",
    images: ["/images/og-ink-city-v1-1200x630.png"],
  },
  robots: {
    // 官网首页允许被发现；仍处于草案状态的法律页面会在自身 metadata 中单独禁止索引。
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
