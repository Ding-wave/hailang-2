"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CancelSubscriptionButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  return (
    <button
      type="button"
      disabled={loading}
      className="mt-3 w-full py-2.5 rounded-xl text-[13px] font-semibold border transition-opacity hover:opacity-90 disabled:opacity-60"
      style={{ borderColor: "var(--gold)", color: "var(--gold)" }}
      onClick={async () => {
        const ok = window.confirm("确认取消自动续费？当前周期结束前会员权益不受影响。");
        if (!ok) return;

        setLoading(true);
        try {
          const res = await fetch("/api/subscription/cancel", {
            method: "POST",
          });

          if (!res.ok) {
            const data = (await res.json().catch(() => ({}))) as { error?: string };
            window.alert(data.error ?? "取消订阅失败，请稍后重试");
            return;
          }

          window.alert("已取消自动续费，当前周期内仍可继续使用会员权限。");
          router.refresh();
        } finally {
          setLoading(false);
        }
      }}
    >
      {loading ? "处理中..." : "取消自动续费"}
    </button>
  );
}
