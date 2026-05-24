import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      plan?: "monthly" | "yearly";
    };
    const plan = body.plan === "yearly" ? "yearly" : "monthly";
    const months = plan === "yearly" ? 12 : 1;

    const subscriptionEndAt = new Date();
    subscriptionEndAt.setMonth(subscriptionEndAt.getMonth() + months);

    const { error } = await supabase
      .from("profiles")
      .update({
        subscription_status: "active",
        subscription_end_at: subscriptionEndAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({
      success: true,
      subscription_status: "active",
      subscription_end_at: subscriptionEndAt.toISOString(),
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "UNKNOWN_ERROR" },
      { status: 500 }
    );
  }
}
