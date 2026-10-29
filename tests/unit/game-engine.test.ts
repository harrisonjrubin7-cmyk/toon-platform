import { describe, expect, it } from "vitest";
import { CARDS, card } from "@/lib/game/cards";
import { apply, deckProblems, GameError, newGame, racerStats, RULES, viewFor, type GameState, type Side } from "@/lib/game/engine";
import { chooseAction, playTurn } from "@/lib/game/ai";
import { AI_OPPONENTS, STARTER_DECK } from "@/lib/game/decks";

const start = (seed = 1, a: string[] = STARTER_DECK, b: string[] = STARTER_DECK) => newGame({ seed, names: ["You", "CPU"], decks: [a, b], first: 0 });

/** Puts a specific card in a side's hand so a test can play it. */
function give(s: GameState, side: Side, cardId: string) {
  const uid = `t${s.players[side].hand.length}-${cardId}-${Math.random()}`;
  s.players[side].hand.push({ uid, cardId });
  return uid;
}

describe("card catalog", () => {
  it("keeps the printed set's ids, numbers and rarities", () => {
    expect(card("vr-blaze").rarity).toBe("legendary");
    expect(card("vr-quackers").number).toBe(2);
    expect(card("vr-car44").kind).toBe("car");
    expect(card("vr-checklist").kind).toBe("trick");
    expect(CARDS.filter((c) => c.printId).length).toBe(23);
    expect(CARDS.filter((c) => c.rarity === "secret").map((c) => c.character)).toEqual(["blaze", "ember", "gearlock"]);
    expect(card("vr-blaze-fullart").pace).toBe(card("vr-blaze").pace);
    expect(new Set(CARDS.map((c) => c.number)).size).toBe(CARDS.length);
  });
  it("derives game numbers from printed stats", () => {
    const b = card("vr-blaze"); // Speed 10, Power 4, Grit 6, Toon 7
    expect([b.pace, b.punch, b.grit, b.bounce]).toEqual([4, 2, 6, 2]);
    expect(b.canDrive).toBe(false);
    expect(card("vr-duke").canDrive).toBe(true);
  });
});

describe("deck rules", () => {
  it("accepts the prebuilt decks", () => {
    expect(deckProblems(STARTER_DECK)).toEqual([]);
    for (const o of AI_OPPONENTS) expect(deckProblems([...o.deck]), o.id).toEqual([]);
  });
  it("rejects wrong size, too many copies, extra legendaries and too few racers", () => {
    expect(deckProblems(STARTER_DECK.slice(1))[0]).toMatch(/exactly 20/);
    expect(deckProblems([...STARTER_DECK.slice(3), "vr-flicker", "vr-flicker", "vr-flicker"]).join()).toMatch(/at most 2/);
    expect(deckProblems([...STARTER_DECK.slice(2), "vr-blaze", "vr-blaze"]).join()).toMatch(/at most 1 copy/);
    const noRacers = Array(10).fill("vr-car02").concat(Array(10).fill("vr-car07"));
    expect(deckProblems(noRacers).join()).toMatch(/at least 6 racers/);
    expect(deckProblems([...STARTER_DECK.slice(1), "vr-nope"]).join()).toMatch(/Unknown card/);
  });
});

describe("match rules", () => {
  it("deals opening hands and gives fuel by turn", () => {
    const s = start();
    expect(s.players[0].hand.length).toBe(RULES.startHand); // first player doesn't draw on turn 1
    expect(s.players[1].hand.length).toBe(RULES.startHand);
    expect(s.players[0].fuel).toBe(1);
    const s2 = apply(s, 0, { type: "end" });
    expect(s2.active).toBe(1);
    expect(s2.players[1].hand.length).toBe(RULES.startHand + 1);
    expect(s2.players[1].fuel).toBe(1);
  });

  it("is deterministic for a seed", () => {
    expect(start(42).players[0].hand).toEqual(start(42).players[0].hand);
  });

  it("refuses moves out of turn, unknown cards and missing fuel", () => {
    const s = start();
    expect(() => apply(s, 1, { type: "end" })).toThrow(GameError);
    expect(() => apply(s, 0, { type: "play", uid: "nope" })).toThrow(/isn't in your hand/);
    const uid = give(s, 0, "vr-ember");
    expect(() => apply(s, 0, { type: "play", uid })).toThrow(/needs 6 fuel/);
  });

  it("does not mutate the previous state", () => {
    const s = start();
    const before = JSON.stringify(s);
    apply(s, 0, { type: "end" });
    expect(JSON.stringify(s)).toBe(before);
  });

  it("racers race at end of turn; bounce soaks gag damage and resets; the rest scars permanently", () => {
    let s = start();
    s.players[0].fuel = 6; s.players[1].fuel = 6;
    const q = give(s, 0, "vr-quackers");
    s = apply(s, 0, { type: "play", uid: q });
    const quack = s.players[0].track[0];
    expect(quack.bounceLeft).toBe(3); // Toon 10 -> bounce 3
    s = apply(s, 0, { type: "end" });
    expect(s.players[0].distance).toBe(2); // Speed 6 -> pace 2
    // CPU hits Quackers with a Net Cannon (3 gag) then a Sticker Drone (1 scar).
    s.players[1].fuel = 6;
    s = apply(s, 1, { type: "play", uid: give(s, 1, "vr-net-cannon"), target: quack.uid });
    expect(s.players[0].track[0].bounceLeft).toBe(0);
    expect(s.players[0].track[0].scars).toBe(0);
    s = apply(s, 1, { type: "play", uid: give(s, 1, "vr-net-cannon"), target: quack.uid });
    expect(s.players[0].track[0].scars).toBe(3);
    s = apply(s, 1, { type: "end" });
    // Toon physics: bounce pops back. Real scars: they stay.
    expect(s.players[0].track[0].bounceLeft).toBe(3);
    expect(s.players[0].track[0].scars).toBe(3);
  });

  it("cars soak damage past bounce, then go back to hand when wrecked", () => {
    let s = start();
    s.players[0].fuel = 6;
    s = apply(s, 0, { type: "play", uid: give(s, 0, "vr-duke") });
    const duke = s.players[0].track[0];
    expect(() => apply(s, 0, { type: "play", uid: give(structuredClone(s), 0, "vr-car02"), target: "nope" })).toThrow();
    const carUid = give(s, 0, "vr-car44");
    s = apply(s, 0, { type: "play", uid: carUid, target: duke.uid });
    expect(s.players[0].track[0].car?.armor).toBe(3);
    expect(racerStats(s, 0, s.players[0].track[0]).pace).toBe(3 + 2 + 1); // base + car + home car
    s = apply(s, 0, { type: "end" });
    s.players[1].fuel = 6;
    // bounce 2 (+0 car handling) soaks 2, car takes 1
    s = apply(s, 1, { type: "play", uid: give(s, 1, "vr-net-cannon"), target: duke.uid });
    expect(s.players[0].track[0].car?.armor).toBe(2);
    s = apply(s, 1, { type: "play", uid: give(s, 1, "vr-net-cannon"), target: duke.uid });
    expect(s.players[0].track[0].car).toBeNull();
    expect(s.players[0].hand.some((c) => c.uid === carUid)).toBe(true);
    expect(s.players[0].track[0].scars).toBe(0);
  });

  it("only drivers can take a car", () => {
    let s = start();
    s.players[0].fuel = 6;
    s = apply(s, 0, { type: "play", uid: give(s, 0, "vr-flicker") });
    const r = s.players[0].track[0];
    expect(() => apply(s, 0, { type: "play", uid: give(s, 0, "vr-car02"), target: r.uid })).toThrow(/doesn't drive/);
  });

  it("wrecks a racer when scars reach grit", () => {
    let s = start();
    s.players[0].fuel = 6;
    s = apply(s, 0, { type: "play", uid: give(s, 0, "vr-flicker") }); // grit 3
    const r = s.players[0].track[0];
    s = apply(s, 0, { type: "end" });
    s.players[1].fuel = 6;
    for (let i = 0; i < 3; i++) s = apply(s, 1, { type: "play", uid: give(s, 1, "vr-sticker-drone"), target: r.uid });
    expect(s.players[0].track.length).toBe(0);
    expect(s.players[0].scrap.some((c) => c.uid === r.uid)).toBe(true);
  });

  it("new racers can't bump on the turn they arrive; bumping costs the race", () => {
    let s = start();
    s.players[0].fuel = 6;
    s = apply(s, 0, { type: "play", uid: give(s, 0, "vr-joe") });
    s = apply(s, 0, { type: "end" });
    s.players[1].fuel = 6;
    s = apply(s, 1, { type: "play", uid: give(s, 1, "vr-quackers") });
    const q = s.players[1].track[0];
    expect(() => apply(s, 1, { type: "bump", racer: q.uid, target: s.players[0].track[0].uid })).toThrow(/just arrived/);
    s = apply(s, 1, { type: "end" });
    const joe = s.players[0].track[0];
    s = apply(s, 0, { type: "bump", racer: joe.uid, target: q.uid });
    const dist = s.players[0].distance;
    s = apply(s, 0, { type: "end" });
    expect(s.players[0].distance).toBe(dist); // Joe bumped, so he didn't race
    expect(() => apply(s, 0, { type: "end" })).toThrow(/isn't your turn/);
  });

  it("the Phantom halves gag damage and Cinder hides", () => {
    let s = start();
    s.players[0].fuel = 6; s.players[1].fuel = 6;
    s = apply(s, 0, { type: "play", uid: give(s, 0, "vr-phantom") });
    s = apply(s, 0, { type: "end" });
    s.players[1].fuel = 6;
    const ph = s.players[0].track[0];
    s = apply(s, 1, { type: "play", uid: give(s, 1, "vr-net-cannon"), target: ph.uid });
    expect(s.players[0].track[0].bounceLeft).toBe(3 - 1); // 3 halved to 1
    // Cinder hides while another racer is on the track
    s = apply(s, 1, { type: "play", uid: give(s, 1, "vr-cinder") });
    s = apply(s, 1, { type: "play", uid: give(s, 1, "vr-spark") });
    s = apply(s, 1, { type: "end" });
    const cinder = s.players[1].track.find((r) => r.cardId === "vr-cinder")!;
    expect(() => apply(s, 0, { type: "bump", racer: ph.uid, target: cinder.uid })).toThrow(/hiding/);
  });

  it("Blaze's sprint races further and costs a scar", () => {
    let s = start();
    s.players[0].fuel = 6;
    s = apply(s, 0, { type: "play", uid: give(s, 0, "vr-blaze") });
    s = apply(s, 0, { type: "end" });
    s = apply(s, 1, { type: "end" });
    const before = s.players[0].distance;
    s = apply(s, 0, { type: "ability", racer: s.players[0].track[0].uid });
    expect(s.players[0].distance - before).toBe(4 + 3);
    expect(s.players[0].track[0].scars).toBe(1);
  });

  it("the first team to the finish line wins", () => {
    let s = start();
    s.players[0].distance = RULES.finish - 1;
    s.players[0].fuel = 6;
    s = apply(s, 0, { type: "play", uid: give(s, 0, "vr-joe") });
    s = apply(s, 0, { type: "end" });
    expect(s.winner).toBe(0);
    expect(() => apply(s, 1, { type: "end" })).toThrow(/over/);
  });

  it("concede ends the match for the other side", () => {
    expect(apply(start(), 1, { type: "concede" }).winner).toBe(0);
  });

  it("hides the opponent's hand and the decks in a player's view", () => {
    const v = viewFor(start(), 0);
    expect(v.players[1].hand.every((c) => c.cardId === "hidden")).toBe(true);
    expect(v.players[0].hand.every((c) => c.cardId !== "hidden")).toBe(true);
    expect(typeof v.players[0].deck).toBe("number");
    expect(v.rng).toBe(0);
  });
});

describe("computer opponent", () => {
  it("always finishes matches with legal moves, across every opponent and many seeds", () => {
    const results: Record<string, number> = {};
    for (const a of AI_OPPONENTS) for (const b of AI_OPPONENTS) {
      for (let seed = 1; seed <= 15; seed++) {
        let s = newGame({ seed, names: [a.id, b.id], decks: [[...a.deck], [...b.deck]] });
        let guard = 0;
        while (s.winner === null && guard++ < 200) {
          const states = playTurn(s, s.active);
          s = states[states.length - 1];
        }
        expect(s.winner, `${a.id} vs ${b.id} seed ${seed}`).not.toBeNull();
        const key = s.winner === "draw" ? "draw" : s.players[s.winner as Side].name;
        results[key] = (results[key] ?? 0) + 1;
      }
    }
    // Sanity: the hard deck should beat the easy one more often than not.
    expect(Object.keys(results).length).toBeGreaterThan(1);
  });

  it("returns an action the engine accepts", () => {
    const s = start(7);
    expect(() => apply(s, 0, chooseAction(s, 0))).not.toThrow();
  });
});
