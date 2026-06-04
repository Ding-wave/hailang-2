import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 200;
const MAX_PAGES = 25;

function getAdminEnv() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return { supabaseUrl, serviceRoleKey };
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { email?: string };
    const email = body.email?.trim().toLowerCase() ?? "";

    if (!email || !isValidEmail(email)) {
      return Response.json({ error: "INVALID_EMAIL" }, { status: 400 });
    }

    const env = getAdminEnv();
    if (!env) {
      return Response.json({ error: "ADMIN_ENV_MISSING" }, { status: 501 });
    }

    const admin = createClient(env.supabaseUrl, env.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const { data, error } = await admin.auth.admin.listUsers({
        page,
        perPage: PAGE_SIZE,
      });

      if (error) {
        return Response.json({ error: error.message }, { status: 500 });
      }

      const users = data.users ?? [];
      if (
        users.some((user) => user.email?.trim().toLowerCase() === email)
      ) {
        return Response.json({ exists: true });
      }

      if (users.length < PAGE_SIZE) {
        break;
      }
    }

    return Response.json({ exists: false });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "UNKNOWN_ERROR" },
      { status: 500 }
    );
  }
}
