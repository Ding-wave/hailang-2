"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const MIN_PASSWORD_LENGTH = 6;

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const code = searchParams.get("code");
    const tokenHash = searchParams.get("token_hash");
    const type = searchParams.get("type");

    const clearAuthParamsFromUrl = () => {
      window.history.replaceState({}, "", "/reset-password");
    };

    (async () => {
      try {
        if (tokenHash && type === "recovery") {
          const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: "recovery",
          });
          if (verifyError) {
            setError(verifyError.message);
            setHasSession(false);
            setCheckingSession(false);
            return;
          }
          clearAuthParamsFromUrl();
        } else if (code) {
          const { error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            const {
              data: { session: existing },
            } = await supabase.auth.getSession();
            if (!existing) {
              setError(exchangeError.message);
              setHasSession(false);
              setCheckingSession(false);
              return;
            }
          }
          clearAuthParamsFromUrl();
        } else if (window.location.hash) {
          // 隐式流（#access_token）由 supabase-js 在 getSession 时解析
          const hashType = new URLSearchParams(
            window.location.hash.replace(/^#/, "")
          ).get("type");
          if (hashType === "recovery") {
            clearAuthParamsFromUrl();
          }
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();
        setHasSession(Boolean(session));
      } catch (err) {
        setError(err instanceof Error ? err.message : "验证链接失败");
        setHasSession(false);
      } finally {
        setCheckingSession(false);
      }
    })();
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    setError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`密码至少 ${MIN_PASSWORD_LENGTH} 个字符`);
      return;
    }
    if (password !== confirmPassword) {
      setError("两次输入的密码不一致");
      return;
    }

    setIsLoading(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        setError(updateError.message);
        setIsLoading(false);
        return;
      }

      window.location.assign("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "设置密码失败，请稍后重试");
      setIsLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center" style={{ background: "var(--background)" }}>
        <p className="text-[14px]" style={{ color: "var(--muted)" }}>验证链接中…</p>
      </div>
    );
  }

  if (!hasSession) {
    return (
      <div
        className="min-h-[85vh] flex flex-col items-center justify-center px-4 py-12"
        style={{ background: "var(--background)" }}
      >
        <div
          className="w-full max-w-sm rounded-2xl p-7 text-center"
          style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}
        >
          <p className="text-[14px] mb-4" style={{ color: "var(--foreground)" }}>
            {error ?? "链接无效或已过期，请重新申请重置邮件。"}
          </p>
          <Link
            href="/forgot-password"
            className="inline-block py-2.5 px-5 rounded-xl text-[14px] font-semibold text-white"
            style={{ background: "var(--gold)" }}
          >
            重新发送
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-[85vh] flex flex-col items-center justify-center px-4 py-12"
      style={{ background: "var(--background)" }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-7"
        style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}
      >
        <h1 className="text-xl font-bold mb-1" style={{ color: "var(--foreground)" }}>
          设置新密码
        </h1>
        <p className="text-[13px] mb-6" style={{ color: "var(--muted)" }}>
          请输入你的新密码
        </p>

        {error && (
          <div
            className="mb-4 px-4 py-3 rounded-xl text-[13px]"
            style={{ background: "#FEF3F2", color: "#B42318", border: "1px solid #FECDCA" }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="新密码"
            disabled={isLoading}
            className="w-full px-4 py-2.5 rounded-xl text-[14px] outline-none disabled:opacity-60"
            style={{
              background: "var(--background)",
              border: "1px solid var(--card-border)",
              color: "var(--foreground)",
            }}
          />
          <input
            type="password"
            required
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="确认新密码"
            disabled={isLoading}
            className="w-full px-4 py-2.5 rounded-xl text-[14px] outline-none disabled:opacity-60"
            style={{
              background: "var(--background)",
              border: "1px solid var(--card-border)",
              color: "var(--foreground)",
            }}
          />
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 rounded-xl font-semibold text-[14px] text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: "var(--gold)" }}
          >
            {isLoading ? "保存中…" : "确认并进入个人中心"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordContent />
    </Suspense>
  );
}
