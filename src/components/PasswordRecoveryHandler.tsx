"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export const PASSWORD_RECOVERY_STORAGE_KEY = "password_recovery_pending";

function markPasswordRecoveryPending() {
  try {
    sessionStorage.setItem(PASSWORD_RECOVERY_STORAGE_KEY, "1");
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent("password-recovery"));
}

const RECOVERY_SELF_SERVICE_PATHS = ["/reset-password", "/forgot-password", "/auth/auth-error"];

function isRecoverySelfServicePath(pathname: string) {
  return RECOVERY_SELF_SERVICE_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

/** 邮件重置密码回流：/reset-password 自行验证；已登录且带 recovery 时跳转个人中心改密 */
export default function PasswordRecoveryHandler() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const handledRef = useRef(false);

  useEffect(() => {
    if (isRecoverySelfServicePath(pathname)) {
      return;
    }

    let supabase;
    try {
      supabase = createClient();
    } catch {
      return;
    }

    const goToDashboardForRecovery = () => {
      markPasswordRecoveryPending();
      if (pathname !== "/dashboard") {
        router.push("/dashboard?type=recovery");
      }
    };

    const handleRecovery = () => {
      if (handledRef.current) return;
      handledRef.current = true;
      goToDashboardForRecovery();
    };

    const routeRecoveryFromQuery = async () => {
      const hasRecoveryQuery =
        searchParams.get("type") === "recovery" ||
        searchParams.has("token_hash") ||
        searchParams.has("code");
      if (!hasRecoveryQuery) return;

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        handleRecovery();
        return;
      }

      const qs = searchParams.toString();
      router.replace(qs ? `/reset-password?${qs}` : "/reset-password");
    };

    void routeRecoveryFromQuery();

    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    if (hashParams.get("type") === "recovery") {
      void supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) handleRecovery();
        else router.replace("/reset-password");
      });
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" && !isRecoverySelfServicePath(pathname)) {
        handleRecovery();
      }
    });

    return () => subscription.unsubscribe();
  }, [pathname, router, searchParams]);

  return null;
}
