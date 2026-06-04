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

/** 邮件重置密码回流：会话在 /reset-password 客户端兑换；此处监听事件与 ?type=recovery */
export default function PasswordRecoveryHandler() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const handledRef = useRef(false);

  useEffect(() => {
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

    if (searchParams.get("type") === "recovery") {
      handleRecovery();
    }

    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    if (hashParams.get("type") === "recovery") {
      handleRecovery();
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        handleRecovery();
      }
    });

    return () => subscription.unsubscribe();
  }, [pathname, router, searchParams]);

  return null;
}
