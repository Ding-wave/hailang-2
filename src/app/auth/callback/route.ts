import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureProfileExists } from "@/lib/supabase/ensure-profile";

export async function GET(request: Request) {
  try {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get("code");
    const next = searchParams.get("next") ?? "/dashboard";

    if (code) {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          await ensureProfileExists({ id: user.id, email: user.email });
        }
        return NextResponse.redirect(`${origin}${next}`);
      }
    }

    return NextResponse.redirect(`${origin}/auth/login?error=auth_callback_failed`);
  } catch (err) {
    const origin = new URL(request.url).origin;
    const message = err instanceof Error ? err.message : "auth_callback_failed";
    return NextResponse.redirect(
      `${origin}/auth/login?error=${encodeURIComponent(message)}`
    );
  }
}
