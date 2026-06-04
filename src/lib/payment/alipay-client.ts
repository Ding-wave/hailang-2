import { AlipaySdk } from "alipay-sdk";

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

function compactKey(rawKey: string) {
  return rawKey.replace(/\\n/g, "").replace(/\s+/g, "");
}

export function createAlipayClient() {
  return new AlipaySdk({
    appId: requireEnv("ALIPAY_APP_ID"),
    privateKey: compactKey(requireEnv("ALIPAY_PRIVATE_KEY")),
    alipayPublicKey: compactKey(requireEnv("ALIPAY_PUBLIC_KEY")),
    signType: "RSA2",
    keyType: "PKCS8",
    gateway:
      process.env.ALIPAY_GATEWAY?.trim() ||
      "https://openapi.alipay.com/gateway.do",
  });
}

export function verifyAlipayNotify(payload: Record<string, string>) {
  const alipaySdk = createAlipayClient();
  return (
    alipaySdk.checkNotifySign(payload) || alipaySdk.checkNotifySignV2(payload)
  );
}
