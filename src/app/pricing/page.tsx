"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Plan = "monthly" | "yearly";

const BENEFITS = [
  "中文翻译新闻标题",
  "AI 深度市场分析",
  "股票、期货、大宗商品影响",
  "投资提示和风险提示",
];

function CheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
      <path d="M2.5 7.5L6 11L12.5 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CircleCheck() {
  return (
    <span
      className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
      style={{ background: "var(--gold)" }}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export default function PricingPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<Plan>("monthly");
  const [subscribing, setSubscribing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubscribe = async () => {
    setSubscribing(true);
    setMessage(null);

    try {
      const response = await fetch("/api/subscription/mock-activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: selected }),
      });
      const data = await response.json().catch(() => ({}));

      if (response.status === 401) {
        router.push("/auth/login?redirectTo=/pricing");
        return;
      }
      if (!response.ok) {
        throw new Error(data?.error ?? "订阅失败");
      }

      setMessage("订阅成功，已为你开通会员权限。");
      router.push("/");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "订阅失败");
    } finally {
      setSubscribing(false);
    }
  };

  return (
    <div className="min-h-screen pb-36" style={{ background: "var(--background)" }}>
      <div className="max-w-lg mx-auto px-4 py-10">

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--foreground)" }}>
            选择您的计划
          </h1>
          <p className="text-[13px]" style={{ color: "var(--muted)" }}>
            解锁 AI 深度市场分析和投资提示
          </p>
        </div>

        {/* Plan cards */}
        <div className="space-y-4 mb-8">

          {/* Monthly */}
          <button
            onClick={() => setSelected("monthly")}
            className="w-full text-left rounded-2xl p-5 transition-all"
            style={{
              background: "var(--card-bg)",
              border: selected === "monthly" ? "2px solid var(--gold)" : "1px solid var(--card-border)",
            }}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[15px] font-bold mb-2" style={{ color: "var(--foreground)" }}>
                  月付计划
                </p>
                <div className="flex items-end gap-1">
                  <span className="text-3xl font-bold" style={{ color: "var(--gold)" }}>¥29</span>
                  <span className="text-[13px] mb-1" style={{ color: "var(--muted)" }}>/月</span>
                </div>
                <p className="text-[12px] mt-1" style={{ color: "var(--muted)" }}>
                  按月支付，随时取消
                </p>
              </div>
              {selected === "monthly" && <CircleCheck />}
            </div>
          </button>

          {/* Yearly — with badge */}
          <div className="relative">
            <button
              onClick={() => setSelected("yearly")}
              className="w-full text-left rounded-2xl p-5 transition-all"
              style={{
                background: "var(--card-bg)",
                border: selected === "yearly" ? "2px solid var(--gold)" : "1px solid var(--card-border)",
              }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[15px] font-bold mb-2" style={{ color: "var(--foreground)" }}>
                    年付计划
                  </p>
                  <div className="flex items-end gap-1">
                    <span className="text-3xl font-bold" style={{ color: "var(--gold)" }}>¥19</span>
                    <span className="text-[13px] mb-1" style={{ color: "var(--muted)" }}>/月</span>
                  </div>
                  <p className="text-[12px] mt-1" style={{ color: "var(--muted)" }}>
                    ¥228/年，节省 ¥120
                  </p>
                  <p className="text-[12px] font-semibold mt-0.5" style={{ color: "var(--gold)" }}>
                    节省 35%
                  </p>
                </div>
                {selected === "yearly" && <CircleCheck />}
              </div>
            </button>
            {/* Badge */}
            <span
              className="absolute -top-3 left-1/2 -translate-x-1/2 text-[11px] font-bold px-3 py-0.5 rounded-full text-white"
              style={{ background: "var(--gold)" }}
            >
              最划算
            </span>
          </div>
        </div>

        {/* Benefits */}
        <div className="mb-8">
          <p className="text-[14px] font-bold mb-4" style={{ color: "var(--foreground)" }}>
            会员权益
          </p>
          <ul className="space-y-3">
            {BENEFITS.map((b) => (
              <li key={b} className="flex items-center gap-2.5 text-[14px]" style={{ color: "var(--foreground)" }}>
                <span style={{ color: "var(--gold)" }}><CheckIcon /></span>
                {b}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Fixed bottom CTA */}
      <div
        className="fixed bottom-0 left-0 right-0 px-4 pb-6 pt-3"
        style={{ background: "var(--background)", borderTop: "1px solid var(--card-border)" }}
      >
        <div className="max-w-lg mx-auto">
          <button
            type="button"
            disabled={subscribing}
            onClick={handleSubscribe}
            className="block w-full py-4 rounded-2xl text-center text-[16px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ background: "var(--gold)" }}
          >
            {selected === "monthly" ? "订阅月付计划 · ¥29/月" : "订阅年付计划 · ¥228/年"}
          </button>
          {message && (
            <p className="text-center text-[11px] mt-2" style={{ color: "var(--muted)" }}>
              {message}
            </p>
          )}
          <p className="text-center text-[11px] mt-3" style={{ color: "var(--muted)" }}>
            本平台内容仅供参考，不构成任何投资建议
          </p>
        </div>
      </div>
    </div>
  );
}
