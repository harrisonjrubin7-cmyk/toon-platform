// Volcano Racers cast and cars, taken from "Volcano Racers: Cast and Car Art Briefs"
// (approved 2026-10-29). Colours are the approved proposed hex codes.
// Game stats (speed, grip...) are game-design numbers, not canon.

export const CARS = [
  {
    id: '02',
    number: '#02',
    driver: 'Captain Quackers',
    car: 'Yellow #02 roadster',
    body: '#FFC72C',
    trim: '#F07C1B',
    numberInk: '#161616',
    blurb: 'Smokes, backfires and explodes. The backfire launches it like a rocket.',
    stats: { topSpeed: 7, accel: 9, grip: 6, toughness: 4 },
    special: { id: 'backfire', name: 'Backfire launch', desc: 'A huge burst of speed. Costs a little damage.' },
    shape: 'roadster',
  },
  {
    id: '07',
    number: '#07',
    driver: 'Jackrabbit Joe',
    car: 'Old green #07 cruiser',
    body: '#3C8D40',
    trim: '#F28C28',
    numberInk: '#F6E3C1',
    blurb: 'Long, low and leaning. A tire fell off at inspection. "It’s a style."',
    stats: { topSpeed: 6, accel: 5, grip: 6, toughness: 9 },
    special: { id: 'shrug', name: 'Shrug it off', desc: 'Ignore walls and lava for a few seconds.' },
    shape: 'cruiser',
  },
  {
    id: '11',
    number: '#11',
    driver: 'Pip',
    car: 'Tiny blue #11 gizmo car',
    body: '#2A6FDB',
    trim: '#B5853A',
    numberInk: '#FFFFFF',
    blurb: 'Toaster-sized, full of gizmos. Pop-out wings let it glide over anything.',
    stats: { topSpeed: 6, accel: 7, grip: 9, toughness: 5 },
    special: { id: 'wings', name: 'Pop-out wings', desc: 'Glide over lava and slow ground.' },
    shape: 'micro',
  },
  {
    id: '44',
    number: '#44',
    driver: 'Duke Whiskers',
    car: 'Purple #44 supercar',
    body: '#7B2CBF',
    trim: '#C9CED6',
    numberInk: '#D4AF37',
    blurb: 'Flashy, fast and crammed with illegal gadgets. Steering pulls left 4 degrees.',
    stats: { topSpeed: 10, accel: 6, grip: 5, toughness: 6 },
    special: { id: 'oil', name: 'SNEAKY lever: oil slick', desc: 'Drop an oil slick behind you.' },
    pullLeftDeg: 4,
    shape: 'wedge',
  },
  {
    id: '19',
    number: '#19',
    driver: 'Wren',
    car: 'Green-and-white #19',
    body: '#1F7A4D',
    trim: '#F5F5F0',
    numberInk: '#F5F5F0',
    blurb: 'Lean, modern and clean where her father’s car is battered.',
    stats: { topSpeed: 8, accel: 7, grip: 8, toughness: 6 },
    special: { id: 'slipstream', name: 'Slipstream', desc: 'Steal speed from the car ahead.' },
    shape: 'modern',
  },
];

// Rival used only as an opponent in races.
export const GEARCORP_CAR = {
  id: 'gc',
  number: 'GC',
  driver: 'Team GearCorp',
  car: 'Chrome GearCorp racer',
  body: '#C9CED6',
  trim: '#C9A227',
  numberInk: '#4A4F57',
  stats: { topSpeed: 8, accel: 7, grip: 7, toughness: 7 },
  special: null,
  shape: 'modern',
  logos: true,
};

export const CHARACTERS = {
  blaze: {
    id: 'blaze', name: 'Blaze', fur: '#E8B33A', spots: '#FF5A1F', glow: '#FFC21A',
    bandana: '#E8262B', tights: '#2B2422', brace: '#6B7A8F',
  },
  ember: {
    id: 'ember', name: 'Ember', body: '#FF5A1F', belly: '#F7E1B5', eyes: '#FFB000', faded: '#9A6A5E',
  },
  hatchlings: [
    { id: 'flicker', name: 'Flicker', color: '#E8262B' },
    { id: 'cinder', name: 'Cinder', color: '#7C8FA6' },
    { id: 'spark', name: 'Spark', color: '#FFC21A' },
  ],
  gearlock: { id: 'gearlock', name: 'Baron Gearlock', feathers: '#1F1A24', gold: '#C9A227', brass: '#B08D57', hull: '#4A4F57' },
  phantom: { id: 'phantom', name: 'The Phantom', armor: '#16121A', mask: '#F5F5F0' },
};

export function carById(id) {
  return CARS.find((c) => c.id === id) || null;
}
