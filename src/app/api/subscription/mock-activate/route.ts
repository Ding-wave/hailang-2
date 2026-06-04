import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  // Keep auth read so unauthenticated requests still get consistent status.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  return Response.json(
    {
      error:
        "MOCK_ACTIVATE_DISABLED. Subscription status can only be updated by /api/payment/webhook after successful Alipay payment.",
    },
    { status: 410 }
  );
}
