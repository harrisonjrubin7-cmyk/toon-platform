import { db, withTx } from "@/lib/db";
import { fulfillPurchase, markPurchase } from "@/lib/domain/cards";
import { isAppError } from "@/lib/errors";
import { verifyWebhook } from "@/lib/payments/stripe";

type Session = { id: string; client_reference_id?: string; metadata?: { purchase_id?: string }; amount_total?: number; payment_status?: string };

/**
 * Stripe webhook. Point a Stripe webhook at /api/payments/stripe with the events
 * checkout.session.completed, checkout.session.async_payment_succeeded,
 * checkout.session.async_payment_failed and checkout.session.expired.
 * Fulfilment is idempotent, so Stripe's retries are safe.
 */
export async function POST(request: Request) {
  const payload = await request.text();
  if (!verifyWebhook(payload, request.headers.get("stripe-signature"), process.env.STRIPE_WEBHOOK_SECRET ?? "")) {
    return Response.json({ error: "Bad signature" }, { status: 400 });
  }
  const event = JSON.parse(payload) as { type: string; data: { object: Session } };
  const s = event.data.object;
  const purchaseId = s.metadata?.purchase_id ?? s.client_reference_id;
  if (!purchaseId || !/^[0-9a-f-]{36}$/i.test(purchaseId)) return Response.json({ ignored: true });
  try {
    if ((event.type === "checkout.session.completed" && s.payment_status === "paid") || event.type === "checkout.session.async_payment_succeeded") {
      await withTx((tx) => fulfillPurchase(tx, purchaseId, { provider: "stripe", amountCents: s.amount_total, providerRef: s.id }));
    } else if (event.type === "checkout.session.async_payment_failed") {
      await markPurchase(db, purchaseId, "failed");
    } else if (event.type === "checkout.session.expired") {
      await markPurchase(db, purchaseId, "expired");
    }
  } catch (e) {
    // A mismatch is logged and acknowledged so Stripe stops retrying; anything else is retried.
    if (isAppError(e)) { console.error("stripe webhook rejected", purchaseId, e.message); return Response.json({ rejected: e.message }); }
    throw e;
  }
  return Response.json({ received: true });
}
