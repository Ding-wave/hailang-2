import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

function Avatar({ email }: { email: string }) {
  const initial = email.charAt(0).toUpperCase();
  return (
    <div
      className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold text-white shrink-0"
      style={{ background: "var(--gold)" }}
    >
      {initial}
    </div>
  );
}

const MOCK_PAYMENTS = [
  { amount: 29, date: "2026/05/12", status: "待支付" },
  { amount: 29, date: "2026/05/12", status: "待支付" },
];

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ upgrade?: string }>;
}) {
  const supabase = await createClient();
  const params = await searchParams;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?redirectTo=/dashboard");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_premium, subscription_end, created_at")
    .eq("id", user.id)
    .single();

  const regDate = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("zh-CN", {
        year: "numeric", month: "2-digit", day: "2-digit",
      }).replace(/\//g, "/")
    : "—";

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">

        {/* 跳转提示 */}
        {params.upgrade && (
          <div
            className="rounded-2xl p-4 flex items-center justify-between gap-3"
            style={{ background: "var(--gold-light)", border: "1px solid var(--gold)" }}
          >
            <p className="text-[13px] font-medium" style={{ color: "var(--gold)" }}>
              阅读完整文章需要会员权限
            </p>
            <Link
              href="/pricing"
              className="shrink-0 text-[12px] font-bold px-3 py-1.5 rounded-xl text-white"
              style={{ background: "var(--gold)" }}
            >
              立即订阅
            </Link>
          </div>
        )}

        {/* 用户信息卡 */}
        <div
          className="rounded-2xl p-5 flex items-center gap-4"
          style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}
        >
          <Avatar email={user.email ?? "U"} />
          <div className="min-w-0">
            <p className="text-[15px] font-semibold truncate" style={{ color: "var(--foreground)" }}>
              {user.email}
            </p>
            <p className="text-[12px] mt-0.5" style={{ color: "var(--muted)" }}>
              注册时间：{regDate}
            </p>
          </div>
        </div>

        {/* 订阅状态 */}
        <div>
          <p className="text-[14px] font-bold mb-3" style={{ color: "var(--foreground)" }}>
            订阅状态
          </p>
          <div
            className="rounded-2xl p-5"
            style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}
          >
            {profile?.is_premium ? (
              <div className="flex items-center justify-between">
                <div>
                  <p
                    className="text-[13px] font-bold mb-1"
                    style={{ color: "var(--gold)" }}
                  >
                    ✓ 高级会员
                  </p>
                  {profile.subscription_end && (
                    <p className="text-[12px]" style={{ color: "var(--muted)" }}>
                      到期：{new Date(profile.subscription_end).toLocaleDateString("zh-CN")}
                    </p>
                  )}
                </div>
                <span
                  className="text-[11px] font-bold px-3 py-1 rounded-full text-white"
                  style={{ background: "var(--gold)" }}
                >
                  已订阅
                </span>
              </div>
            ) : (
              <>
                <p className="text-[13px] mb-4" style={{ color: "var(--muted)" }}>
                  当前未订阅
                </p>
                <Link
                  href="/pricing"
                  className="block w-full py-3 rounded-xl text-center text-[14px] font-bold text-white transition-opacity hover:opacity-90"
                  style={{ background: "var(--gold)" }}
                >
                  立即订阅
                </Link>
              </>
            )}
          </div>
        </div>

        {/* 微信通知 */}
        <div>
          <p className="text-[14px] font-bold mb-3" style={{ color: "var(--foreground)" }}>
            微信通知
          </p>
          <div
            className="rounded-2xl p-5"
            style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}
          >
            <div className="flex items-center gap-3 mb-4">
              {/* WeChat icon */}
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                style={{ background: "#07C160" }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                  <path d="M9.5 4C5.36 4 2 6.92 2 10.5c0 2.02 1.07 3.82 2.75 5.02L4 18l2.5-1.25C7.26 17.56 8.35 17.75 9.5 17.75c.28 0 .55-.01.82-.04A6.23 6.23 0 0 1 10 15.5c0-3.31 2.91-6 6.5-6 .29 0 .58.02.86.05C16.57 6.62 13.33 4 9.5 4zm-2 4.5a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm4 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm5 3c-2.76 0-5 1.79-5 4s2.24 4 5 4c.7 0 1.37-.13 1.97-.36L20 20.5l-.62-2.08C20.4 17.56 21.5 16.34 21.5 15c0-2.21-2.24-4-5-4zm-1.75 2.75a.75.75 0 1 1 0 1.5.75.75 0 0 1 0-1.5zm3.5 0a.75.75 0 1 1 0 1.5.75.75 0 0 1 0-1.5z" />
                </svg>
              </div>
              <div>
                <p className="text-[14px] font-semibold" style={{ color: "var(--foreground)" }}>
                  绑定微信账号
                </p>
                <p className="text-[12px]" style={{ color: "var(--muted)" }}>
                  接收新文章推送通知
                </p>
              </div>
            </div>
            <button
              className="w-full py-3 rounded-xl text-center text-[14px] font-bold text-white transition-opacity hover:opacity-90"
              style={{ background: "#07C160" }}
            >
              绑定微信
            </button>
          </div>
        </div>

        {/* 支付记录 */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[14px] font-bold" style={{ color: "var(--foreground)" }}>
              支付记录
            </p>
            <button className="text-[13px]" style={{ color: "var(--gold)" }}>
              收起
            </button>
          </div>
          <div
            className="rounded-2xl overflow-hidden"
            style={{ border: "1px solid var(--card-border)" }}
          >
            {MOCK_PAYMENTS.map((p, i) => (
              <div
                key={i}
                className="px-5 py-4 flex items-center justify-between"
                style={{
                  background: i % 2 === 0 ? "var(--card-bg)" : "var(--background)",
                  borderBottom: i < MOCK_PAYMENTS.length - 1 ? "1px solid var(--card-border)" : "none",
                }}
              >
                <div>
                  <p className="text-[14px] font-semibold" style={{ color: "var(--foreground)" }}>
                    {p.amount} 元
                  </p>
                  <p className="text-[12px] mt-0.5" style={{ color: "var(--muted)" }}>
                    {p.date}
                  </p>
                </div>
                <span
                  className="text-[12px] font-semibold px-3 py-1 rounded-full"
                  style={{ background: "var(--gold-light)", color: "var(--gold)", border: "1px solid var(--gold)" }}
                >
                  {p.status}
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
