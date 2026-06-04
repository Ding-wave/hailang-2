"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const AUTH_TIMEOUT_MS = 15_000;

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

function getSignupErrorHint(message: string) {
  if (
    message.includes("over_email_send_rate_limit") ||
    message.includes("email rate limit exceeded")
  ) {
    return "邮件发送过于频繁，请 1 小时后重试，或在 Supabase 配置自定义 SMTP 后再试。";
  }
  if (message.includes("Email address") && message.includes("invalid")) {
    return "邮箱格式不正确，请更换有效邮箱地址。";
  }
  return message;
}

function isAlreadyRegisteredMessage(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("user already registered") ||
    normalized.includes("already registered") ||
    normalized.includes("user_already_exists") ||
    normalized.includes("email exists")
  );
}

function withTimeout<T>(promise: Promise<T>, message: string) {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(message)), AUTH_TIMEOUT_MS)
    ),
  ]);
}

async function checkEmailExists(email: string) {
  const response = await fetch("/api/auth/check-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as { exists?: boolean };
  return payload.exists === true;
}

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
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);

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
    setAlreadyRegistered(false);

    try {
      const supabase = createClient();
      const exists = await withTimeout(
        checkEmailExists(email),
        "邮箱检查超时，请稍后重试。"
      );

      if (exists) {
        setAlreadyRegistered(true);
        return;
      }

      const { data, error } = await withTimeout(
        supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${getAuthBaseUrl()}/auth/callback` },
        }),
        "Supabase 注册请求超时，请检查线上环境变量、邮件配置或 Supabase 项目状态。"
      );

      if (error) {
        if (isAlreadyRegisteredMessage(error.message)) {
          setAlreadyRegistered(true);
          return;
        }
        setError(`注册失败：${getSignupErrorHint(error.message)}`);
        return;
      }

      // Supabase 对已注册邮箱会返回成功响应，但 user.identities 为空。
      // 这里显式提示用户邮箱已注册，避免误以为注册成功却收不到邮件。
      const identities = data.user?.identities ?? [];
      if (data.user && identities.length === 0) {
        setAlreadyRegistered(true);
        return;
      }

      setSuccess(true);
    } catch (err) {
      setError(`注册失败：${getErrorMessage(err)}`);
    } finally {
      setLoading(false);
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
            注册成功！
          </h2>
          <p className="text-[13px] mb-6" style={{ color: "var(--muted)" }}>
            您的账号已创建成功，请返回重新登录。
          </p>
          <button
            onClick={() => router.push("/auth/login")}
            className="w-full py-3 rounded-xl font-semibold text-[14px] text-white hover:opacity-90 transition-opacity"
            style={{ background: "var(--gold)" }}
          >
            去登录
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
          {alreadyRegistered && (
            <div
              className="mb-4 px-4 py-3 rounded-xl text-[13px]"
              style={{ background: "#FFFAEB", color: "#8A6A00", border: "1px solid #FACC15" }}
            >
              该邮箱已注册，请直接登录。若忘记密码，请在登录页使用“忘记密码”找回。
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
