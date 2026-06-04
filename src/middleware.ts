import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { signOutIfProfileMissing } from "@/lib/supabase/profile-guard";

function isPasswordRecoveryCallback(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  if (searchParams.has("code")) return true;
  if (searchParams.get("type") === "recovery") return true;
  if (searchParams.has("token_hash")) return true;
  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  let { supabaseResponse, user, supabase } = await updateSession(request);
  const recoveryCallback = isPasswordRecoveryCallback(request);

  // PKCE code 只能兑换一次：/auth/callback 与 /reset-password 由各自路由/页面处理
  const codeHandledElsewhere =
    pathname === "/auth/callback" || pathname === "/reset-password";

  if (recoveryCallback && !codeHandledElsewhere) {
    const code = request.nextUrl.searchParams.get("code");
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        const {
          data: { user: refreshedUser },
        } = await supabase.auth.getUser();
        if (refreshedUser) user = refreshedUser;
      }
    }
  }

  if (user && pathname.startsWith("/dashboard")) {
    const signedOut = await signOutIfProfileMissing(supabase, user.id);
    if (signedOut) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/auth/login";
      loginUrl.searchParams.set("error", "account_removed");
      const redirect = NextResponse.redirect(loginUrl);
      for (const cookie of supabaseResponse.cookies.getAll()) {
        redirect.cookies.set(cookie);
      }
      return redirect;
    }
  }

  // 邮件链接若落到首页，转去 /reset-password 保留 token，避免未登录被送去登录页
  if (recoveryCallback && pathname === "/") {
    const resetUrl = request.nextUrl.clone();
    resetUrl.pathname = "/reset-password";
    const redirect = NextResponse.redirect(resetUrl);
    for (const cookie of supabaseResponse.cookies.getAll()) {
      redirect.cookies.set(cookie);
    }
    return redirect;
  }

  // 重置密码邮件回流：带 code/token 时先放行，由客户端完成会话并跳转个人中心
  if (recoveryCallback && pathname.startsWith("/dashboard")) {
    if (user) {
      const dashboardUrl = request.nextUrl.clone();
      dashboardUrl.pathname = "/dashboard";
      dashboardUrl.searchParams.delete("code");
      dashboardUrl.searchParams.delete("type");
      dashboardUrl.searchParams.delete("token_hash");
      dashboardUrl.searchParams.set("recovery", "1");
      const redirect = NextResponse.redirect(dashboardUrl);
      for (const cookie of supabaseResponse.cookies.getAll()) {
        redirect.cookies.set(cookie);
      }
      return redirect;
    }
    return supabaseResponse;
  }

  // Protect homepage news feed — must be logged in
  if (pathname === "/" && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/auth/login";
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Protect /dashboard — must be logged in
  if (pathname.startsWith("/dashboard") && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/auth/login";
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Protect /articles/[id] — must be logged in
  if (pathname.startsWith("/articles/")) {
    if (!user) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/auth/login";
      loginUrl.searchParams.set("redirectTo", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot|css|js)$).*)",
  ],
};
