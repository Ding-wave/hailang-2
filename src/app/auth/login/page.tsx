"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") ?? "/dashboard";
  const hasError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    hasError ? "身份验证失败，请重试。" : null
  );

  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError("邮箱或密码错误，请重新输入。");
      setLoading(false);
    } else {
      router.push(redirectTo);
      router.refresh();
    }
  };

  return (
    <div
      className="min-h-[85vh] flex flex-col items-center justify-center px-4 py-12"
      style={{ background: "var(--background)" }}
    >
      {/* Logo */}
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
          欢迎回来
        </h1>
        <p className="text-[13px] mb-6" style={{ color: "var(--muted)" }}>
          登录你的海浪资讯账号
        </p>

        {error && (
          <div
            className="mb-4 px-4 py-3 rounded-xl text-[13px]"
            style={{ background: "#FEF3F2", color: "#B42318", border: "1px solid #FECDCA" }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
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
              style={{
                background: "var(--background)",
                border: "1px solid var(--card-border)",
                color: "var(--foreground)",
              }}
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-2.5 rounded-xl text-[14px] outline-none transition-all"
              style={{
                background: "var(--background)",
                border: "1px solid var(--card-border)",
                color: "var(--foreground)",
              }}
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
            {loading ? "登录中…" : "登录"}
          </button>
        </form>

        <p className="text-center text-[13px] mt-5" style={{ color: "var(--muted)" }}>
          还没有账号？{" "}
          <Link href="/auth/register" className="font-semibold hover:underline" style={{ color: "var(--gold)" }}>
            免费注册
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}
