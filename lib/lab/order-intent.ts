import { ApiError } from "./api";
import { pricedOrderIntentSchema, type PricedOrderIntent } from "./endotoxin-order";

const encoder = new TextEncoder();

function signingSecret(): string {
  const value = process.env.ORDER_INTENT_SIGNING_SECRET;
  if (!value && process.env.NODE_ENV !== "production") {
    return "clearsignal-local-development-signing-secret-only";
  }
  if (!value || value.length < 32) {
    throw new ApiError(500, "Order intent signing is not configured", "server_configuration");
  }
  return value;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function base64UrlDecode(value: string): Uint8Array {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  try {
    return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
  } catch {
    throw new ApiError(400, "The price intent is malformed", "invalid_price_intent");
  }
}

async function hmacKey() {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(signingSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signOrderIntent(intent: PricedOrderIntent): Promise<string> {
  const payload = encoder.encode(JSON.stringify(pricedOrderIntentSchema.parse(intent)));
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(), payload);
  return `${base64UrlEncode(payload)}.${base64UrlEncode(new Uint8Array(signature))}`;
}

export async function verifyOrderIntent(token: string): Promise<PricedOrderIntent> {
  const [payloadPart, signaturePart, extra] = token.split(".");
  if (!payloadPart || !signaturePart || extra) throw new ApiError(400, "The price intent is malformed", "invalid_price_intent");
  const payload = base64UrlDecode(payloadPart);
  const signature = base64UrlDecode(signaturePart);
  const valid = await crypto.subtle.verify(
    "HMAC",
    await hmacKey(),
    new Uint8Array(signature),
    new Uint8Array(payload),
  );
  if (!valid) throw new ApiError(400, "The price intent signature is invalid", "invalid_price_intent");
  try {
    return pricedOrderIntentSchema.parse(JSON.parse(new TextDecoder().decode(payload)));
  } catch {
    throw new ApiError(400, "The price intent payload is invalid", "invalid_price_intent");
  }
}
