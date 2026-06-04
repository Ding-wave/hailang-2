import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { signOutIfProfileMissing } from "@/lib/supabase/profile-guard";

function buildSuccessRedirect(origin: string, next: string, isRecovery: boolean) {
  const url = new URL(next, origin);
  if (isRecovery) {
    url.searchParams.set("type", "recovery");
  }
  return url.toString();
}

function isPasswordRecoveryRequest(searchParams: URLSearchParams, next: string) {
  return (
    searchParams.get("recovery") === "1" ||
    searchParams.get("type") === "recovery" ||
    next === "/" ||
    next === ""
  );
}

/** 重置密码不在服务端兑换 code，避免手机邮件客户端预取链接导致一次性 token 失效 */
function redirectRecoveryToClient(origin: string, searchParams: URLSearchParams) {
  const target = new URL("/reset-password", origin);
  for (const key of ["code", "token_hash", "type"] as const) {
    const value = searchParams.get(key);
    if (value) target.searchParams.set(key, value);
  }
  return NextResponse.redirect(target.toString());
}

export async function GET(request: Request) {
  try {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get("code");
    const tokenHash = searchParams.get("token_hash");
    const next = searchParams.get("next") ?? "/dashboard";
    const isRecovery = isPasswordRecoveryRequest(searchParams, next);

    if (isRecovery && (code || tokenHash)) {
      return redirectRecoveryToClient(origin, searchParams);
    }

    if (code) {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!error && user) {
        if (await signOutIfProfileMissing(supabase, user.id)) {
          return NextResponse.redirect(
            `${origin}/auth/login?error=account_removed`
          );
        }
        return NextResponse.redirect(
          buildSuccessRedirect(origin, next, isRecovery)
        );
      }

      // code 已失效但 session 仍在（例如重复点击链接）时仍允许进入重置流程
      if (user) {
        return NextResponse.redirect(
          buildSuccessRedirect(origin, next, isRecovery)
        );
      }
    }

    return NextResponse.redirect(`${origin}/auth/auth-error`);
  } catch {
    const origin = new URL(request.url).origin;
    return NextResponse.redirect(`${origin}/auth/auth-error`);
  }
}
