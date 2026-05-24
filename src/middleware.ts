import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect cron endpoint with secret header before touching Supabase.
  if (pathname.startsWith("/api/cron/")) {
    const expectedSecret = process.env.CRON_SECRET;
    if (!expectedSecret) {
      return NextResponse.json(
        { error: "CRON_SECRET is not configured on the server." },
        { status: 500 }
      );
    }

    const xCronSecret = request.headers.get("x-cron-secret");
    const authHeader = request.headers.get("authorization");
    const authorized =
      xCronSecret === expectedSecret ||
      authHeader === `Bearer ${expectedSecret}`;

    if (!authorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.next();
  }

  const { supabaseResponse, user, supabase } = await updateSession(request);

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

  // Protect /articles/[id] — must be premium
  if (pathname.startsWith("/articles/")) {
    if (!user) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/auth/login";
      loginUrl.searchParams.set("redirectTo", pathname);
      return NextResponse.redirect(loginUrl);
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_premium")
      .eq("id", user.id)
      .single();

    if (!profile?.is_premium) {
      const upgradeUrl = request.nextUrl.clone();
      upgradeUrl.pathname = "/dashboard";
      upgradeUrl.searchParams.set("upgrade", "1");
      return NextResponse.redirect(upgradeUrl);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
