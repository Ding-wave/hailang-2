import { createClient } from "@supabase/supabase-js";

interface EnsureProfileInput {
  id: string;
  email?: string | null;
}

function getAdminEnv() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;
  return { supabaseUrl, serviceRoleKey };
}

export async function ensureProfileExists(user: EnsureProfileInput) {
  const env = getAdminEnv();
  if (!env) return;

  const admin = createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error } = await admin.from("profiles").upsert(
    {
      id: user.id,
      email: user.email ?? null,
    },
    { onConflict: "id" }
  );

  if (error) {
    console.error("ensureProfileExists failed:", error.message);
  }
}
