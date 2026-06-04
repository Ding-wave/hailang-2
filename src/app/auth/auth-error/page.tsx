import Link from "next/link";

export default function AuthErrorPage() {
  return (
    <div
      className="min-h-[85vh] flex flex-col items-center justify-center px-4 py-12"
      style={{ background: "var(--background)" }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-7 text-center"
        style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}
      >
        <h1 className="text-xl font-bold mb-2" style={{ color: "var(--foreground)" }}>
          登录链接无效
        </h1>
        <p className="text-[13px] mb-6" style={{ color: "var(--muted)" }}>
          链接已过期或已被使用，请重新申请重置密码或登录。
        </p>
        <div className="flex flex-col gap-2">
          <Link
            href="/forgot-password"
            className="w-full py-3 rounded-xl font-semibold text-[14px] text-white"
            style={{ background: "var(--gold)" }}
          >
            重新申请重置密码
          </Link>
          <Link
            href="/auth/login"
            className="text-[13px] font-semibold hover:underline"
            style={{ color: "var(--gold)" }}
          >
            返回登录
          </Link>
        </div>
      </div>
    </div>
  );
}
