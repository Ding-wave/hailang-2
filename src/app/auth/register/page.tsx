"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const PERKS = [
  "完整阅读 AI 翻译全文",
  "每篇文章附带情感分析报告",
  "定时任务每小时自动更新资讯",
  "无广告沉浸式阅读体验",
];

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const supabase = createClient();

  const getAuthBaseUrl = () => {
    const configuredBaseUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
    if (configuredBaseUrl) {
      return configuredBaseUrl.replace(/\/$/, "");
    }
    return window.location.origin;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${getAuthBaseUrl()}/auth/callback` },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSuccess(true);
    }
  };

  if (success) {
    return (
      <div
        className="min-h-[85vh] flex items-center justify-center px-4"
        style={{ background: "var(--background)" }}
      >
        <div
          className="w-full max-w-sm rounded-2xl p-8 text-center"
          style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}
        >
          <div className="flex items-end justify-center gap-[3px] mb-4">
            {[14, 20, 17, 11].map((h, i) => (
              <span key={i} className="w-[4px] rounded-full" style={{ height: h, background: "var(--gold)" }} />
            ))}
          </div>
          <h2 className="text-xl font-bold mb-2" style={{ color: "var(--foreground)" }}>
            请查收验证邮件
          </h2>
          <p className="text-[13px] mb-6" style={{ color: "var(--muted)" }}>
            已向 <span className="font-semibold" style={{ color: "var(--foreground)" }}>{email}</span> 发送确认链接，点击激活账号后即可登录。
          </p>
          <button
            onClick={() => router.push("/")}
            className="w-full py-3 rounded-xl font-semibold text-[14px] text-white hover:opacity-90 transition-opacity"
            style={{ background: "var(--gold)" }}
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-[85vh] flex flex-col items-center justify-center px-4 py-12"
      style={{ background: "var(--background)" }}
    >
      {/* Logo */}
      <Link href="/" className="flex flex-col items-center mb-8">
        <div className="flex items-end gap-[3px] mb-2">
          {[14, 20, 17, 11].map((h, i) => (
            <span key={i} className="w-[4px] rounded-full" style={{ height: h, background: "var(--gold)" }} />
          ))}
        </div>
        <span className="text-[15px] font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
          海浪资讯
        </span>
      </Link>

      <div className="w-full max-w-sm">
        <div
          className="rounded-2xl p-7 mb-4"
          style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}
        >
          <h1 className="text-xl font-bold mb-1" style={{ color: "var(--foreground)" }}>
            创建账号
          </h1>
          <p className="text-[13px] mb-6" style={{ color: "var(--muted)" }}>
            加入海浪资讯，获取 AI 精选资讯
          </p>

          {error && (
            <div
              className="mb-4 px-4 py-3 rounded-xl text-[13px]"
              style={{ background: "#FEF3F2", color: "#B42318", border: "1px solid #FECDCA" }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
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
                className="w-full px-4 py-2.5 rounded-xl text-[14px] outline-none transition-all"
                style={{ background: "var(--background)", border: "1px solid var(--card-border)", color: "var(--foreground)" }}
                onFocus={(e) => (e.target.style.borderColor = "var(--gold)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--card-border)")}
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium mb-1.5" style={{ color: "var(--foreground)" }}>
                密码
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="至少 6 位字符"
                className="w-full px-4 py-2.5 rounded-xl text-[14px] outline-none transition-all"
                style={{ background: "var(--background)", border: "1px solid var(--card-border)", color: "var(--foreground)" }}
                onFocus={(e) => (e.target.style.borderColor = "var(--gold)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--card-border)")}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-semibold text-[14px] text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed mt-1"
              style={{ background: "var(--gold)" }}
            >
              {loading ? "注册中…" : "免费注册"}
            </button>
          </form>

          <p className="text-center text-[13px] mt-5" style={{ color: "var(--muted)" }}>
            已有账号？{" "}
            <Link href="/auth/login" className="font-semibold hover:underline" style={{ color: "var(--gold)" }}>
              立即登录
            </Link>
          </p>
        </div>

        {/* 会员权益卡片 */}
        <div
          className="rounded-2xl p-5"
          style={{ background: "var(--gold-light)", border: "1px solid var(--gold)" }}
        >
          <p className="text-[13px] font-bold mb-3" style={{ color: "var(--gold)" }}>
            会员专属权益
          </p>
          <ul className="space-y-2">
            {PERKS.map((p) => (
              <li key={p} className="flex items-start gap-2 text-[13px]" style={{ color: "var(--gold)" }}>
                <span className="mt-0.5 shrink-0">✓</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
