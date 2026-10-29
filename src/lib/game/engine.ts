/**
 * Rules engine for the Volcano Racers card battle ("toon physics, real scars").
 *
 * Pure and deterministic: the same seed and actions always give the same match. The browser
 * runs it for matches against the computer; the server runs the same code for matches between
 * players, so nobody can fake a result. See docs/GAME.md for the rules in plain words.
 */
import { card, DECK_RULES, type CardDef } from "./cards";

export const RULES = { finish: 40, trackSlots: 3, startHand: 5, maxHand: 8, maxFuel: 6, turnLimit: 15 } as const;

export type Side = 0 | 1;
export type CardRef = { uid: string; cardId: string };
export type Racer = {
  uid: string; cardId: string;
  scars: number; bounceLeft: number; punchLoss: number;
  car: { uid: string; cardId: string; armor: number } | null;
  acted: boolean; stalled: boolean; boost: number; justPlayed: boolean;
};
export type PlayerState = {
  name: string; deck: CardRef[]; hand: CardRef[]; track: Racer[]; field: CardRef[]; scrap: CardRef[];
  distance: number; fuel: number; turns: number;
};
export type GameState = {
  v: 1; rng: number; active: Side; players: [PlayerState, PlayerState];
  winner: Side | "draw" | null; log: string[]; seq: number;
};

export type Action =
  | { type: "play"; uid: string; target?: string } // target: own racer uid for cars/pit tricks, enemy racer uid for attacks
  | { type: "bump"; racer: string; target: string }
  | { type: "ability"; racer: string; target?: string }
  | { type: "end" }
  | { type: "concede" };

export class GameError extends Error {}

// ---------- randomness (mulberry32, state kept in the game so replays match) ----------
function nextRand(s: GameState): number {
  let t = (s.rng = (s.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function shuffle<T>(s: GameState, arr: T[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(nextRand(s) * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// ---------- deck checks ----------
export function deckProblems(cardIds: string[]): string[] {
  const out: string[] = [];
  if (cardIds.length !== DECK_RULES.size) out.push(`A deck needs exactly ${DECK_RULES.size} cards (this one has ${cardIds.length}).`);
  const counts = new Map<string, number>();
  let racers = 0;
  for (const id of cardIds) {
    let c: CardDef;
    try { c = card(id); } catch { out.push(`Unknown card ${id}.`); continue; }
    if (c.kind === "collectible") { out.push(`${c.name} is a collectible and can't go in a deck.`); continue; }
    counts.set(id, (counts.get(id) ?? 0) + 1);
    if (c.kind === "racer") racers++;
  }
  // Copy limits count every printing of a character together (a Full Art Blaze is still Blaze).
  const byCharacter = new Map<string, { n: number; c: CardDef }>();
  for (const [id, n] of counts) {
    const c = card(id);
    const e = byCharacter.get(c.character) ?? { n: 0, c };
    e.n += n;
    if (c.rarity === "legendary" || c.rarity === "secret") e.c = c;
    byCharacter.set(c.character, e);
  }
  for (const { n, c } of byCharacter.values()) {
    const max = c.rarity === "legendary" || c.rarity === "secret" ? DECK_RULES.maxLegendaryCopies : DECK_RULES.maxCopies;
    if (n > max) out.push(`${c.name.replace(" (Full Art)", "")}: at most ${max} ${max === 1 ? "copy" : "copies"} per deck.`);
  }
  if (racers < DECK_RULES.minRacers) out.push(`A deck needs at least ${DECK_RULES.minRacers} racers (this one has ${racers}).`);
  return out;
}

// ---------- setup ----------
export function newGame(opts: { seed: number; names: [string, string]; decks: [string[], string[]]; first?: Side }): GameState {
  opts.decks.forEach((d, i) => {
    const p = deckProblems(d);
    if (p.length) throw new GameError(`Deck ${i + 1}: ${p[0]}`);
  });
  const s: GameState = {
    v: 1, rng: opts.seed | 0, active: 0, winner: null, log: [], seq: 0,
    players: [0, 1].map((i) => ({
      name: opts.names[i], deck: opts.decks[i].map((cardId, n) => ({ uid: `p${i}c${n}`, cardId })),
      hand: [], track: [], field: [], scrap: [], distance: 0, fuel: 0, turns: 0,
    })) as unknown as [PlayerState, PlayerState],
  };
  for (const p of s.players) {
    shuffle(s, p.deck);
    for (let k = 0; k < RULES.startHand; k++) draw(s, p);
  }
  s.active = opts.first ?? (nextRand(s) < 0.5 ? 0 : 1);
  log(s, `${s.players[s.active].name} starts.`);
  startTurn(s, true);
  return s;
}

// ---------- derived numbers ----------
const enemyOf = (side: Side): Side => (side === 0 ? 1 : 0);
const has = (p: PlayerState, cardId: string) => p.track.some((r) => r.cardId === cardId);
const fieldHas = (p: PlayerState, cardId: string) => p.field.some((f) => f.cardId === cardId);

export function racerStats(s: GameState, side: Side, r: Racer) {
  const def = card(r.cardId);
  const me = s.players[side];
  const foe = s.players[enemyOf(side)];
  const carDef = r.car ? card(r.car.cardId) : null;
  let pace = def.pace! + (carDef?.car?.pace ?? 0);
  if (carDef?.car?.homeDriver.includes(def.id)) pace += 1;
  if (def.ability?.id === "tag_along" && me.track.some((o) => o.uid !== r.uid && (o.cardId === "vr-ember" || ["vr-flicker", "vr-cinder", "vr-spark"].includes(o.cardId)))) pace += 1;
  if (def.ability?.id === "junior_champ" && has(me, "vr-quackers")) pace += 1;
  if (fieldHas(foe, "vr-airship")) pace = Math.max(1, pace - 1);
  const punch = Math.max(1, def.punch! - r.punchLoss + (carDef?.car?.punch ?? 0));
  const bounce = def.bounce! + (carDef?.car?.bounce ?? 0) + (fieldHas(me, "vr-garage") ? 1 : 0);
  return { pace, punch, bounce, grit: def.grit!, gritLeft: def.grit! - r.scars };
}

// ---------- helpers ----------
function log(s: GameState, line: string) {
  s.log.push(line);
  if (s.log.length > 200) s.log.splice(0, s.log.length - 200);
}
function draw(s: GameState, p: PlayerState, n = 1) {
  for (let i = 0; i < n; i++) {
    const c = p.deck.shift();
    if (!c) return;
    if (p.hand.length >= RULES.maxHand) { p.scrap.push(c); continue; }
    p.hand.push(c);
  }
}
function findRacer(s: GameState, side: Side, uid: string | undefined) {
  const r = uid ? s.players[side].track.find((x) => x.uid === uid) : undefined;
  return r ?? null;
}
function bumpable(s: GameState, side: Side, r: Racer) {
  // Cinder hides behind things.
  return !(card(r.cardId).ability?.id === "hides" && s.players[side].track.length > 1);
}

/** Gag damage: bounce soaks it first (toon physics), then the car, then it becomes scars (real scars). */
function gag(s: GameState, side: Side, r: Racer, amount: number): { pastBounce: number } {
  const def = card(r.cardId);
  if (def.ability?.id === "gags_bounce") amount = Math.floor(amount / 2);
  const soaked = Math.min(r.bounceLeft, amount);
  r.bounceLeft -= soaked;
  let rest = amount - soaked;
  const pastBounce = rest;
  if (soaked) log(s, `BOING. ${def.name} bounces off ${soaked}.`);
  if (rest > 0 && r.car) {
    const car = r.car;
    const taken = Math.min(car.armor, rest);
    car.armor -= taken;
    rest -= taken;
    log(s, `${card(car.cardId).name} takes ${taken}.`);
    if (car.armor <= 0) {
      const p = s.players[side];
      const back = { uid: car.uid, cardId: car.cardId };
      if (p.hand.length < RULES.maxHand) p.hand.push(back); else p.scrap.push(back);
      r.car = null;
      log(s, `${card(car.cardId).name} accordions. It'll be back next panel (returned to hand).`);
    }
    rest = 0; // the car takes the whole hit when it accordions
  }
  if (rest > 0) scar(s, side, r, rest);
  return { pastBounce };
}
function scar(s: GameState, side: Side, r: Racer, amount: number) {
  if (amount <= 0) return;
  r.scars += amount;
  const def = card(r.cardId);
  log(s, `${def.name} takes ${amount} scar${amount > 1 ? "s" : ""}. ${def.grit! - r.scars > 0 ? `${def.grit! - r.scars} grit left.` : ""}`.trim());
  if (r.scars >= def.grit!) wreck(s, side, r);
}
function wreck(s: GameState, side: Side, r: Racer) {
  const p = s.players[side];
  p.track = p.track.filter((x) => x.uid !== r.uid);
  p.scrap.push({ uid: r.uid, cardId: r.cardId });
  if (r.car) {
    const back = { uid: r.car.uid, cardId: r.car.cardId };
    if (p.hand.length < RULES.maxHand) p.hand.push(back); else p.scrap.push(back);
  }
  log(s, `${card(r.cardId).name} is out of the race.`);
}

function startTurn(s: GameState, first = false) {
  const p = s.players[s.active];
  p.turns++;
  p.fuel = Math.min(RULES.maxFuel, p.turns);
  for (const r of p.track) {
    r.acted = false; r.justPlayed = false; r.boost = 0;
    r.bounceLeft = racerStats(s, s.active, r).bounce; // pop back
  }
  if (!first) draw(s, p);
  log(s, `${p.name}, turn ${p.turns}: ${p.fuel} fuel.`);
}

function finishCheck(s: GameState) {
  for (const side of [0, 1] as Side[]) {
    if (s.players[side].distance >= RULES.finish) {
      s.winner = side;
      log(s, `${s.players[side].name} crosses the finish line!`);
      return;
    }
  }
  const [a, b] = s.players;
  if (a.turns >= RULES.turnLimit && b.turns >= RULES.turnLimit) {
    s.winner = a.distance === b.distance ? "draw" : a.distance > b.distance ? 0 : 1;
    log(s, s.winner === "draw" ? "Out of laps. A dead heat." : `Out of laps. ${s.players[s.winner].name} is ahead.`);
  }
  // A team with nothing left to race with loses.
  for (const side of [0, 1] as Side[]) {
    const p = s.players[side];
    if (!s.winner && p.track.length === 0 && p.deck.length === 0 && !p.hand.some((c) => card(c.cardId).kind === "racer")) {
      s.winner = enemyOf(side);
      log(s, `${p.name} has no racers left.`);
    }
  }
}

// ---------- actions ----------
export function apply(prev: GameState, side: Side, action: Action): GameState {
  if (prev.winner !== null) throw new GameError("The race is over.");
  if (action.type !== "concede" && side !== prev.active) throw new GameError("It isn't your turn.");
  const s: GameState = structuredClone(prev);
  s.seq++;
  const me = s.players[side];
  const foeSide = enemyOf(side);
  const foe = s.players[foeSide];

  switch (action.type) {
    case "concede":
      s.winner = foeSide;
      log(s, `${me.name} pulls into the pits for good.`);
      return s;

    case "play": {
      const idx = me.hand.findIndex((c) => c.uid === action.uid);
      if (idx < 0) throw new GameError("That card isn't in your hand.");
      const ref = me.hand[idx];
      const def = card(ref.cardId);
      if (def.cost > me.fuel) throw new GameError(`${def.name} needs ${def.cost} fuel; you have ${me.fuel}.`);
      const own = findRacer(s, side, action.target);
      const enemy = findRacer(s, foeSide, action.target);
      const spend = () => { me.fuel -= def.cost; me.hand.splice(idx, 1); };

      if (def.kind === "racer") {
        if (me.track.length >= RULES.trackSlots) throw new GameError(`Your track is full (${RULES.trackSlots} racers).`);
        spend();
        const r: Racer = { uid: ref.uid, cardId: ref.cardId, scars: 0, bounceLeft: 0, punchLoss: 0, car: null, acted: false, stalled: false, boost: 0, justPlayed: true };
        me.track.push(r);
        r.bounceLeft = racerStats(s, side, r).bounce;
        log(s, `${me.name} sends out ${def.name}.`);
      } else if (def.kind === "car") {
        if (!own) throw new GameError("Pick one of your racers to drive it.");
        const driver = card(own.cardId);
        if (!driver.canDrive) throw new GameError(`${driver.name} doesn't drive.`);
        if (own.car) throw new GameError(`${driver.name} already has a car.`);
        spend();
        own.car = { uid: ref.uid, cardId: ref.cardId, armor: def.car!.armor };
        own.bounceLeft += def.car!.bounce;
        log(s, `${driver.name} gets behind the wheel of ${def.name}.`);
      } else if (def.kind === "field") {
        if (def.ability?.id === "claw_smog") {
          if (!enemy) throw new GameError("Pick an enemy racer for the claw.");
          spend();
          me.field.push(ref);
          log(s, `The GearCorp airship looms. The claw drops on ${card(enemy.cardId).name}.`);
          scar(s, foeSide, enemy, 3);
        } else {
          if (fieldHas(me, ref.cardId)) throw new GameError(`${def.name} is already in play.`);
          spend();
          me.field.push(ref);
          for (const r of me.track) r.bounceLeft += 1;
          log(s, `${me.name} plays ${def.name}.`);
        }
      } else {
        // trick
        const id = def.ability!.id;
        const needsEnemy = ["oil_slick", "net_cannon", "boxing_glove", "sticker_drone"].includes(id);
        const needsOwn = ["pit_stop", "nitro"].includes(id);
        if (needsEnemy && !enemy) throw new GameError("Pick an enemy racer.");
        if (needsOwn && !own) throw new GameError("Pick one of your racers.");
        spend();
        me.scrap.push(ref);
        log(s, `${me.name} plays ${def.name}.`);
        if (id === "draw2") draw(s, me, 2);
        if (id === "oil_slick") { enemy!.stalled = true; log(s, `${card(enemy!.cardId).name} spins out.`); }
        if (id === "net_cannon") gag(s, foeSide, enemy!, 3);
        if (id === "boxing_glove") {
          if (gag(s, foeSide, enemy!, 2).pastBounce > 0) { foe.distance = Math.max(0, foe.distance - 2); log(s, `${foe.name} loses 2 distance.`); }
        }
        if (id === "sticker_drone") scar(s, foeSide, enemy!, 1);
        if (id === "pit_stop") {
          own!.bounceLeft = racerStats(s, side, own!).bounce + 2;
          if (own!.car) own!.car.armor = card(own!.car.cardId).car!.armor;
        }
        if (id === "nitro") own!.boost += 3;
      }
      break;
    }

    case "bump": {
      const r = findRacer(s, side, action.racer);
      if (!r) throw new GameError("Pick one of your racers.");
      if (r.acted) throw new GameError(`${card(r.cardId).name} has already acted this turn.`);
      if (r.justPlayed) throw new GameError(`${card(r.cardId).name} just arrived and can only race this turn.`);
      const t = findRacer(s, foeSide, action.target);
      if (!t) throw new GameError("Pick an enemy racer.");
      if (!bumpable(s, foeSide, t)) throw new GameError(`${card(t.cardId).name} is hiding behind another racer.`);
      r.acted = true;
      const { punch } = racerStats(s, side, r);
      log(s, `${card(r.cardId).name} bumps ${card(t.cardId).name} for ${punch}.`);
      gag(s, foeSide, t, punch);
      break;
    }

    case "ability": {
      const r = findRacer(s, side, action.racer);
      if (!r) throw new GameError("Pick one of your racers.");
      const def = card(r.cardId);
      const ab = def.ability;
      if (!ab?.activated) throw new GameError(`${def.name} has no ability to use.`);
      if (r.acted) throw new GameError(`${def.name} has already acted this turn.`);
      const t = findRacer(s, foeSide, action.target);
      const needsTarget = ["backfire", "sneaky_lever", "sneeze"].includes(ab.id);
      if (needsTarget && !t) throw new GameError("Pick an enemy racer.");
      if (ab.id === "push_wreck" && !me.scrap.some((c) => card(c.cardId).kind === "car")) throw new GameError("There's no car in your scrap pile.");
      if (ab.id === "gearbet" && foe.hand.length === 0) throw new GameError("Their hand is empty.");
      r.acted = true;
      log(s, `${def.name}: ${ab.name}.`);
      switch (ab.id) {
        case "sprint": r.boost += 3; r.acted = false; r.justPlayed = false; raceNow(s, side, r); scar(s, side, r, 1); break;
        case "backfire": gag(s, foeSide, t!, 2); gag(s, side, r, 1); if (findRacer(s, side, r.uid)) raceNow(s, side, r); break;
        case "push_wreck": {
          const i = me.scrap.findIndex((c) => card(c.cardId).kind === "car");
          const [c] = me.scrap.splice(i, 1);
          if (me.hand.length < RULES.maxHand) me.hand.push(c); else me.scrap.push(c);
          log(s, `${card(c.cardId).name} is back in the garage.`);
          break;
        }
        case "tinker": draw(s, me); break;
        case "sneaky_lever": {
          const { punch } = racerStats(s, side, r);
          if (gag(s, foeSide, t!, punch + 2).pastBounce === 0) { log(s, "It backfires. “I meant to do that.”"); gag(s, side, r, 2); }
          break;
        }
        case "fire_breath":
          for (const e of [...foe.track]) gag(s, foeSide, e, 2);
          r.punchLoss += 1;
          log(s, "Ember's fire fades a little.");
          break;
        case "sneeze": gag(s, foeSide, t!, 1); if (findRacer(s, side, r.uid)) raceNow(s, side, r); break;
        case "gearbet": {
          const i = Math.floor(nextRand(s) * foe.hand.length);
          const [c] = foe.hand.splice(i, 1);
          foe.scrap.push(c);
          log(s, `${foe.name} loses ${card(c.cardId).name} on a bad bet.`);
          break;
        }
      }
      break;
    }

    case "end": {
      for (const r of me.track) {
        if (r.acted) continue;
        if (r.stalled) { r.stalled = false; log(s, `${card(r.cardId).name} is still spinning.`); continue; }
        raceNow(s, side, r, false);
      }
      finishCheck(s);
      if (s.winner !== null) return s;
      s.active = foeSide;
      startTurn(s);
      finishCheck(s);
      return s;
    }
  }
  finishCheck(s);
  return s;
}

function raceNow(s: GameState, side: Side, r: Racer, markActed = true) {
  const { pace } = racerStats(s, side, r);
  const go = pace + r.boost;
  s.players[side].distance += go;
  if (markActed) r.acted = true;
  log(s, `${card(r.cardId).name} races ${go}. ${s.players[side].name}: ${s.players[side].distance}/${RULES.finish}.`);
}

/** What the given side may see: the opponent's hand and both decks are hidden. */
export function viewFor(s: GameState, side: Side) {
  const hide = (cards: CardRef[]) => cards.map((c, i) => ({ uid: `hidden${i}`, cardId: "hidden" }));
  const players = s.players.map((p, i) => ({
    ...p,
    deck: p.deck.length,
    hand: i === side ? p.hand : hide(p.hand),
  }));
  return { ...s, rng: 0, players };
}
export type GameView = ReturnType<typeof viewFor>;
