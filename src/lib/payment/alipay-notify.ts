import { createClient } from "@supabase/supabase-js";
import { verifyAlipayNotify } from "@/lib/payment/alipay-client";
import { addDays, chinaIso } from "@/lib/datetime";

export function createSupabaseAdmin() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing SUPABASE admin env");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function parseFormBody(rawBody: string) {
  const params = new URLSearchParams(rawBody);
  const payload: Record<string, string> = {};
  for (const [key, value] of params.entries()) {
    payload[key] = value;
  }
  return payload;
}

function parsePassback(payload: Record<string, string>) {
  const raw = payload.passback_params ?? payload.passbackParams;
  if (!raw) return {};

  try {
    const decoded = decodeURIComponent(raw);
    if (decoded.includes("=")) {
      const params = new URLSearchParams(decoded);
      const userId = params.get("userId") ?? undefined;
      const planRaw = params.get("planId");
      const planId =
        planRaw === "yearly" || planRaw === "monthly" ? planRaw : undefined;
      return { userId, planId };
    }
    const data = JSON.parse(decoded) as { userId?: string; planId?: string };
    const planId =
      data.planId === "yearly" || data.planId === "monthly"
        ? data.planId
        : undefined;
    return { userId: data.userId, planId };
  } catch {
    return {};
  }
}

function parseFromOutTradeNo(outTradeNo?: string) {
  if (!outTradeNo) return {};
  const parts = outTradeNo.split("_");
  if (parts.length < 3) return {};

  const planRaw = parts.at(-2);
  const userId = parts.slice(0, -2).join("_");
  const planId =
    planRaw === "monthly" || planRaw === "yearly" ? planRaw : undefined;

  if (!userId || !planId) return {};
  return { userId, planId };
}


async function resolveOrderIdentity(
  admin: ReturnType<typeof createSupabaseAdmin>,
  outTradeNo: string,
  payload: Record<string, string>
) {
  const { data: order } = await admin
    .from("orders")
    .select("user_id, plan_id")
    .eq("out_trade_no", outTradeNo)
    .maybeSingle();

  if (order?.user_id && order?.plan_id) {
    const planId =
      order.plan_id === "yearly" || order.plan_id === "monthly"
        ? order.plan_id
        : undefined;
    if (planId) {
      return { userId: order.user_id as string, planId };
    }
  }

  const fromPassback = parsePassback(payload);
  const fromTradeNo = parseFromOutTradeNo(outTradeNo);
  return {
    userId: fromPassback.userId ?? fromTradeNo.userId,
    planId: fromPassback.planId ?? fromTradeNo.planId,
  };
}

async function updateProfileSubscribed(params: {
  admin: ReturnType<typeof createSupabaseAdmin>;
  userId: string;
  startAtIso: string;
  endAtIso: string;
}) {
  const fullPayload = {
    id: params.userId,
    is_subscribed: true,
    subscription_start: params.startAtIso,
    subscription_end: params.endAtIso,
    cancel_at_period_end: false,
    subscription_status: "active",
    subscription_end_at: params.endAtIso,
    updated_at: params.startAtIso,
  };

  const { error } = await params.admin
    .from("profiles")
    .upsert(fullPayload, { onConflict: "id" });

  if (!error) return;

  const { error: fallbackError } = await params.admin
    .from("profiles")
    .upsert(
      {
        id: params.userId,
        subscription_status: "active",
        subscription_end_at: params.endAtIso,
        updated_at: params.startAtIso,
      },
      { onConflict: "id" }
    );

  if (fallbackError) {
    throw new Error(
      `update profiles failed: ${error.message}; fallback: ${fallbackError.message}`
    );
  }
}

export async function handleAlipayNotifyRequest(request: Request) {
  try {
    const rawBody = await request.text();
    const payload = parseFormBody(rawBody);

    if (!verifyAlipayNotify(payload)) {
      return new Response("fail", { status: 400 });
    }

    const tradeStatus = payload.trade_status;
    if (tradeStatus !== "TRADE_SUCCESS" && tradeStatus !== "TRADE_FINISHED") {
      return textSuccess();
    }

    const now = new Date();
    const outTradeNo = payload.out_trade_no;
    const tradeNo = payload.trade_no;
    const totalAmount = payload.total_amount ?? null;

    if (!outTradeNo) {
      return new Response("fail", { status: 400 });
    }

    const admin = createSupabaseAdmin();
    const { userId, planId } = await resolveOrderIdentity(
      admin,
      outTradeNo,
      payload
    );

    if (!userId || !planId) {
      console.error("[alipay notify] missing order identity", {
        outTradeNo,
        userId,
        planId,
      });
      return new Response("fail", { status: 400 });
    }

    const subscriptionStart = chinaIso(now);
    const subscriptionEnd = addDays(now, planId === "yearly" ? 365 : 30);
    const subscriptionEndIso = chinaIso(subscriptionEnd);

    await updateProfileSubscribed({
      admin,
      userId,
      startAtIso: subscriptionStart,
      endAtIso: subscriptionEndIso,
    });

    const { error: orderError } = await admin.from("orders").upsert(
      {
        user_id: userId,
        plan_id: planId,
        amount: totalAmount,
        status: "paid",
        out_trade_no: outTradeNo,
        alipay_trade_no: tradeNo ?? null,
        paid_at: subscriptionStart,
      },
      { onConflict: "out_trade_no" }
    );
    if (orderError) {
      throw new Error(`insert order failed: ${orderError.message}`);
    }

    console.log("[alipay notify] paid", { outTradeNo, tradeNo, userId, planId });
    return textSuccess();
  } catch (error) {
    console.error("[alipay notify] error", error);
    return new Response("fail", { status: 500 });
  }
}

function textSuccess() {
  return new Response("success", {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
