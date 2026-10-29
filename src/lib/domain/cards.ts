/**
 * Card game domain: collections, decks, packs, purchases and recorded matches.
 * Functions marked "tx" must run inside withTx so their writes land together.
 */
import { randomInt } from "node:crypto";
import { z } from "zod";
import type { Queryable } from "../db";
import { AppError } from "../errors";
import { permissions, type Actor } from "../roles";
import { parseOrThrow } from "./accounts";
import { audit } from "./audit";
import { card, CARDS, isCard, SCAR_FOIL_RUN, type Rarity, type Variant } from "../game/cards";
import { deckProblems } from "../game/engine";
import { STARTER_DECK } from "../game/decks";
import { oddsSchema, packSize, pointsFor, rollPack, type PackOdds, type Pull } from "../game/packs";

export function requirePlayer(actor: Actor | null): Actor {
  if (!actor) throw new AppError("unauthenticated", "Sign in to play.");
  if (!permissions.playGame(actor)) throw new AppError("forbidden", "Confirm you're 18 or older to play.");
  return actor;
}
function requireStoreAdmin(actor: Actor | null): Actor {
  if (!actor) throw new AppError("unauthenticated", "Sign in to use the studio.");
  if (!permissions.manageStore(actor)) throw new AppError("forbidden", "Only admins can manage the card store.");
  return actor;
}

/** Crypto-strength uniform number in [0, 1) for pack rolls. */
export const secureRandom = () => randomInt(0, 2 ** 47) / 2 ** 47;

// ---------- collection ----------

async function addCards(tx: Queryable, userId: string, pulls: { cardId: string; variant: Variant; serial?: number }[], source: "starter" | "pack" | "admin", packId: string | null) {
  for (const p of pulls) {
    await tx.query(
      `insert into card_collection (user_id, card_id, variant, quantity) values ($1,$2,$3,1)
       on conflict (user_id, card_id, variant) do update set quantity = card_collection.quantity + 1`,
      [userId, p.cardId, p.variant],
    );
    await tx.query("insert into card_grants (user_id, card_id, variant, source, pack_id, serial) values ($1,$2,$3,$4,$5,$6)", [userId, p.cardId, p.variant, source, packId, p.serial ?? null]);
  }
}

/** tx. Gives a new player the free starter deck once. Safe to call on every visit. */
export async function ensureStarter(tx: Queryable, actor: Actor | null) {
  const a = requirePlayer(actor);
  await tx.query("insert into game_profiles (user_id) values ($1) on conflict do nothing", [a.id]);
  const { rowCount } = await tx.query("update game_profiles set starter_granted_at = now() where user_id = $1 and starter_granted_at is null", [a.id]);
  if (!rowCount) return false;
  await addCards(tx, a.id, STARTER_DECK.map((cardId) => ({ cardId, variant: "base" as const })), "starter", null);
  await tx.query("insert into decks (user_id, name, cards) values ($1,$2,$3)", [a.id, "Cinder Isle Garage (starter)", JSON.stringify(STARTER_DECK)]);
  return true;
}

export type OwnedCard = { cardId: string; variant: Variant; quantity: number; firstAcquiredAt: Date };

export async function getCollection(q: Queryable, actor: Actor | null): Promise<OwnedCard[]> {
  const a = requirePlayer(actor);
  return collectionOf(q, a.id);
}
async function collectionOf(q: Queryable, userId: string): Promise<OwnedCard[]> {
  const { rows } = await q.query<{ card_id: string; variant: Variant; quantity: number; first_acquired_at: Date }>(
    "select card_id, variant, quantity, first_acquired_at from card_collection where user_id = $1 and quantity > 0", [userId]);
  return rows.filter((r) => isCard(r.card_id)).map((r) => ({ cardId: r.card_id, variant: r.variant, quantity: r.quantity, firstAcquiredAt: r.first_acquired_at }));
}

/** Portfolio summary: completion, counts by rarity and variant, and collector points (a score, not money). */
export function portfolio(owned: OwnedCard[]) {
  const distinct = new Set(owned.map((o) => o.cardId));
  const byRarity = {} as Record<Rarity, { owned: number; total: number }>;
  for (const c of CARDS) {
    byRarity[c.rarity] ??= { owned: 0, total: 0 };
    byRarity[c.rarity].total++;
    if (distinct.has(c.id)) byRarity[c.rarity].owned++;
  }
  const variants: Record<Variant, number> = { base: 0, reverse_holo: 0, scar_foil: 0 };
  let points = 0, copies = 0;
  for (const o of owned) {
    variants[o.variant] += o.quantity;
    copies += o.quantity;
    points += pointsFor(card(o.cardId).rarity, o.variant) * o.quantity;
  }
  return { distinct: distinct.size, total: CARDS.length, copies, byRarity, variants, points };
}

export async function setPublicCollection(q: Queryable, actor: Actor | null, on: boolean) {
  const a = requirePlayer(actor);
  await q.query("insert into game_profiles (user_id, public_collection) values ($1,$2) on conflict (user_id) do update set public_collection = $2", [a.id, on]);
}

export async function getProfile(q: Queryable, actor: Actor | null) {
  const a = requirePlayer(actor);
  const { rows } = await q.query<{ public_collection: boolean }>("select public_collection from game_profiles where user_id = $1", [a.id]);
  const stats = await matchStats(q, a.id);
  return { publicCollection: rows[0]?.public_collection ?? false, ...stats };
}

/** A player's public showcase. Not found unless they turned sharing on. */
export async function publicCollector(q: Queryable, userId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new AppError("not_found", "No such collector.");
  const { rows } = await q.query<{ display_name: string }>(
    "select u.display_name from game_profiles g join users u on u.id = g.user_id where g.user_id = $1 and g.public_collection and u.disabled_at is null", [userId]);
  if (!rows[0]) throw new AppError("not_found", "No such collector.");
  const owned = await collectionOf(q, userId);
  return { displayName: rows[0].display_name, owned, summary: portfolio(owned), ...(await matchStats(q, userId)) };
}

/** Epic and better pulls from players who share their collection. */
export async function recentPulls(q: Queryable, limit = 12) {
  const { rows } = await q.query<{ user_id: string; display_name: string; card_id: string; variant: Variant; created_at: Date }>(
    `select g.user_id, u.display_name, g.card_id, g.variant, g.created_at
       from card_grants g join game_profiles p on p.user_id = g.user_id and p.public_collection
       join users u on u.id = g.user_id and u.disabled_at is null
      where g.source = 'pack' order by g.created_at desc limit 200`);
  return rows
    .filter((r) => isCard(r.card_id) && (["epic", "legendary", "secret"].includes(card(r.card_id).rarity) || r.variant === "scar_foil"))
    .slice(0, limit)
    .map((r) => ({ userId: r.user_id, displayName: r.display_name, cardId: r.card_id, variant: r.variant, at: r.created_at }));
}

// ---------- decks ----------

export type Deck = { id: string; name: string; cards: string[]; version: number; updatedAt: Date; problems: string[] };

const toDeck = (r: { id: string; name: string; cards: string[]; version: number; updated_at: Date }, owned?: Map<string, number>): Deck => {
  const problems = deckProblems(r.cards);
  if (owned) problems.push(...ownershipProblems(r.cards, owned));
  return { id: r.id, name: r.name, cards: r.cards, version: r.version, updatedAt: r.updated_at, problems };
};

const ownedCounts = (owned: OwnedCard[]) => {
  const m = new Map<string, number>();
  for (const o of owned) m.set(o.cardId, (m.get(o.cardId) ?? 0) + o.quantity);
  return m;
};
function ownershipProblems(cards: string[], owned: Map<string, number>) {
  const need = new Map<string, number>();
  for (const id of cards) need.set(id, (need.get(id) ?? 0) + 1);
  const out: string[] = [];
  for (const [id, n] of need) {
    const have = owned.get(id) ?? 0;
    if (isCard(id) && have < n) out.push(`You own ${have} of ${card(id).name} but the deck uses ${n}.`);
  }
  return out;
}

export async function listDecks(q: Queryable, actor: Actor | null): Promise<Deck[]> {
  const a = requirePlayer(actor);
  const owned = ownedCounts(await collectionOf(q, a.id));
  const { rows } = await q.query<{ id: string; name: string; cards: string[]; version: number; updated_at: Date }>(
    "select id, name, cards, version, updated_at from decks where user_id = $1 order by updated_at desc", [a.id]);
  return rows.map((r) => toDeck(r, owned));
}

export async function getDeck(q: Queryable, actor: Actor | null, id: string): Promise<Deck> {
  const a = requirePlayer(actor);
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new AppError("not_found", "Deck not found.");
  const { rows } = await q.query<{ id: string; name: string; cards: string[]; version: number; updated_at: Date }>(
    "select id, name, cards, version, updated_at from decks where id = $1 and user_id = $2", [id, a.id]);
  if (!rows[0]) throw new AppError("not_found", "Deck not found.");
  return toDeck(rows[0], ownedCounts(await collectionOf(q, a.id)));
}

const deckSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Give the deck a name.").max(60, "Keep the name under 60 characters."),
  cards: z.array(z.string()).max(60),
  version: z.coerce.number().int().optional(),
});

/** Saves a deck. A deck can be saved while incomplete, but never with cards the player doesn't own. */
export async function saveDeck(q: Queryable, actor: Actor | null, input: unknown): Promise<Deck> {
  const a = requirePlayer(actor);
  const d = parseOrThrow(deckSchema, input);
  const unknown = d.cards.filter((c) => !isCard(c));
  if (unknown.length) throw new AppError("invalid", "That deck has cards that don't exist.");
  const owned = ownedCounts(await collectionOf(q, a.id));
  const own = ownershipProblems(d.cards, owned);
  if (own.length) throw new AppError("invalid", own[0]);
  if (d.id) {
    const { rows } = await q.query<{ id: string; name: string; cards: string[]; version: number; updated_at: Date }>(
      `update decks set name = $3, cards = $4, version = version + 1, updated_at = now()
        where id = $1 and user_id = $2 and ($5::int is null or version = $5) returning id, name, cards, version, updated_at`,
      [d.id, a.id, d.name, JSON.stringify(d.cards), d.version ?? null]);
    if (!rows[0]) {
      const exists = await q.query("select 1 from decks where id = $1 and user_id = $2", [d.id, a.id]);
      if (!exists.rowCount) throw new AppError("not_found", "Deck not found.");
      throw new AppError("conflict", "This deck was changed in another tab. Reload it, then try again.");
    }
    return toDeck(rows[0], owned);
  }
  const count = await q.query<{ n: string }>("select count(*) n from decks where user_id = $1", [a.id]);
  if (Number(count.rows[0].n) >= 30) throw new AppError("invalid", "You can keep up to 30 decks. Delete one first.");
  const { rows } = await q.query<{ id: string; name: string; cards: string[]; version: number; updated_at: Date }>(
    "insert into decks (user_id, name, cards) values ($1,$2,$3) returning id, name, cards, version, updated_at", [a.id, d.name, JSON.stringify(d.cards)]);
  return toDeck(rows[0], owned);
}

export async function deleteDeck(q: Queryable, actor: Actor | null, id: string) {
  const a = requirePlayer(actor);
  const { rowCount } = await q.query("delete from decks where id = $1 and user_id = $2", [id, a.id]);
  if (!rowCount) throw new AppError("not_found", "Deck not found.");
}

/** A deck that is legal and fully owned, ready to battle with. */
export async function playableDeck(q: Queryable, actor: Actor | null, id: string): Promise<Deck> {
  const d = await getDeck(q, actor, id);
  if (d.problems.length) throw new AppError("invalid", `That deck isn't ready: ${d.problems[0]}`);
  return d;
}

// ---------- store ----------

export type Product = { id: string; name: string; description: string; priceCents: number; currency: string; odds: PackOdds; active: boolean; version: number };
type ProductRow = { id: string; name: string; description: string; price_cents: number; currency: string; odds: PackOdds; active: boolean; version: number };
const toProduct = (r: ProductRow): Product => ({ id: r.id, name: r.name, description: r.description, priceCents: r.price_cents, currency: r.currency, odds: r.odds, active: r.active, version: r.version });

export async function listProducts(q: Queryable, { includeInactive = false } = {}): Promise<Product[]> {
  const { rows } = await q.query<ProductRow>(`select * from pack_products ${includeInactive ? "" : "where active"} order by position, name`);
  return rows.map(toProduct);
}
export async function getProduct(q: Queryable, id: string): Promise<Product> {
  const { rows } = await q.query<ProductRow>("select * from pack_products where id = $1", [id]);
  if (!rows[0]) throw new AppError("not_found", "That pack isn't available.");
  return toProduct(rows[0]);
}

export type StoreConfig = { provider: "stripe" | "test" | "off"; blockedCountries: string[]; dailyCapCents: number };
export function storeConfig(env: NodeJS.ProcessEnv = process.env): StoreConfig {
  const raw = (env.PAYMENTS_PROVIDER ?? "off").toLowerCase();
  const provider = raw === "stripe" || raw === "test" ? raw : "off";
  return {
    provider,
    blockedCountries: (env.PACKS_BLOCKED_COUNTRIES ?? "BE").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean),
    dailyCapCents: Math.max(0, Number(env.PACKS_DAILY_CAP_CENTS ?? 5000) || 0),
  };
}

const buySchema = z.object({ productId: z.string().min(1), quantity: z.coerce.number().int().min(1, "Buy at least one pack.").max(10, "Up to 10 packs at a time.") });

/**
 * Creates a pending purchase after the loot-box safeguards: 18+ account, country not blocked,
 * daily spend cap, pack on sale. The caller then sends the buyer to checkout.
 */
export async function startPurchase(q: Queryable, actor: Actor | null, input: unknown, ctx: { country: string | null; config?: StoreConfig }) {
  const a = requirePlayer(actor);
  const cfg = ctx.config ?? storeConfig();
  if (cfg.provider === "off") throw new AppError("forbidden", "Pack sales aren't switched on yet.");
  const { productId, quantity } = parseOrThrow(buySchema, input);
  const country = ctx.country?.toUpperCase() ?? null;
  if (country && cfg.blockedCountries.includes(country)) throw new AppError("forbidden", "Paid packs aren't sold in your country.");
  const p = await getProduct(q, productId);
  if (!p.active) throw new AppError("invalid", "That pack isn't on sale right now.");
  const amount = p.priceCents * quantity;
  const spent = await q.query<{ total: string }>(
    "select coalesce(sum(amount_cents),0) total from purchases where user_id = $1 and provider <> 'grant' and status in ('pending','paid') and created_at > now() - interval '24 hours'", [a.id]);
  if (Number(spent.rows[0].total) + amount > cfg.dailyCapCents) {
    throw new AppError("invalid", `That would go over the daily limit of ${money(cfg.dailyCapCents, p.currency)}. Try fewer packs or come back tomorrow.`);
  }
  const { rows } = await q.query<{ id: string }>(
    `insert into purchases (user_id, product_id, quantity, unit_price_cents, amount_cents, currency, provider, country, odds_snapshot)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
    [a.id, p.id, quantity, p.priceCents, amount, p.currency, cfg.provider, country, JSON.stringify(p.odds)]);
  await audit(q, a.id, "purchase.start", "purchase", rows[0].id, { productId, quantity, amount, provider: cfg.provider });
  return { purchaseId: rows[0].id, product: p, quantity, amountCents: amount };
}

export async function attachProviderRef(q: Queryable, purchaseId: string, ref: string) {
  await q.query("update purchases set provider_ref = $2 where id = $1 and provider_ref is null", [purchaseId, ref]);
}

/**
 * tx. Marks a purchase paid and creates its sealed packs. Runs once: a repeated webhook or a
 * double click finds it already paid and does nothing.
 */
export async function fulfillPurchase(tx: Queryable, purchaseId: string, check: { provider: "stripe" | "test"; amountCents?: number; providerRef?: string }) {
  const { rows } = await tx.query<{ id: string; user_id: string; product_id: string; quantity: number; amount_cents: number; status: string; provider: string; provider_ref: string | null; odds_snapshot: PackOdds }>(
    "select * from purchases where id = $1 for update", [purchaseId]);
  const p = rows[0];
  if (!p) throw new AppError("not_found", "Purchase not found.");
  if (p.provider !== check.provider) throw new AppError("invalid", "Payment provider mismatch.");
  if (check.providerRef && p.provider_ref && p.provider_ref !== check.providerRef) throw new AppError("invalid", "Checkout session mismatch.");
  if (check.amountCents !== undefined && check.amountCents !== p.amount_cents) throw new AppError("invalid", "Paid amount doesn't match the order.");
  if (p.status === "paid") return { fulfilled: false, userId: p.user_id };
  if (p.status !== "pending") throw new AppError("conflict", `Purchase is ${p.status}.`);
  await tx.query("update purchases set status = 'paid', paid_at = now(), provider_ref = coalesce(provider_ref, $2) where id = $1", [p.id, check.providerRef ?? null]);
  for (let i = 0; i < p.quantity; i++) {
    await tx.query("insert into packs (user_id, product_id, purchase_id, source, odds_snapshot) values ($1,$2,$3,'purchase',$4)", [p.user_id, p.product_id, p.id, JSON.stringify(p.odds_snapshot)]);
  }
  await audit(tx, p.user_id, "purchase.paid", "purchase", p.id, { quantity: p.quantity, amount: p.amount_cents });
  return { fulfilled: true, userId: p.user_id };
}

export async function markPurchase(q: Queryable, purchaseId: string, status: "failed" | "expired") {
  await q.query("update purchases set status = $2 where id = $1 and status = 'pending'", [purchaseId, status]);
}

/** Buyer-side status check after returning from checkout. */
export async function getPurchase(q: Queryable, actor: Actor | null, id: string) {
  const a = requirePlayer(actor);
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new AppError("not_found", "Purchase not found.");
  const { rows } = await q.query<{ id: string; status: string; quantity: number; amount_cents: number; currency: string; product_id: string }>(
    "select id, status, quantity, amount_cents, currency, product_id from purchases where id = $1 and user_id = $2", [id, a.id]);
  if (!rows[0]) throw new AppError("not_found", "Purchase not found.");
  return rows[0];
}

export async function purchaseHistory(q: Queryable, actor: Actor | null) {
  const a = requirePlayer(actor);
  const { rows } = await q.query<{ id: string; status: string; quantity: number; amount_cents: number; currency: string; product_id: string; provider: string; created_at: Date }>(
    "select id, status, quantity, amount_cents, currency, product_id, provider, created_at from purchases where user_id = $1 order by created_at desc limit 50", [a.id]);
  return rows;
}

// ---------- packs ----------

export type SealedPack = { id: string; productId: string; productName: string; createdAt: Date; source: string };

export async function sealedPacks(q: Queryable, actor: Actor | null): Promise<SealedPack[]> {
  const a = requirePlayer(actor);
  const { rows } = await q.query<{ id: string; product_id: string; name: string; created_at: Date; source: string }>(
    `select p.id, p.product_id, pp.name, p.created_at, p.source from packs p join pack_products pp on pp.id = p.product_id
      where p.user_id = $1 and p.status = 'sealed' order by p.created_at`, [a.id]);
  return rows.map((r) => ({ id: r.id, productId: r.product_id, productName: r.name, createdAt: r.created_at, source: r.source }));
}

/**
 * tx. Opens a sealed pack with the odds it was sold under. Opening the same pack again returns
 * the same cards, so a double tap or a retry after a dropped connection is safe.
 */
export async function openPack(tx: Queryable, actor: Actor | null, packId: string, random: () => number = secureRandom): Promise<{ pulls: Pull[]; fresh: boolean; newCards: string[] }> {
  const a = requirePlayer(actor);
  if (!/^[0-9a-f-]{36}$/i.test(packId)) throw new AppError("not_found", "Pack not found.");
  const { rows } = await tx.query<{ id: string; status: string; odds_snapshot: PackOdds; contents: Pull[] | null }>(
    "select id, status, odds_snapshot, contents from packs where id = $1 and user_id = $2 for update", [packId, a.id]);
  const p = rows[0];
  if (!p) throw new AppError("not_found", "Pack not found.");
  if (p.status === "opened") return { pulls: p.contents ?? [], fresh: false, newCards: [] };
  if (p.status !== "sealed") throw new AppError("conflict", "This pack can't be opened.");
  const before = new Set((await collectionOf(tx, a.id)).map((o) => o.cardId));
  const pulls = rollPack(oddsSchema.parse(p.odds_snapshot), random);
  // Scar foils are a numbered run of 50 per card across all players. Once a run is gone,
  // that pull becomes a reverse holo (the odds page says so).
  for (const pull of pulls) {
    if (pull.variant !== "scar_foil") continue;
    await tx.query("select pg_advisory_xact_lock(hashtext($1))", [`scar:${pull.cardId}`]);
    const { rows: n } = await tx.query<{ max: number | null }>("select max(serial) max from card_grants where card_id = $1 and variant = 'scar_foil'", [pull.cardId]);
    const next = (n[0].max ?? 0) + 1;
    if (next > SCAR_FOIL_RUN) pull.variant = "reverse_holo";
    else pull.serial = next;
  }
  await tx.query("update packs set status = 'opened', opened_at = now(), contents = $2 where id = $1", [p.id, JSON.stringify(pulls)]);
  await addCards(tx, a.id, pulls, "pack", p.id);
  const newCards = [...new Set(pulls.map((x) => x.cardId))].filter((id) => !before.has(id));
  return { pulls, fresh: true, newCards };
}

export async function openedPacks(q: Queryable, actor: Actor | null, limit = 20) {
  const a = requirePlayer(actor);
  const { rows } = await q.query<{ id: string; name: string; opened_at: Date; contents: Pull[] }>(
    `select p.id, pp.name, p.opened_at, p.contents from packs p join pack_products pp on pp.id = p.product_id
      where p.user_id = $1 and p.status = 'opened' order by p.opened_at desc limit $2`, [a.id, limit]);
  return rows;
}

// ---------- studio: store admin ----------

const productSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(1, "Enter a name.").max(80),
  description: z.string().trim().max(400).default(""),
  priceCents: z.coerce.number().int().min(50, "The lowest price is 0.50."),
  active: z.coerce.boolean(),
  odds: z.string().transform((s, ctx) => {
    try { return oddsSchema.parse(JSON.parse(s)); } catch { ctx.addIssue({ code: "custom", message: "Odds must be valid pack odds JSON." }); return z.NEVER; }
  }),
  version: z.coerce.number().int(),
});

/** tx. Odds changes apply to packs bought afterwards; packs already sold keep their snapshot. */
export async function updateProduct(tx: Queryable, actor: Actor | null, input: unknown) {
  const a = requireStoreAdmin(actor);
  const d = parseOrThrow(productSchema, input);
  if (packSize(d.odds) > 15) throw new AppError("invalid", "A pack can hold at most 15 cards.", { odds: "Too many cards." });
  const { rowCount } = await tx.query(
    `update pack_products set name=$2, description=$3, price_cents=$4, active=$5, odds=$6, version=version+1, updated_at=now() where id=$1 and version=$7`,
    [d.id, d.name, d.description, d.priceCents, d.active, JSON.stringify(d.odds), d.version]);
  if (!rowCount) throw new AppError("conflict", "Someone else saved this pack since you opened it. Reload and try again.");
  await audit(tx, a.id, "store.product.update", "pack_product", d.id, { priceCents: d.priceCents, active: d.active });
}

const grantSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter the player's email."),
  productId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(20, "Up to 20 packs at a time."),
});

/** tx. Free packs from the studio (prizes, apologies, testing). Logged in the activity log. */
export async function grantPacks(tx: Queryable, actor: Actor | null, input: unknown) {
  const a = requireStoreAdmin(actor);
  const d = parseOrThrow(grantSchema, input);
  const u = await tx.query<{ id: string }>("select id from users where lower(email) = $1", [d.email]);
  if (!u.rows[0]) throw new AppError("invalid", "No account uses that email.", { email: "Not found." });
  const p = await getProduct(tx, d.productId);
  for (let i = 0; i < d.quantity; i++) {
    await tx.query("insert into packs (user_id, product_id, source, odds_snapshot) values ($1,$2,'grant',$3)", [u.rows[0].id, p.id, JSON.stringify(p.odds)]);
  }
  await audit(tx, a.id, "store.grant", "user", u.rows[0].id, { productId: p.id, quantity: d.quantity });
  return { userId: u.rows[0].id, quantity: d.quantity };
}

export async function storeReport(q: Queryable, actor: Actor | null) {
  requireStoreAdmin(actor);
  const purchases = await q.query<{ id: string; email: string; product_id: string; quantity: number; amount_cents: number; currency: string; provider: string; status: string; country: string | null; created_at: Date }>(
    `select p.id, u.email, p.product_id, p.quantity, p.amount_cents, p.currency, p.provider, p.status, p.country, p.created_at
       from purchases p join users u on u.id = p.user_id order by p.created_at desc limit 100`);
  const totals = await q.query<{ provider: string; status: string; n: string; cents: string }>(
    "select provider, status, count(*) n, coalesce(sum(amount_cents),0) cents from purchases group by provider, status");
  const packs = await q.query<{ status: string; n: string }>("select status, count(*) n from packs group by status");
  return { purchases: purchases.rows, totals: totals.rows, packs: packs.rows };
}

// ---------- matches vs the computer ----------

const aiResultSchema = z.object({ opponent: z.string().max(40), result: z.enum(["win", "loss", "draw"]), deckId: z.string().uuid().optional() });

/** Records a finished match against the computer. Played in the browser, so it never awards anything. */
export async function recordAiMatch(q: Queryable, actor: Actor | null, input: unknown) {
  const a = requirePlayer(actor);
  const d = parseOrThrow(aiResultSchema, input);
  await q.query(
    "insert into matches (mode, status, player_a, ai_opponent, deck_a, winner) values ('ai','done',$1,$2,'[]',$3)",
    [a.id, d.opponent, d.result === "win" ? "a" : d.result === "loss" ? "b" : "draw"]);
}

export async function matchStats(q: Queryable, userId: string) {
  const { rows } = await q.query<{ mode: string; won: string; lost: string; drawn: string }>(
    `select mode,
            count(*) filter (where (player_a = $1 and winner = 'a') or (player_b = $1 and winner = 'b')) won,
            count(*) filter (where (player_a = $1 and winner = 'b') or (player_b = $1 and winner = 'a')) lost,
            count(*) filter (where winner = 'draw') drawn
       from matches where status = 'done' and (player_a = $1 or player_b = $1) group by mode`, [userId]);
  const get = (m: string) => rows.find((r) => r.mode === m);
  const n = (v?: string) => Number(v ?? 0);
  return {
    vsComputer: { won: n(get("ai")?.won), lost: n(get("ai")?.lost), drawn: n(get("ai")?.drawn) },
    vsPlayers: { won: n(get("pvp")?.won), lost: n(get("pvp")?.lost), drawn: n(get("pvp")?.drawn) },
  };
}

export const money = (cents: number, currency = "usd") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
