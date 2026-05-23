"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useMemo, useState } from "react";
// router only used for signOut and drawer close — not in auth subscription
import type { User } from "@supabase/supabase-js";

function WaveLogo() {
  return (
    <span className="inline-flex items-end gap-[3px]" aria-hidden>
      {[10, 16, 13, 8].map((h, i) => (
        <span
          key={i}
          className="rounded-full w-[3px]"
          style={{ height: h, background: "var(--gold)" }}
        />
      ))}
    </span>
  );
}

function Avatar({ email }: { email: string }) {
  const initial = email.charAt(0).toUpperCase();
  return (
    <div
      className="w-9 h-9 rounded-full flex items-center justify-center text-[15px] font-bold text-white shrink-0 cursor-pointer"
      style={{ background: "var(--gold)" }}
    >
      {initial}
    </div>
  );
}

const NAV_LINKS = [
  { href: "/", label: "首页" },
  { href: "/pricing", label: "订阅方案" },
  { href: "/dashboard", label: "个人中心" },
];

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => listener.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  // close drawer on route change
  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setDrawerOpen(false);
    router.push("/");
    router.refresh();
  };

  return (
    <>
      {/* ── Top bar ── */}
      <nav
        className="sticky top-0 z-40"
        style={{ background: "var(--background)", borderBottom: "1px solid var(--card-border)" }}
      >
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          {/* Hamburger */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="w-9 h-9 flex flex-col items-center justify-center gap-[5px] rounded-lg transition-opacity hover:opacity-70"
            aria-label="打开菜单"
          >
            <span className="w-5 h-[2px] rounded-full" style={{ background: "var(--foreground)" }} />
            <span className="w-5 h-[2px] rounded-full" style={{ background: "var(--foreground)" }} />
            <span className="w-5 h-[2px] rounded-full" style={{ background: "var(--foreground)" }} />
          </button>

          {/* Logo — center */}
          <Link href="/" className="flex items-center gap-2 absolute left-1/2 -translate-x-1/2">
            <WaveLogo />
            <span className="text-[17px] font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
              海浪资讯
            </span>
          </Link>

          {/* Right — avatar or login */}
          {user ? (
            <button onClick={() => setDrawerOpen(true)}>
              <Avatar email={user.email ?? "U"} />
            </button>
          ) : (
            <Link
              href="/auth/login"
              className="text-[13px] font-semibold transition-opacity hover:opacity-70"
              style={{ color: "var(--gold)" }}
            >
              登录
            </Link>
          )}
        </div>
      </nav>

      {/* ── Drawer overlay ── */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-50"
          onClick={() => setDrawerOpen(false)}
          style={{ background: "rgba(0,0,0,0.35)" }}
        />
      )}

      {/* ── Drawer panel (slides in from left) ── */}
      <div
        className="fixed top-0 left-0 h-full z-50 flex flex-col transition-transform duration-300 ease-out"
        style={{
          width: 240,
          background: "var(--background)",
          borderRight: "1px solid var(--card-border)",
          transform: drawerOpen ? "translateX(0)" : "translateX(-100%)",
        }}
      >
        {/* Drawer header */}
        <div
          className="flex items-center gap-3 px-5 py-5"
          style={{ borderBottom: "1px solid var(--card-border)" }}
        >
          {user ? (
            <>
              <Avatar email={user.email ?? "U"} />
              <div className="min-w-0">
                <p className="text-[13px] font-semibold truncate" style={{ color: "var(--foreground)" }}>
                  {user.email?.split("@")[0]}
                </p>
                <p className="text-[11px]" style={{ color: "var(--muted)" }}>
                  {user.email}
                </p>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <WaveLogo />
              <span className="text-[16px] font-bold" style={{ color: "var(--foreground)" }}>
                海浪资讯
              </span>
            </div>
          )}
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center px-4 py-3 rounded-xl text-[15px] font-medium transition-colors"
              style={{
                color: pathname === href ? "var(--gold)" : "var(--foreground)",
                background: pathname === href ? "var(--gold-light)" : "transparent",
              }}
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Bottom actions */}
        <div className="px-3 pb-8 space-y-1">
          {user ? (
            <button
              onClick={handleSignOut}
              className="flex items-center w-full px-4 py-3 rounded-xl text-[15px] font-medium transition-colors hover:opacity-80"
              style={{ color: "#EF4444" }}
            >
              退出登录
            </button>
          ) : (
            <>
              <Link
                href="/auth/login"
                className="flex items-center w-full px-4 py-3 rounded-xl text-[15px] font-medium"
                style={{ color: "var(--gold)" }}
              >
                登录
              </Link>
              <Link
                href="/auth/register"
                className="flex items-center justify-center w-full px-4 py-3 rounded-xl text-[15px] font-bold text-white transition-opacity hover:opacity-90"
                style={{ background: "var(--gold)" }}
              >
                免费注册
              </Link>
            </>
          )}
        </div>
      </div>
    </>
  );
}
