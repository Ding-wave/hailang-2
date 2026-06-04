import type { SupabaseClient } from "@supabase/supabase-js";

export async function profileExistsForUser(
  supabase: SupabaseClient,
  userId: string
) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("profileExistsForUser:", error.message);
    return false;
  }

  return Boolean(data?.id);
}

export async function signOutIfProfileMissing(
  supabase: SupabaseClient,
  userId: string
) {
  const exists = await profileExistsForUser(supabase, userId);
  if (exists) return false;
  await supabase.auth.signOut();
  return true;
}
