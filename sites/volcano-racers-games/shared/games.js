// The five Volcano Racers games, in lineup order.
import { CARD_BATTLE_URL } from './config.js';

export const GAMES = [
  {
    id: 'card-battle',
    n: 1,
    title: 'Card Battle',
    stars: 'the whole cast',
    blurb: 'Build a deck of Volcano Racers cards and battle. Lives on the main Tune site and needs a free account, because your collection is saved there.',
    href: CARD_BATTLE_URL || null,
    external: true,
    pending: 'Opens when the main Tune site goes live.',
    color: '#E8262B',
  },
  {
    id: 'circuit-rush',
    n: 2,
    title: 'Circuit Rush',
    stars: 'Quackers, Joe, Pip, Duke and Wren',
    blurb: 'Pick a car and race a three-track cup around the volcano. Bounce off walls, dodge lava, keep the dents.',
    href: 'games/circuit-rush/',
    color: '#FFC72C',
    records: [
      { key: 'cupWins', label: 'Cup wins' },
      { key: 'best-cinder-loop', label: 'Best race time, Cinder Isle Loop', time: true },
    ],
  },
  {
    id: 'blazes-run',
    n: 3,
    title: "Blaze's Run",
    stars: 'Blaze',
    blurb: 'Blaze races on foot. Jump lava cracks, slide under rockfalls and outrun your own shadow.',
    href: 'games/blazes-run/',
    color: '#FF5A1F',
    records: [{ key: 'best', label: 'Best distance', unit: 'm' }],
  },
  {
    id: 'embers-flight',
    n: 4,
    title: "Ember's Flight",
    stars: 'Ember, Flicker, Cinder and Spark',
    blurb: 'Fly Ember over Cinder Isle, gather the hatchlings and keep your fire lit while Gearlock’s drones close in.',
    href: 'games/embers-flight/',
    color: '#FF8A3D',
    records: [{ key: 'best', label: 'Best score' }],
  },
  {
    id: 'pit-crew',
    n: 5,
    title: 'Pit Crew',
    stars: 'Pip and the team cars',
    blurb: 'Fix the damage your cars took in Circuit Rush before the clock runs out. Every repair is real.',
    href: 'games/pit-crew/',
    color: '#2A6FDB',
    records: [{ key: 'best', label: 'Best repair score' }],
  },
];
