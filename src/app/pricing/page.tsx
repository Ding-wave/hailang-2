"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);

  const handleSubscribe = async () => {
    setSubscribing(true);
    setMessage(null);
    setQrCodeUrl(null);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/auth/login?redirectTo=/pricing");
        return;
      }

      const preferWap =
        typeof navigator !== "undefined" &&
        /Android|iPhone|iPad|iPod|Mobile|HarmonyOS|Windows Phone/i.test(
          navigator.userAgent
        );

      const response = await fetch("/api/payment/alipay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          planId: selected,
          preferWap,
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (response.status === 401) {
        router.push("/auth/login?redirectTo=/pricing");
        return;
      }
      if (!response.ok) {
        throw new Error(data?.error ?? "订阅失败");
      }

      if (data?.type === "qrcode" && typeof data?.url === "string") {
        setQrCodeUrl(data.url);
        setMessage("请使用支付宝扫码完成支付");
        return;
      }

      const paymentPayload =
        typeof data?.url === "string"
          ? data.url
          : typeof data?.data === "string"
            ? data.data
            : null;
      if (!paymentPayload) {
        throw new Error("支付链接生成失败");
      }

      setMessage("正在跳转到支付宝支付页面...");

      if (paymentPayload.includes("<form")) {
        const div = document.createElement("div");
        div.innerHTML = paymentPayload;
        document.body.appendChild(div);

        const forms = div.getElementsByTagName("form");
        if (forms.length > 0) {
          forms[0].submit();
          return;
        }
      }

      window.location.href = paymentPayload;
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
          {qrCodeUrl && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center px-4"
              style={{ background: "rgba(0, 0, 0, 0.5)" }}
            >
              <div
                className="w-full max-w-sm rounded-2xl p-5"
                style={{ background: "var(--background)", border: "1px solid var(--card-border)" }}
              >
                <p className="text-center text-[15px] font-bold mb-4" style={{ color: "var(--foreground)" }}>
                  支付宝扫码支付
                </p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(qrCodeUrl)}`}
                  alt="支付宝支付二维码"
                  className="w-56 h-56 mx-auto rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => setQrCodeUrl(null)}
                  className="mt-4 w-full py-2.5 rounded-xl text-[13px] font-semibold"
                  style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", color: "var(--foreground)" }}
                >
                  关闭
                </button>
              </div>
            </div>
          )}
          <p className="text-center text-[11px] mt-3" style={{ color: "var(--muted)" }}>
            本平台内容仅供参考，不构成任何投资建议
          </p>
        </div>
      </div>
    </div>
  );
}
