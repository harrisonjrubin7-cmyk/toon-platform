import { describe, expect, it } from "vitest";
import { withTx } from "@/lib/db";
import * as cards from "@/lib/domain/cards";
import { disclose, rollPack, oddsSchema, type PackOdds } from "@/lib/game/packs";
import { STARTER_DECK } from "@/lib/game/decks";
import { CARDS } from "@/lib/game/cards";
import { signForTest, verifyWebhook } from "@/lib/payments/stripe";
import { makeUser, pool, q } from "./helpers";

const tx = <T>(fn: (t: typeof q) => Promise<T>) => withTx(fn, pool);
const testStore: cards.StoreConfig = { provider: "test", blockedCountries: ["BE"], dailyCapCents: 5000 };
const PRODUCT = "ember-heart-booster";

function seq(values: number[]) {
  let i = 0;
  return () => values[i++ % values.length];
}

describe("pack odds", () => {
  const odds = oddsSchema.parse({
    slots: [{ count: 3, weights: { common: 100 } }, { count: 1, weights: { rare: 78, epic: 16, legendary: 5, secret: 1 } }, { count: 1, weights: { common: 60, rare: 27, epic: 9, legendary: 3, secret: 1 } }],
    variants: { base: 88, reverse_holo: 10, scar_foil: 2 },
  });

  it("rejects malformed odds", () => {
    expect(() => oddsSchema.parse({ slots: [{ count: 1, weights: { mythic: 1 } }], variants: { base: 1 } })).toThrow();
    expect(() => oddsSchema.parse({ slots: [{ count: 1, weights: { common: 0 } }], variants: { base: 1 } })).toThrow();
  });

  it("rolls the advertised number of cards, best last", () => {
    const pulls = rollPack(odds, Math.random);
    expect(pulls).toHaveLength(5);
    const order = ["common", "rare", "epic", "legendary"];
    for (let i = 1; i < pulls.length; i++) expect(order.indexOf(pulls[i].rarity)).toBeGreaterThanOrEqual(order.indexOf(pulls[i - 1].rarity));
  });

  it("discloses odds that match a large simulation", () => {
    const d = disclose(odds);
    expect(d.size).toBe(5);
    expect(d.slots[1].chances.legendary).toBeCloseTo(0.05);
    const n = 20000;
    let legendaryPacks = 0;
    const r = (() => { let s = 12345; return () => ((s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31); })();
    for (let i = 0; i < n; i++) if (rollPack(odds, r).some((p) => p.rarity === "legendary")) legendaryPacks++;
    expect(legendaryPacks / n).toBeCloseTo(d.byRarity.legendary, 1);
    // Every card in the set can be pulled and the chances are shown for each.
    expect(d.byCard).toHaveLength(CARDS.length);
    expect(d.byCard.every((c) => c.chance > 0)).toBe(true);
  });
});

describe("collection and starter", () => {
  it("grants the starter deck once", async () => {
    const u = await makeUser();
    expect(await tx((t) => cards.ensureStarter(t, u))).toBe(true);
    expect(await tx((t) => cards.ensureStarter(t, u))).toBe(false);
    const owned = await cards.getCollection(q, u);
    expect(owned.reduce((a, o) => a + o.quantity, 0)).toBe(STARTER_DECK.length);
    const decks = await cards.listDecks(q, u);
    expect(decks).toHaveLength(1);
    expect(decks[0].problems).toEqual([]);
    const sum = cards.portfolio(owned);
    expect(sum.copies).toBe(20);
    expect(sum.points).toBeGreaterThan(0);
  });

  it("requires a signed-in adult", async () => {
    await expect(cards.getCollection(q, null)).rejects.toMatchObject({ code: "unauthenticated" });
    const u = await makeUser();
    await expect(cards.getCollection(q, { ...u, ageConfirmed: false })).rejects.toMatchObject({ code: "forbidden" });
  });
});

describe("decks", () => {
  it("only saves cards you own, and catches stale saves", async () => {
    const u = await makeUser();
    await tx((t) => cards.ensureStarter(t, u));
    await expect(cards.saveDeck(q, u, { name: "Cheater", cards: ["vr-blaze"] })).rejects.toThrow(/own 0 of Blaze/);
    await expect(cards.saveDeck(q, u, { name: "", cards: [] })).rejects.toMatchObject({ code: "invalid" });
    const d = await cards.saveDeck(q, u, { name: "Draft", cards: STARTER_DECK.slice(0, 10) });
    expect(d.problems[0]).toMatch(/exactly 20/);
    await expect(cards.playableDeck(q, u, d.id)).rejects.toThrow(/isn't ready/);
    const d2 = await cards.saveDeck(q, u, { id: d.id, name: "Full", cards: STARTER_DECK, version: d.version });
    expect(d2.version).toBe(2);
    await expect(cards.saveDeck(q, u, { id: d.id, name: "Old tab", cards: STARTER_DECK, version: 1 })).rejects.toMatchObject({ code: "conflict" });
    expect((await cards.playableDeck(q, u, d.id)).problems).toEqual([]);
  });

  it("keeps decks private to their owner", async () => {
    const a = await makeUser();
    const b = await makeUser();
    await tx((t) => cards.ensureStarter(t, a));
    await tx((t) => cards.ensureStarter(t, b));
    const [deck] = await cards.listDecks(q, a);
    await expect(cards.getDeck(q, b, deck.id)).rejects.toMatchObject({ code: "not_found" });
    await expect(cards.saveDeck(q, b, { id: deck.id, name: "Mine now", cards: [] })).rejects.toMatchObject({ code: "not_found" });
    await expect(cards.deleteDeck(q, b, deck.id)).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("buying and opening packs", () => {
  it("is off until a payment provider is configured", async () => {
    const u = await makeUser();
    await expect(cards.startPurchase(q, u, { productId: PRODUCT, quantity: 1 }, { country: "US", config: { ...testStore, provider: "off" } })).rejects.toThrow(/aren't switched on/);
  });

  it("blocks listed countries and enforces the daily cap", async () => {
    const u = await makeUser();
    await expect(cards.startPurchase(q, u, { productId: PRODUCT, quantity: 1 }, { country: "be", config: testStore })).rejects.toThrow(/country/);
    await expect(cards.startPurchase(q, u, { productId: PRODUCT, quantity: 10 }, { country: "US", config: { ...testStore, dailyCapCents: 1000 } })).rejects.toThrow(/daily limit/);
    await expect(cards.startPurchase(q, u, { productId: PRODUCT, quantity: 11 }, { country: "US", config: testStore })).rejects.toMatchObject({ code: "invalid" });
  });

  it("fulfils a paid purchase exactly once, and opening is repeatable", async () => {
    const u = await makeUser();
    await tx((t) => cards.ensureStarter(t, u));
    const p = await cards.startPurchase(q, u, { productId: PRODUCT, quantity: 2 }, { country: "US", config: testStore });
    expect(p.amountCents).toBe(598);
    await expect(tx((t) => cards.fulfillPurchase(t, p.purchaseId, { provider: "stripe" }))).rejects.toThrow(/mismatch/);
    await expect(tx((t) => cards.fulfillPurchase(t, p.purchaseId, { provider: "test", amountCents: 1 }))).rejects.toThrow(/amount/);
    expect((await tx((t) => cards.fulfillPurchase(t, p.purchaseId, { provider: "test", amountCents: 598 }))).fulfilled).toBe(true);
    expect((await tx((t) => cards.fulfillPurchase(t, p.purchaseId, { provider: "test" }))).fulfilled).toBe(false);
    const sealed = await cards.sealedPacks(q, u);
    expect(sealed).toHaveLength(2);

    const first = await tx((t) => cards.openPack(t, u, sealed[0].id));
    expect(first.fresh).toBe(true);
    expect(first.pulls).toHaveLength(5);
    const again = await tx((t) => cards.openPack(t, u, sealed[0].id));
    expect(again.fresh).toBe(false);
    expect(again.pulls).toEqual(first.pulls);
    expect(await cards.sealedPacks(q, u)).toHaveLength(1);
    const owned = await cards.getCollection(q, u);
    expect(owned.reduce((a, o) => a + o.quantity, 0)).toBe(25);
  });

  it("doesn't let another player open your pack", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const p = await cards.startPurchase(q, a, { productId: PRODUCT, quantity: 1 }, { country: null, config: testStore });
    await tx((t) => cards.fulfillPurchase(t, p.purchaseId, { provider: "test" }));
    const [pack] = await cards.sealedPacks(q, a);
    await expect(tx((t) => cards.openPack(t, b, pack.id))).rejects.toMatchObject({ code: "not_found" });
    await expect(cards.getPurchase(q, b, p.purchaseId)).rejects.toMatchObject({ code: "not_found" });
  });

  it("uses the odds the pack was sold with, even if the studio changes them later", async () => {
    const admin = await makeUser("admin");
    const u = await makeUser();
    const p = await cards.startPurchase(q, u, { productId: PRODUCT, quantity: 1 }, { country: null, config: testStore });
    await tx((t) => cards.fulfillPurchase(t, p.purchaseId, { provider: "test" }));
    const product = await cards.getProduct(q, PRODUCT);
    const allLegendary: PackOdds = { slots: [{ count: 5, weights: { legendary: 1 } }], variants: { base: 1 } };
    await tx((t) => cards.updateProduct(t, admin, { id: PRODUCT, name: product.name, description: product.description, priceCents: product.priceCents, active: "true", odds: JSON.stringify(allLegendary), version: product.version }));
    const [pack] = await cards.sealedPacks(q, u);
    const opened = await tx((t) => cards.openPack(t, u, pack.id, seq([0.01, 0.5])));
    expect(opened.pulls.filter((x) => x.rarity === "common").length).toBeGreaterThanOrEqual(3);
    // restore
    const now = await cards.getProduct(q, PRODUCT);
    await tx((t) => cards.updateProduct(t, admin, { id: PRODUCT, name: now.name, description: now.description, priceCents: now.priceCents, active: "true", odds: JSON.stringify(product.odds), version: now.version }));
  });

  it("lets only admins change the store or grant packs", async () => {
    const reader = await makeUser();
    const editor = await makeUser("editor");
    const admin = await makeUser("admin");
    await expect(tx((t) => cards.grantPacks(t, editor, { email: reader.email, productId: PRODUCT, quantity: 1 }))).rejects.toMatchObject({ code: "forbidden" });
    await expect(cards.storeReport(q, reader)).rejects.toMatchObject({ code: "forbidden" });
    await tx((t) => cards.grantPacks(t, admin, { email: reader.email, productId: PRODUCT, quantity: 3 }));
    expect(await cards.sealedPacks(q, reader)).toHaveLength(3);
    const product = await cards.getProduct(q, PRODUCT);
    await expect(tx((t) => cards.updateProduct(t, admin, { id: PRODUCT, name: "x", priceCents: 299, active: "true", odds: "{bad", version: product.version }))).rejects.toMatchObject({ code: "invalid" });
    await expect(tx((t) => cards.updateProduct(t, admin, { id: PRODUCT, name: "x", priceCents: 299, active: "true", odds: JSON.stringify(product.odds), version: product.version - 1 }))).rejects.toMatchObject({ code: "conflict" });
    const report = await cards.storeReport(q, admin);
    expect(report.packs.length).toBeGreaterThan(0);
  });
});

describe("sharing and match records", () => {
  it("shows a collection publicly only when the player opts in", async () => {
    const u = await makeUser();
    await tx((t) => cards.ensureStarter(t, u));
    await expect(cards.publicCollector(q, u.id)).rejects.toMatchObject({ code: "not_found" });
    await cards.setPublicCollection(q, u, true);
    const pub = await cards.publicCollector(q, u.id);
    expect(pub.summary.copies).toBe(20);
    expect(pub).not.toHaveProperty("email");
  });

  it("records results against the computer", async () => {
    const u = await makeUser();
    await cards.recordAiMatch(q, u, { opponent: "gearcorp", result: "win" });
    await cards.recordAiMatch(q, u, { opponent: "gearcorp", result: "loss" });
    const p = await cards.getProfile(q, u);
    expect(p.vsComputer).toEqual({ won: 1, lost: 1, drawn: 0 });
  });
});

describe("stripe webhook signatures", () => {
  it("accepts a valid signature and rejects tampering or old timestamps", () => {
    const body = JSON.stringify({ id: "evt_1" });
    const sig = signForTest(body, "whsec_test");
    expect(verifyWebhook(body, sig, "whsec_test")).toBe(true);
    expect(verifyWebhook(body + " ", sig, "whsec_test")).toBe(false);
    expect(verifyWebhook(body, sig, "whsec_other")).toBe(false);
    expect(verifyWebhook(body, signForTest(body, "whsec_test", 1000), "whsec_test")).toBe(false);
    expect(verifyWebhook(body, null, "whsec_test")).toBe(false);
  });
});
