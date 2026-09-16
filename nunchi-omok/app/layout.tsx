import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "눈치오목 — 생각은 몰래, 승부는 동시에",
  description: "2–6명이 함께 즐기는 비공개 동시 재배치 오목 게임",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
