/**
 * Volcano Racers card catalog for the card battle game.
 *
 * Cards 01–20 come from the printed trading card set (data/vr1-print.json, a copy of
 * /mnt/project-files/trading-cards/cards.json owned by the trading cards work). Their
 * ids, names, rarities and printed stats are kept as-is so physical and digital cards match.
 * Game numbers are derived from the printed 1–10 stats by the formulas below, so a change to
 * the printed stats flows straight into the game. Cards 21+ are digital-only trick cards.
 *
 * Everything here is a proposal until the owner approves the set.
 */
import print from "./data/vr1-print.json";

export const SET_CODE = "vr1";
/** "secret" = Full Art secret rares (numbered past the set total, e.g. 21/20). */
export const RARITIES = ["common", "rare", "epic", "legendary", "secret"] as const;
export type Rarity = (typeof RARITIES)[number];
/**
 * Cosmetic parallels a digital copy can have. Scar foil is numbered /50 across all players.
 * "artist_proof" (signed 1/1) and plain holo frames exist only in print.
 */
export const DIGITAL_VARIANTS = ["base", "reverse_holo", "scar_foil"] as const;
export const SCAR_FOIL_RUN = 50;
export type Variant = (typeof DIGITAL_VARIANTS)[number];

export const RARITY_INFO: Record<Rarity, { label: string; glyph: string }> = {
  common: { label: "Common", glyph: "●" },
  rare: { label: "Rare", glyph: "◆" },
  epic: { label: "Epic", glyph: "▲" },
  legendary: { label: "Legendary", glyph: "★" },
  secret: { label: "Full Art secret rare", glyph: "✦" },
};
export const VARIANT_INFO: Record<Variant, { label: string; mark: string }> = {
  base: { label: "Standard", mark: "" },
  reverse_holo: { label: "Reverse holo", mark: "RH" },
  scar_foil: { label: "Scar foil /50", mark: "S" },
};

/** "collectible" cards (e.g. a checklist or a future art-only card) can be owned but not put in a deck. */
export type CardKind = "racer" | "car" | "trick" | "field" | "collectible";

/** What a card does in a match. Engine code switches on these ids. */
export type AbilityId =
  | "sprint" | "backfire" | "push_wreck" | "tinker" | "sneaky_lever" | "fire_breath" | "sneeze" | "gearbet" // activated
  | "hides" | "tag_along" | "junior_champ" | "gags_bounce" // passive
  | "claw_smog" | "garage" // field
  | "draw2" | "oil_slick" | "net_cannon" | "boxing_glove" | "sticker_drone" | "pit_stop" | "nitro"; // tricks

export type CardDef = {
  id: string; // "vr-blaze"
  printId: string | null; // "blaze" in the print set, null for digital-only cards
  character: string; // shared by every printing of one character (deck copy limits count this)
  number: number; // collector number; 1–20 print set, 21+ digital tricks
  name: string;
  role: string;
  kind: CardKind;
  rarity: Rarity;
  cost: number; // fuel
  flavor: string;
  colors: string[];
  printStats: Record<string, number>;
  image: string | null; // web crop of the printed front (500x700), null for digital-only cards
  ability?: { id: AbilityId; name: string; text: string; activated: boolean };
  // racers
  pace?: number; punch?: number; grit?: number; bounce?: number; canDrive?: boolean;
  // cars
  car?: { pace: number; armor: number; punch: number; bounce: number; homeDriver: string[] };
};

/** "character" lets several printings (alt art, parallels, chase cards) share one character's rules. */
type PrintCard = { no: number; id: string; character?: string; variant_of?: string; name: string; kind: string; rarity: Rarity; role: string; colors: string[]; stats: Record<string, number>; flavor: string };

const up = (n: number, d: number) => Math.max(1, Math.ceil(n / d));

/** Proposed balance, not derived: fuel cost per card and who can drive a car. */
const COST: Record<string, number> = {
  blaze: 5, quackers: 3, joe: 3, pip: 2, duke: 3, ember: 6, flicker: 1, cinder: 1, spark: 1, wren: 4, gearlock: 5, phantom: 6,
  airship: 6, car02: 2, car07: 2, car11: 2, car44: 2, car19: 2, garage: 3, checklist: 1,
};
// Blaze runs on foot, Ember flies, the hatchlings are dog-sized and the Phantom runs (all locked in the briefs).
const DRIVERS = new Set(["quackers", "joe", "pip", "duke", "wren", "gearlock"]);
const HOME: Record<string, string[]> = { car02: ["vr-quackers", "vr-wren"], car07: ["vr-joe"], car11: ["vr-pip"], car44: ["vr-duke"], car19: ["vr-wren"] };

const ABILITIES: Record<string, CardDef["ability"]> = {
  blaze: { id: "sprint", name: "Sprint", activated: true, text: "Race at +3 pace this turn. Blaze takes 1 scar (the knee)." },
  quackers: { id: "backfire", name: "Backfire", activated: true, text: "Deal 2 gag damage to an enemy racer and 1 to Quackers. He still races." },
  joe: { id: "push_wreck", name: "Push the wreck", activated: true, text: "Return a car from your scrap pile to your hand." },
  pip: { id: "tinker", name: "Tinker", activated: true, text: "Draw a card." },
  duke: { id: "sneaky_lever", name: "SNEAKY lever", activated: true, text: "Deal punch +2 gag damage to an enemy racer. If it all bounces off, Duke takes 2 (“I meant to do that”)." },
  ember: { id: "fire_breath", name: "Fire breath", activated: true, text: "Deal 2 gag damage to every enemy racer. His fire fades: Ember loses 1 punch for the rest of the match." },
  flicker: { id: "sneeze", name: "Sneeze", activated: true, text: "Deal 1 gag damage to an enemy racer. Flicker still races." },
  cinder: { id: "hides", name: "Hides behind things", activated: false, text: "Can't be bumped while another of your racers is on the track." },
  spark: { id: "tag_along", name: "Tag along", activated: false, text: "+1 pace while Ember or another hatchling is on your track." },
  wren: { id: "junior_champ", name: "Junior champ", activated: false, text: "+1 pace while Captain Quackers is on your track." },
  gearlock: { id: "gearbet", name: "Gearbet", activated: true, text: "Your opponent discards a random card from their hand." },
  phantom: { id: "gags_bounce", name: "Gags bounce off", activated: false, text: "Gag damage to the Phantom is halved (round down). Scars still land." },
  airship: { id: "claw_smog", name: "Claw and smog", activated: false, text: "When played, deal 3 scar damage to an enemy racer. While in play, enemy racers have −1 pace (minimum 1)." },
  garage: { id: "garage", name: "Four cars gleam", activated: false, text: "While in play, your racers get +1 bounce." },
  checklist: { id: "draw2", name: "Check the list", activated: false, text: "Draw 2 cards." },
};

const KIND: Record<string, CardKind> = { racer: "racer", hatchling: "racer", villain: "racer", car: "car", "vehicle-villain": "field", scene: "field", checklist: "trick" };

function fromPrint(c: PrintCard): CardDef {
  const who = c.variant_of ?? c.character ?? c.id;
  const kind: CardKind = KIND[c.kind] ?? "collectible";
  const base: CardDef = {
    id: `vr-${c.id}`, printId: c.id, character: who, number: c.no, name: c.name, role: c.role, kind, rarity: c.rarity,
    cost: COST[who] ?? 3, flavor: c.flavor, colors: c.colors, printStats: c.stats, ability: ABILITIES[who],
    image: `/game/cards/${String(c.no).padStart(2, "0")}-${who}.jpg`,
  };
  if (kind === "racer" && ["Speed", "Power", "Grit", "Toon"].some((k) => typeof c.stats[k] !== "number")) return { ...base, kind: "collectible" };
  if (kind === "racer") {
    const s = c.stats;
    return { ...base, pace: up(s.Speed, 3), punch: up(s.Power, 3), grit: s.Grit, bounce: up(s.Toon, 4), canDrive: DRIVERS.has(who) };
  }
  if (kind === "car") {
    const s = c.stats;
    return {
      ...base,
      ability: { id: "push_wreck", name: "Comes back next panel", activated: false, text: "Attach to a racer who drives. Damage past bounce hits the car first. A wrecked car goes back to your hand." },
      car: { pace: up(s["Top speed"], 5), armor: up(s.Toughness, 2), punch: Math.floor(s.Gadgets / 5), bounce: Math.floor(s.Handling / 5), homeDriver: HOME[who] ?? [] },
    };
  }
  return base;
}

const trick = (number: number, id: string, name: string, rarity: Rarity, cost: number, abilityId: AbilityId, text: string, flavor: string): CardDef => ({
  id: `vr-${id}`, printId: null, character: id, number, name, role: "Trick", kind: "trick", rarity, cost, flavor, colors: ["#E8262B", "#2B2422"], printStats: {}, image: null,
  ability: { id: abilityId, name, text, activated: false },
});

/** Digital-only trick cards (numbers 24+; 21–23 are the printed Full Art secret rares). Names come from gadgets and props in the scripts. */
const TRICKS: CardDef[] = [
  trick(24, "oil-slick", "Oil Slick", "common", 1, "oil_slick", "An enemy racer spins out and doesn't race on its next turn.", "Lever position one."),
  trick(25, "net-cannon", "Net Cannon", "rare", 2, "net_cannon", "Deal 3 gag damage to an enemy racer.", "Lever position two."),
  trick(26, "boxing-glove", "Boxing Glove", "rare", 2, "boxing_glove", "Deal 2 gag damage to an enemy racer. If any gets past its bounce, their team loses 2 distance.", "Spring-loaded. Position three."),
  trick(27, "sticker-drone", "Sticker Drone", "common", 1, "sticker_drone", "Deal 1 scar damage to an enemy racer.", "GEARCORP. Right on the forehead."),
  trick(28, "pit-stop", "Pit Stop", "common", 1, "pit_stop", "One of your racers refills its bounce +2, and its car is fully repaired.", "No logos. Just wrenches."),
  trick(29, "nitro", "Nitro", "rare", 2, "nitro", "One of your racers races at +3 pace this turn.", "Hand-painted can. Probably legal."),
];

const printed = print.cards as unknown as PrintCard[];
/**
 * Full Art secret rares (21–23). Until they are listed in the print data, they are built from
 * the base printing of the same character, so they play exactly like it.
 */
const FULL_ART = [[21, "blaze"], [22, "ember"], [23, "gearlock"]] as const;
const fullArt: PrintCard[] = FULL_ART.filter(([no]) => !printed.some((c) => c.no === no)).flatMap(([no, who]) => {
  const base = printed.find((c) => c.id === who);
  return base ? [{ ...base, no, id: `${who}-full-art`, character: who, rarity: "secret" as Rarity, name: `${base.name} (Full Art)` }] : [];
});

export const CARDS: CardDef[] = [...[...printed, ...fullArt].map(fromPrint), ...TRICKS].sort((a, b) => a.number - b.number);
const byId = new Map(CARDS.map((c) => [c.id, c]));

export function card(id: string): CardDef {
  const c = byId.get(id);
  if (!c) throw new Error(`Unknown card ${id}`);
  return c;
}
export const isCard = (id: string) => byId.has(id);
export const collectorNo = (c: CardDef) => `VR-S1 ${String(c.number).padStart(2, "0")}${c.printId ? "/20" : " (digital)"}`;

/** Deck rules, checked on the server when a deck is saved and again when a match starts. */
export const DECK_RULES = { size: 20, maxCopies: 2, maxLegendaryCopies: 1, minRacers: 6 };
