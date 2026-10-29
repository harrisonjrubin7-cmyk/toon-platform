/** Prebuilt decks: the free starter every account gets, and the computer's opponents. */
const expand = (list: Record<string, number>) => Object.entries(list).flatMap(([id, n]) => Array<string>(n).fill(`vr-${id}`));

/** Granted free to every account the first time they open the game, so anyone can battle without buying. */
export const STARTER_DECK = expand({
  flicker: 2, cinder: 2, spark: 2, quackers: 1, joe: 1, pip: 1, duke: 1,
  car02: 1, car07: 1, car11: 1, car44: 1,
  "oil-slick": 2, "sticker-drone": 2, "pit-stop": 2,
});

export const AI_OPPONENTS = [
  {
    id: "cinder-isle", name: "Cinder Isle Garage",
    blurb: "The home team's starter deck, the same one you get.",
    deck: STARTER_DECK,
  },
  {
    id: "gearcorp", name: "Team GearCorp",
    blurb: "Baron Gearlock, the Phantom and the airship. Chrome, logos and dirty tricks.",
    deck: expand({
      gearlock: 1, phantom: 1, airship: 1, duke: 2, wren: 2, spark: 2,
      car44: 2, car19: 2, "net-cannon": 2, "boxing-glove": 2, "sticker-drone": 2, "oil-slick": 1,
    }),
  },
  {
    id: "ember-flight", name: "Ember's Brood",
    blurb: "A lonely dragon dad and three hatchlings who just want friends.",
    deck: expand({
      ember: 1, blaze: 1, flicker: 2, cinder: 2, spark: 2, pip: 2, quackers: 2,
      car02: 2, car11: 2, garage: 1, nitro: 2, "pit-stop": 1,
    }),
  },
] as const;

export const aiOpponent = (id: string) => AI_OPPONENTS.find((o) => o.id === id) ?? null;
