/**
 * The computer opponent. Greedy and readable on purpose: it fills the track, puts drivers in
 * cars, finishes off damaged racers, and otherwise races. Good enough to learn the game against.
 */
import { card } from "./cards";
import { apply, GameError, racerStats, type Action, type GameState, type Racer, type Side } from "./engine";

const effectiveHp = (s: GameState, side: Side, r: Racer) => racerStats(s, side, r).gritLeft + r.bounceLeft + (r.car?.armor ?? 0);

/** Next action for `side`. Always returns something legal; falls back to ending the turn. */
export function chooseAction(s: GameState, side: Side): Action {
  const me = s.players[side];
  const foeSide: Side = side === 0 ? 1 : 0;
  const foe = s.players[foeSide];
  const ok = (a: Action) => { try { apply(s, side, a); return true; } catch (e) { if (e instanceof GameError) return false; throw e; } };
  const weakestFoe = [...foe.track].sort((a, b) => effectiveHp(s, foeSide, a) - effectiveHp(s, foeSide, b));
  const strongestFoe = [...foe.track].sort((a, b) => racerStats(s, foeSide, b).pace - racerStats(s, foeSide, a).pace);

  // 1. Racers, most expensive first.
  const hand = [...me.hand].sort((a, b) => card(b.cardId).cost - card(a.cardId).cost);
  for (const c of hand) {
    const def = card(c.cardId);
    if (def.kind === "racer" && ok({ type: "play", uid: c.uid })) return { type: "play", uid: c.uid };
  }
  // 2. Cars on drivers, home cars first.
  for (const c of hand) {
    const def = card(c.cardId);
    if (def.kind !== "car") continue;
    const drivers = me.track.filter((r) => card(r.cardId).canDrive && !r.car)
      .sort((a, b) => Number(def.car!.homeDriver.includes(b.cardId)) - Number(def.car!.homeDriver.includes(a.cardId)));
    for (const r of drivers) if (ok({ type: "play", uid: c.uid, target: r.uid })) return { type: "play", uid: c.uid, target: r.uid };
  }
  // 3. Field cards and tricks.
  for (const c of hand) {
    const def = card(c.cardId);
    if (def.kind === "field" || def.kind === "trick") {
      const id = def.ability?.id;
      const targets = ["pit_stop", "nitro"].includes(id ?? "") ? me.track : id === "oil_slick" ? strongestFoe : weakestFoe;
      if (id === "draw2" && ok({ type: "play", uid: c.uid })) return { type: "play", uid: c.uid };
      if (id === "garage" && ok({ type: "play", uid: c.uid })) return { type: "play", uid: c.uid };
      for (const t of targets) if (ok({ type: "play", uid: c.uid, target: t.uid })) return { type: "play", uid: c.uid, target: t.uid };
    }
  }
  // 4. Each racer: finish a racer it can wreck, use a useful ability, or leave it to race.
  const behind = foe.distance > me.distance + 4;
  for (const r of me.track) {
    if (r.acted) continue;
    const def = card(r.cardId);
    const { punch } = racerStats(s, side, r);
    const kill = weakestFoe.find((t) => effectiveHp(s, foeSide, t) <= punch);
    if (kill && ok({ type: "bump", racer: r.uid, target: kill.uid })) return { type: "bump", racer: r.uid, target: kill.uid };
    const ab = def.ability;
    if (ab?.activated) {
      const target = weakestFoe[0]?.uid;
      const want =
        (ab.id === "sprint" && racerStats(s, side, r).gritLeft > 2) ||
        ["backfire", "sneeze", "tinker", "gearbet", "push_wreck"].includes(ab.id) ||
        (ab.id === "fire_breath" && foe.track.length >= 2) ||
        (ab.id === "sneaky_lever" && behind);
      if (want && ok({ type: "ability", racer: r.uid, target })) return { type: "ability", racer: r.uid, target };
    }
    if (behind && strongestFoe[0] && ok({ type: "bump", racer: r.uid, target: strongestFoe[0].uid }) && punch >= 2) {
      return { type: "bump", racer: r.uid, target: strongestFoe[0].uid };
    }
  }
  return { type: "end" };
}

/** Plays the computer's whole turn and returns every intermediate state (for animation). */
export function playTurn(s: GameState, side: Side, maxSteps = 40): GameState[] {
  const states: GameState[] = [];
  let cur = s;
  for (let i = 0; i < maxSteps && cur.winner === null && cur.active === side; i++) {
    const a = i === maxSteps - 1 ? ({ type: "end" } as const) : chooseAction(cur, side);
    cur = apply(cur, side, a);
    states.push(cur);
  }
  return states;
}
