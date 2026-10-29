/**
 * Pack odds: validation, the exact per-card chances shown to buyers, and the roll itself.
 * The randomness source is passed in, so the server uses crypto and tests use a fixed sequence.
 */
import { z } from "zod";
import { CARDS, RARITIES, DIGITAL_VARIANTS, type CardDef, type Rarity, type Variant } from "./cards";

const weights = <K extends string>(keys: readonly K[]) =>
  z.record(z.string(), z.number().min(0)).refine((w) => Object.keys(w).every((k) => (keys as readonly string[]).includes(k)), "Unknown key")
    .refine((w) => Object.values(w).some((v) => v > 0), "At least one weight must be above zero");

export const oddsSchema = z.object({
  slots: z.array(z.object({ count: z.number().int().min(1).max(10), weights: weights(RARITIES) })).min(1).max(10),
  variants: weights(DIGITAL_VARIANTS),
});
export type PackOdds = z.infer<typeof oddsSchema>;

/** Cards that can come out of packs: everything in the set. Grouped by rarity. */
export function pool(): Record<Rarity, CardDef[]> {
  const out = Object.fromEntries(RARITIES.map((r) => [r, [] as CardDef[]])) as Record<Rarity, CardDef[]>;
  for (const c of CARDS) out[c.rarity].push(c);
  return out;
}

const norm = (w: Record<string, number>) => {
  const total = Object.values(w).reduce((a, b) => a + b, 0);
  return Object.fromEntries(Object.entries(w).map(([k, v]) => [k, v / total]));
};

export function packSize(odds: PackOdds) {
  return odds.slots.reduce((a, s) => a + s.count, 0);
}

/**
 * What a buyer sees: per slot, the chance of each rarity; per pack, the chance of at least one
 * card of each rarity; and per card, the chance it appears at least once. Rarities with no
 * cards in the pool are dropped and the remaining weights rescaled, exactly as the roll does.
 */
export function disclose(odds: PackOdds) {
  const p = pool();
  const slotRarity = odds.slots.map((s) => {
    const w = Object.fromEntries(Object.entries(s.weights).filter(([r]) => p[r as Rarity].length > 0));
    return { count: s.count, chances: norm(w) as Partial<Record<Rarity, number>> };
  });
  const variants = norm(odds.variants) as Record<Variant, number>;
  const atLeastOne = (perSlot: (chances: Partial<Record<Rarity, number>>) => number) =>
    1 - slotRarity.reduce((miss, s) => miss * Math.pow(1 - perSlot(s.chances), s.count), 1);
  const byRarity = Object.fromEntries(RARITIES.map((r) => [r, atLeastOne((c) => c[r] ?? 0)])) as Record<Rarity, number>;
  const byCard = CARDS.map((c) => ({ card: c, chance: atLeastOne((ch) => (ch[c.rarity] ?? 0) / p[c.rarity].length) }));
  return { size: packSize(odds), slots: slotRarity, variants, byRarity, byCard };
}

export type Pull = { cardId: string; variant: Variant; rarity: Rarity; serial?: number };

/** random() must return a uniform number in [0, 1). */
export function rollPack(odds: PackOdds, random: () => number): Pull[] {
  const p = pool();
  const pick = <K extends string>(w: Record<string, number>): K => {
    const entries = Object.entries(w).filter(([, v]) => v > 0);
    const total = entries.reduce((a, [, v]) => a + v, 0);
    let x = random() * total;
    for (const [k, v] of entries) { if ((x -= v) < 0) return k as K; }
    return entries[entries.length - 1][0] as K;
  };
  const out: Pull[] = [];
  for (const slot of odds.slots) {
    const usable = Object.fromEntries(Object.entries(slot.weights).filter(([r]) => p[r as Rarity].length > 0));
    for (let i = 0; i < slot.count; i++) {
      const rarity = pick<Rarity>(usable);
      const list = p[rarity];
      const c = list[Math.min(list.length - 1, Math.floor(random() * list.length))];
      out.push({ cardId: c.id, rarity, variant: pick<Variant>(odds.variants) });
    }
  }
  // Show the best card last, like a real rip.
  const rank = (x: Pull) => RARITIES.indexOf(x.rarity) * 10 + DIGITAL_VARIANTS.indexOf(x.variant);
  return out.sort((a, b) => rank(a) - rank(b));
}

/**
 * Collector points for the portfolio. Points are a game score for showing off, not a price:
 * cards have no cash value and can't be sold or cashed out.
 */
export const POINTS: Record<Rarity, number> = { common: 1, rare: 5, epic: 20, legendary: 50, secret: 150 };
export const VARIANT_MULTIPLIER: Record<Variant, number> = { base: 1, reverse_holo: 2, scar_foil: 10 };
export const pointsFor = (rarity: Rarity, variant: Variant) => POINTS[rarity] * VARIANT_MULTIPLIER[variant];

export const pct = (x: number) => (x >= 0.995 ? "100%" : x < 0.001 ? "<0.1%" : `${(x * 100).toFixed(x < 0.1 ? 1 : 0)}%`);
