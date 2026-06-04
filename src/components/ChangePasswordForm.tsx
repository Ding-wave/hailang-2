"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PASSWORD_RECOVERY_STORAGE_KEY } from "@/components/PasswordRecoveryHandler";

const MIN_PASSWORD_LENGTH = 6;

function scrollToChangePasswordSection() {
  const element = document.getElementById("change-password-section");
  if (element) {
    element.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

export default function ChangePasswordForm() {
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const openForPasswordRecovery = useCallback(() => {
    setIsOpen(true);
    requestAnimationFrame(() => scrollToChangePasswordSection());
    window.setTimeout(() => {
      document.getElementById("new-password-input")?.focus({ preventScroll: true });
    }, 80);
  }, []);

  useEffect(() => {
    const fromQuery =
      searchParams.get("recovery") === "1" ||
      searchParams.get("type") === "recovery";
    let fromStorage = false;
    try {
      fromStorage = sessionStorage.getItem(PASSWORD_RECOVERY_STORAGE_KEY) === "1";
    } catch {
      /* ignore */
    }

    if (fromQuery || fromStorage) {
      openForPasswordRecovery();
      try {
        sessionStorage.removeItem(PASSWORD_RECOVERY_STORAGE_KEY);
      } catch {
        /* ignore */
      }
    }
  }, [searchParams, openForPasswordRecovery]);

  useEffect(() => {
    const onRecovery = () => openForPasswordRecovery();
    window.addEventListener("password-recovery", onRecovery);

    let supabase;
    try {
      supabase = createClient();
    } catch {
      return () => window.removeEventListener("password-recovery", onRecovery);
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        openForPasswordRecovery();
      }
    });

    return () => {
      window.removeEventListener("password-recovery", onRecovery);
      subscription.unsubscribe();
    };
  }, [openForPasswordRecovery]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    setError(null);
    setSuccess(false);

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`新密码至少 ${MIN_PASSWORD_LENGTH} 个字符`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("两次输入的密码不一致");
      return;
    }

    setIsLoading(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      setNewPassword("");
      setConfirmPassword("");
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "修改密码失败，请稍后重试");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="w-full py-2.5 rounded-xl text-[13px] font-semibold transition-opacity hover:opacity-90"
        style={{
          background: "var(--background)",
          border: "1px solid var(--card-border)",
          color: "var(--foreground)",
        }}
      >
        修改密码
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && (
        <p className="text-[12px] px-3 py-2 rounded-lg" style={{ background: "#FEF3F2", color: "#B42318" }}>
          {error}
        </p>
      )}
      {success && (
        <p className="text-[12px] px-3 py-2 rounded-lg" style={{ background: "#ECFDF3", color: "#027A48" }}>
          密码已更新
        </p>
      )}
      <input
        id="new-password-input"
        type="password"
        required
        autoComplete="new-password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
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
        className="w-full py-2.5 rounded-xl text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ background: "var(--gold)" }}
      >
        {isLoading ? "保存中…" : "保存新密码"}
      </button>
    </form>
  );
}
