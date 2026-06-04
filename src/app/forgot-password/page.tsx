"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

function getAuthBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    setIsLoading(true);
    setError(null);
    setSent(false);

    try {
      const supabase = createClient();
      const baseUrl = getAuthBaseUrl() || "https://wavedata.asia";
      // 直达客户端页面兑换 session，避免邮件预取在 /auth/callback 服务端消耗 PKCE code
      const redirectTo = `${baseUrl.replace(/\/$/, "")}/reset-password`;

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo }
      );

      if (resetError) {
        setError(resetError.message);
        return;
      }

      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "发送失败，请稍后重试");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-[85vh] flex flex-col items-center justify-center px-4 py-12"
      style={{ background: "var(--background)" }}
    >
      <Link href="/" className="flex flex-col items-center mb-8">
        <div className="flex items-end gap-[3px] mb-2">
          {[14, 20, 17, 11].map((h, i) => (
            <span
              key={i}
              className="w-[4px] rounded-full"
              style={{ height: h, background: "var(--gold)" }}
            />
          ))}
        </div>
        <span className="text-[15px] font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
          海浪资讯
        </span>
      </Link>

      <div
        className="w-full max-w-sm rounded-2xl p-7"
        style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}
      >
        <h1 className="text-xl font-bold mb-1" style={{ color: "var(--foreground)" }}>
          重置密码
        </h1>
        <p className="text-[13px] mb-6" style={{ color: "var(--muted)" }}>
          输入注册邮箱，我们将发送重置链接
        </p>

        {error && (
          <div
            className="mb-4 px-4 py-3 rounded-xl text-[13px]"
            style={{ background: "#FEF3F2", color: "#B42318", border: "1px solid #FECDCA" }}
          >
            {error}
          </div>
        )}

        {sent ? (
          <div
            className="px-4 py-3 rounded-xl text-[13px] mb-4"
            style={{ background: "#ECFDF3", color: "#027A48", border: "1px solid #ABEFC6" }}
          >
            若该邮箱已注册，你将收到重置邮件。请检查收件箱与垃圾邮件文件夹。
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[13px] font-medium mb-1.5" style={{ color: "var(--foreground)" }}>
                邮箱地址
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                disabled={isLoading}
                className="w-full px-4 py-2.5 rounded-xl text-[14px] outline-none disabled:opacity-60"
                style={{
                  background: "var(--background)",
                  border: "1px solid var(--card-border)",
                  color: "var(--foreground)",
                }}
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-xl font-semibold text-[14px] text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: "var(--gold)" }}
            >
              {isLoading ? "发送中…" : "发送重置邮件"}
            </button>
          </form>
        )}

        <p className="text-center text-[13px] mt-5" style={{ color: "var(--muted)" }}>
          <Link href="/auth/login" className="font-semibold hover:underline" style={{ color: "var(--gold)" }}>
            返回登录
          </Link>
        </p>
      </div>
    </div>
  );
}
