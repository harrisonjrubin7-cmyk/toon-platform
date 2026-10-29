/**
 * Stripe Checkout for card packs, over Stripe's REST API (no SDK).
 * Test mode only unless PAYMENTS_LIVE=true: a live secret key is refused otherwise.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { AppError } from "../errors";

export function stripeKey(env: NodeJS.ProcessEnv = process.env): string {
  const key = env.STRIPE_SECRET_KEY ?? "";
  if (!key) throw new AppError("forbidden", "Card payments aren't set up yet.");
  if (key.startsWith("sk_live_") && env.PAYMENTS_LIVE !== "true") throw new AppError("forbidden", "Live payments are switched off. Use a Stripe test key.");
  return key;
}
export const isTestKey = (env: NodeJS.ProcessEnv = process.env) => (env.STRIPE_SECRET_KEY ?? "").startsWith("sk_test_");

function form(data: Record<string, string | number>) {
  return new URLSearchParams(Object.entries(data).map(([k, v]) => [k, String(v)])).toString();
}

export async function createCheckout(opts: {
  purchaseId: string; userEmail: string; productName: string; unitAmountCents: number; currency: string; quantity: number; baseUrl: string;
}, fetchImpl: typeof fetch = fetch): Promise<{ id: string; url: string }> {
  const res = await fetchImpl("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${stripeKey()}`, "Content-Type": "application/x-www-form-urlencoded", "Idempotency-Key": `purchase-${opts.purchaseId}` },
    body: form({
      mode: "payment",
      client_reference_id: opts.purchaseId,
      "metadata[purchase_id]": opts.purchaseId,
      customer_email: opts.userEmail,
      "line_items[0][quantity]": opts.quantity,
      "line_items[0][price_data][currency]": opts.currency,
      "line_items[0][price_data][unit_amount]": opts.unitAmountCents,
      "line_items[0][price_data][product_data][name]": opts.productName,
      success_url: `${opts.baseUrl}/play/packs?purchase=${opts.purchaseId}`,
      cancel_url: `${opts.baseUrl}/play/packs?cancelled=${opts.purchaseId}`,
      expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
    }),
  });
  const body = (await res.json()) as { id?: string; url?: string; error?: { message?: string } };
  if (!res.ok || !body.id || !body.url) {
    console.error("stripe checkout failed", res.status, body.error?.message);
    throw new AppError("invalid", "Checkout couldn't start. Please try again in a minute.");
  }
  return { id: body.id, url: body.url };
}

/** Verifies a Stripe-Signature header (v1 HMAC-SHA256 of "timestamp.payload") with a 5 minute tolerance. */
export function verifyWebhook(payload: string, header: string | null, secret: string, nowSec = Math.floor(Date.now() / 1000)): boolean {
  if (!header || !secret) return false;
  const parts = Object.groupBy(header.split(",").map((p) => p.split("=") as [string, string]), ([k]) => k);
  const t = Number(parts.t?.[0]?.[1]);
  const sigs = (parts.v1 ?? []).map(([, v]) => v);
  if (!t || !sigs.length || Math.abs(nowSec - t) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${payload}`).digest();
  return sigs.some((s) => {
    const got = Buffer.from(s, "hex");
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
}

export function signForTest(payload: string, secret: string, t = Math.floor(Date.now() / 1000)) {
  return `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex")}`;
}
