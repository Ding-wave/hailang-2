import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import PasswordRecoveryHandler from "@/components/PasswordRecoveryHandler";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NewsFlow — AI 驱动的精品资讯",
  description: "获取最新科技新闻，由 Gemini AI 自动翻译与情感分析。订阅会员解锁完整阅读权限。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" style={{ background: "var(--background)" }}>
        <Suspense fallback={null}>
          <PasswordRecoveryHandler />
        </Suspense>
        <Navbar />
        <main className="flex-1">{children}</main>
        <footer className="py-6" style={{ borderTop: "1px solid var(--card-border)" }}>
          <p className="text-center text-[12px]" style={{ color: "var(--muted)" }}>
            © 2026 海浪资讯 · 由 Gemini AI &amp; Supabase 驱动
          </p>
        </footer>
      </body>
    </html>
  );
}
