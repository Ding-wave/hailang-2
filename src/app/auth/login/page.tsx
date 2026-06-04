"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

function LoginPageContent() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") ?? "/";
  const hasError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(() => {
    if (!hasError) return null;
    if (hasError === "account_removed") {
      return "账号不存在或已被注销，请重新注册或联系管理员。";
    }
    return `身份验证失败：${hasError}`;
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message || "登录失败，请检查账号密码");
        setIsLoading(false);
        return;
      }

      if (data?.user) {
        window.location.replace(redirectTo);
        return;
      }

      setError("登录失败，请检查账号密码");
      setIsLoading(false);
    } catch (err) {
      console.error("登录运行发生未知崩溃:", err);
      setError("登录发生未知错误，请重试");
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-[85vh] flex flex-col items-center justify-center px-4 py-12"
      style={{ background: "var(--background)" }}
    >
      {/* Logo */}
      <Link href="/" prefetch={false} className="flex flex-col items-center mb-8">
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
              disabled={isLoading}
              className="w-full px-4 py-2.5 rounded-xl text-[14px] outline-none transition-all disabled:opacity-50"
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
              disabled={isLoading}
              className="w-full px-4 py-2.5 rounded-xl text-[14px] outline-none transition-all disabled:opacity-50"
              style={{
                background: "var(--background)",
                border: "1px solid var(--card-border)",
                color: "var(--foreground)",
              }}
              onFocus={(e) => (e.target.style.borderColor = "var(--gold)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--card-border)")}
            />
            <div className="flex justify-end mt-1.5">
              <Link
                href="/forgot-password"
                className="text-[12px] hover:underline"
                style={{ color: "var(--gold)" }}
                tabIndex={isLoading ? -1 : 0}
                aria-disabled={isLoading}
              >
                忘记密码？
              </Link>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            aria-busy={isLoading}
            className="w-full py-3 rounded-xl font-semibold text-[14px] text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed mt-1"
            style={{ background: "var(--gold)" }}
          >
            {isLoading ? "登录中…" : "登录"}
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
