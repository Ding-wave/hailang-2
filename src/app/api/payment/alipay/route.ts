import { createClient } from "@supabase/supabase-js";
import { createAlipayClient } from "@/lib/payment/alipay-client";
import { createClient as createServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CreatePaymentBody = {
  userId?: string;
  planId?: string;
  /** 客户端显式声明 H5/WAP，避免代理改写 User-Agent 时误判为电脑网站支付 */
  preferWap?: boolean;
};

type PlanConfig = {
  id: "monthly" | "yearly";
  totalAmount: string;
};

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

function normalizePlanId(planId: string): PlanConfig["id"] | null {
  const id = planId.trim().toLowerCase();
  if (id === "monthly" || id === "month" || id === "m") return "monthly";
  if (id === "yearly" || id === "year" || id === "annual" || id === "y")
    return "yearly";
  return null;
}

function getPlanConfig(planId: string): PlanConfig | null {
  const normalized = normalizePlanId(planId);
  if (!normalized) return null;

  const defaults: Record<PlanConfig["id"], PlanConfig> = {
    monthly: {
      id: "monthly",
      totalAmount: "19.00",
    },
    yearly: {
      id: "yearly",
      totalAmount: "108.00",
    },
  };

  const rawMap = process.env.ALIPAY_PLAN_PRICE_MAP?.trim();
  if (!rawMap) return defaults[normalized];

  try {
    const map = JSON.parse(rawMap) as Record<string, string | number>;
    const overridden = map[normalized];
    if (overridden === undefined || overridden === null) {
      return defaults[normalized];
    }

    return {
      ...defaults[normalized],
      totalAmount: String(overridden),
    };
  } catch {
    return defaults[normalized];
  }
}

function isMobileUserAgent(userAgent: string) {
  return /Android|iPhone|iPad|iPod|Mobile|HarmonyOS|Windows Phone/i.test(
    userAgent
  );
}

function createSupabaseAdmin() {
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

type AlipayErrorInfo = {
  code?: string;
  msg?: string;
  subCode?: string;
  subMsg?: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function getString(record: Record<string, unknown> | null, ...keys: string[]) {
  if (!record) return undefined;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return undefined;
}

function extractAlipayErrorInfo(source: unknown): AlipayErrorInfo {
  const root = asRecord(source);
  const response = asRecord(root?.response);
  const nestedResponse = asRecord(response?.alipay_trade_precreate_response);
  const nestedRoot = asRecord(root?.alipay_trade_precreate_response);

  const code =
    getString(root, "code") ??
    getString(response, "code") ??
    getString(nestedResponse, "code") ??
    getString(nestedRoot, "code");
  const msg =
    getString(root, "msg", "message") ??
    getString(response, "msg", "message") ??
    getString(nestedResponse, "msg", "message") ??
    getString(nestedRoot, "msg", "message");
  const subCode =
    getString(root, "sub_code", "subCode") ??
    getString(response, "sub_code", "subCode") ??
    getString(nestedResponse, "sub_code", "subCode") ??
    getString(nestedRoot, "sub_code", "subCode");
  const subMsg =
    getString(root, "sub_msg", "subMsg") ??
    getString(response, "sub_msg", "subMsg") ??
    getString(nestedResponse, "sub_msg", "subMsg") ??
    getString(nestedRoot, "sub_msg", "subMsg");

  return { code, msg, subCode, subMsg };
}

function getSiteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    "http://localhost:3000"
  );
}

function getRedirectUrls() {
  const siteUrl = getSiteUrl();

  const returnUrl =
    process.env.ALIPAY_RETURN_URL?.trim() ||
    process.env.NEXT_PUBLIC_ALIPAY_RETURN_URL?.trim() ||
    `${siteUrl}/`;

  const quitUrl =
    process.env.ALIPAY_QUIT_URL?.trim() ||
    process.env.NEXT_PUBLIC_ALIPAY_QUIT_URL?.trim() ||
    returnUrl;

  const notifyUrl =
    process.env.ALIPAY_NOTIFY_URL?.trim() ||
    `${siteUrl}/api/payment/webhook`;

  return { returnUrl, quitUrl, notifyUrl };
}

/** 支付宝禁止 passback_params 使用 JSON（含双引号），须为 UrlEncode 后的键值对 */
function buildPassbackParams(userId: string, planId: PlanConfig["id"]) {
  return encodeURIComponent(`userId=${userId}&planId=${planId}`);
}

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as CreatePaymentBody;
    const userId = body.userId?.trim();
    const planId = body.planId?.trim();

    if (!userId || !planId) {
      return Response.json(
        { error: "userId and planId are required" },
        { status: 400 }
      );
    }
    if (userId !== user.id) {
      return Response.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const plan = getPlanConfig(planId);
    if (!plan) {
      return Response.json(
        { error: "Unsupported planId. Use monthly or yearly." },
        { status: 400 }
      );
    }

    const alipaySdk = createAlipayClient();
    const userAgent = request.headers.get("user-agent") ?? "";
    const mobile =
      body.preferWap === true || isMobileUserAgent(userAgent);
    const paymentType = mobile ? "wap" : "page";
    const outTradeNo = `${user.id}_${plan.id}_${Date.now()}`;
    const passbackParams = buildPassbackParams(user.id, plan.id);
    const formattedPrice = Number(plan.totalAmount).toFixed(2);
    const subject = "海浪资讯";
    const { returnUrl, quitUrl, notifyUrl } = getRedirectUrls();

    const admin = createSupabaseAdmin();
    const { error: pendingOrderError } = await admin.from("orders").upsert(
      {
        user_id: user.id,
        plan_id: plan.id,
        amount: formattedPrice,
        status: "pending",
        out_trade_no: outTradeNo,
      },
      { onConflict: "out_trade_no" }
    );
    if (pendingOrderError) {
      return Response.json(
        { error: `create pending order failed: ${pendingOrderError.message}` },
        { status: 500 }
      );
    }

    let result = "";
    if (mobile) {
      result = alipaySdk.pageExecute("alipay.trade.wap.pay", "POST", {
        notifyUrl,
        returnUrl,
        bizContent: {
          out_trade_no: outTradeNo,
          total_amount: formattedPrice,
          subject,
          product_code: "QUICK_WAP_WAY",
          quit_url: quitUrl,
          passback_params: passbackParams,
        },
      });
    } else {
      try {
        const desktopBizContent = {
          out_trade_no: outTradeNo,
          total_amount: formattedPrice,
          subject,
          product_code: "FAST_INSTANT_TRADE_PAY",
          passback_params: passbackParams,
        };
        const desktopReturnUrl = returnUrl;
        const desktopNotifyUrl = notifyUrl;

        const desktopAlipaySdk = alipaySdk as unknown as {
          pageExecute?: (
            method: string,
            params: Record<string, unknown>
          ) => Promise<string> | string;
          exec?: (
            method: string,
            params: Record<string, unknown>
          ) => Promise<string> | string;
        };

        let payUrl = "";
        if (typeof desktopAlipaySdk.pageExecute === "function") {
          payUrl = await desktopAlipaySdk.pageExecute("alipay.trade.page.pay", {
            bizContent: desktopBizContent,
            returnUrl: desktopReturnUrl,
            notifyUrl: desktopNotifyUrl,
          });
        } else if (typeof desktopAlipaySdk.exec === "function") {
          payUrl = await desktopAlipaySdk.exec("alipay.trade.page.pay", {
            bizContent: desktopBizContent,
            returnUrl: desktopReturnUrl,
            notifyUrl: desktopNotifyUrl,
          });
        } else {
          throw new Error("SDK 缺少执行页面类接口的方法，请检查实例");
        }

        if (payUrl) {
          return Response.json({ success: true, url: payUrl });
        }
        throw new Error("未成功生成支付跳转链接");
      } catch (err) {
        console.error("电脑端网站支付标准调用崩溃:", err);
        return Response.json(
          {
            success: false,
            error: String(err),
          },
          { status: 500 }
        );
      }
    }

    return Response.json({
      success: true,
      method: "alipay.trade.wap.pay",
      paymentType,
      isMobile: mobile,
      planId: plan.id,
      totalAmount: formattedPrice,
      outTradeNo,
      url: result,
      notifyUrl,
      returnUrl,
      quitUrl,
    });
  } catch (error) {
    const alipayError = extractAlipayErrorInfo(error);
    return Response.json(
      {
        error: error instanceof Error ? error.message : "UNKNOWN_ERROR",
        ...alipayError,
      },
      { status: 500 }
    );
  }
}
