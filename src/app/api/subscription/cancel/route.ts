import { createClient } from "@/lib/supabase/server";
import { chinaIso } from "@/lib/datetime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function setCancelAtPeriodEnd(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
) {
  const nowIso = chinaIso();

  const { error } = await supabase
    .from("profiles")
    .update({
      cancel_at_period_end: true,
      updated_at: nowIso,
    })
    .eq("id", userId);

  if (!error) return;

  const { error: fallbackError } = await supabase
    .from("profiles")
    .update({
      updated_at: nowIso,
    })
    .eq("id", userId);

  if (fallbackError) {
    throw new Error(
      `cancel subscription failed: ${error.message}; fallback: ${fallbackError.message}`
    );
  }
}

export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    await setCancelAtPeriodEnd(supabase, user.id);

    return Response.json({
      success: true,
      cancel_at_period_end: true,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "UNKNOWN_ERROR" },
      { status: 500 }
    );
  }
}
