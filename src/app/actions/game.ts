"use server";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db, withTx } from "@/lib/db";
import { currentActor } from "@/lib/auth/session";
import * as cards from "@/lib/domain/cards";
import { createCheckout } from "@/lib/payments/stripe";
import { appUrl } from "@/lib/email/transport";
import { AppError, toActionState, type ActionState } from "@/lib/errors";
import type { Pull } from "@/lib/game/packs";

type SaveDeckResult = NonNullable<ActionState> & { deckId?: string; version?: number; problems?: string[] };
export async function saveDeckAction(input: { id?: string; name: string; cards: string[]; version?: number }): Promise<SaveDeckResult> {
  try {
    const d = await cards.saveDeck(db, await currentActor(), input);
    revalidatePath("/play/decks");
    return { ok: true, message: d.problems.length ? "Saved. It needs a few changes before it can race." : "Saved. Ready to race.", deckId: d.id, version: d.version, problems: d.problems };
  } catch (e) {
    return toActionState(e) ?? { error: "Couldn't save." };
  }
}

export async function deleteDeckAction(f: FormData) {
  await cards.deleteDeck(db, await currentActor(), String(f.get("id")));
  revalidatePath("/play/decks");
  redirect("/play/decks");
}

export async function setPublicAction(f: FormData) {
  await cards.setPublicCollection(db, await currentActor(), f.get("on") === "1");
  revalidatePath("/play/collection");
}

export async function recordAiMatchAction(input: { opponent: string; result: "win" | "loss" | "draw" }) {
  try {
    await cards.recordAiMatch(db, await currentActor(), input);
    revalidatePath("/play");
    return { ok: true };
  } catch (e) {
    return toActionState(e);
  }
}

export async function openPackAction(packId: string): Promise<{ ok: true; pulls: Pull[]; newCards: string[] } | { ok: false; error: string }> {
  try {
    const actor = await currentActor();
    // No revalidatePath here: it would re-render the rip page mid-animation. Game pages are dynamic.
    const r = await withTx((tx) => cards.openPack(tx, actor, packId));
    return { ok: true, pulls: r.pulls, newCards: r.newCards };
  } catch (e) {
    const s = toActionState(e);
    return { ok: false, error: s?.error ?? "Couldn't open the pack." };
  }
}

/** Starts checkout. Test mode fulfils at once; Stripe sends the buyer to its hosted checkout page. */
export async function buyPacksAction(_: ActionState, f: FormData): Promise<ActionState> {
  const actor = await currentActor();
  if (!actor) redirect("/login?next=/play/packs");
  let url: string;
  try {
    const country = (await headers()).get("x-vercel-ip-country");
    const config = cards.storeConfig();
    const p = await cards.startPurchase(db, actor, { productId: f.get("productId"), quantity: f.get("quantity") }, { country, config });
    if (config.provider === "test") {
      await withTx((tx) => cards.fulfillPurchase(tx, p.purchaseId, { provider: "test", amountCents: p.amountCents }));
      url = `/play/packs?purchase=${p.purchaseId}`;
    } else {
      try {
        const session = await createCheckout({
          purchaseId: p.purchaseId, userEmail: actor.email, productName: p.product.name, unitAmountCents: p.product.priceCents,
          currency: p.product.currency, quantity: p.quantity, baseUrl: appUrl(),
        });
        await cards.attachProviderRef(db, p.purchaseId, session.id);
        url = session.url;
      } catch (e) {
        await cards.markPurchase(db, p.purchaseId, "failed");
        throw e;
      }
    }
  } catch (e) {
    return toActionState(e);
  }
  revalidatePath("/play/packs");
  redirect(url);
}

// ---------- studio ----------

export async function updateProductAction(_: ActionState, f: FormData): Promise<ActionState> {
  try {
    const price = Number(String(f.get("price") ?? "").replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(price) || price <= 0) throw new AppError("invalid", "Enter a price.", { price: "Enter a price like 2.99." });
    await withTx(async (tx) => cards.updateProduct(tx, await currentActor(), {
      id: f.get("id"), name: f.get("name"), description: f.get("description"), priceCents: Math.round(price * 100),
      active: f.get("active") === "on", odds: f.get("odds"), version: f.get("version"),
    }));
  } catch (e) {
    return toActionState(e);
  }
  revalidatePath("/studio/cards");
  revalidatePath("/play/packs");
  return { ok: true, message: "Pack saved. New odds apply to packs bought from now on." };
}

export async function grantPacksAction(_: ActionState, f: FormData): Promise<ActionState> {
  try {
    const r = await withTx(async (tx) => cards.grantPacks(tx, await currentActor(), { email: f.get("email"), productId: f.get("productId"), quantity: f.get("quantity") }));
    revalidatePath("/studio/cards");
    return { ok: true, message: `Gave ${r.quantity} pack${r.quantity > 1 ? "s" : ""}.` };
  } catch (e) {
    return toActionState(e);
  }
}
