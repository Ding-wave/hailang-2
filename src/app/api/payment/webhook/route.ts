import { handleAlipayNotifyRequest } from "@/lib/payment/alipay-notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleAlipayNotifyRequest(request);
}
