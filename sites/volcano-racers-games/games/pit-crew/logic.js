// Pit Crew rules. Pure logic, tested in Node.

export const SHIFT_SECONDS = 60;
export const REPAIR_PER_JOB = 10;
export const MAX_JOBS = 10;
export const COINS_PER_JOB = 5;
export const MISS_PENALTY = 2; // seconds off the clock

export const JOB_TYPES = {
  dent: { name: 'Dent', tool: 'Hammer', how: 'Hit when the marker is in the gold zone. Three good hits fix it.', hits: 3 },
  soot: { name: 'Scorch', tool: 'Sponge', how: 'Hold to scrub until the bar is full.', hold: 1.4 },
  bolts: { name: 'Loose bolts', tool: 'Wrench', how: 'Repeat the arrow pattern Pip shows you.', length: 4 },
};

// Spots on a car where damage can sit, as fractions of the car's drawn box (x along length).
const SPOTS = [
  [0.82, 0.25], [0.82, 0.75], [0.6, 0.12], [0.6, 0.88], [0.4, 0.15],
  [0.4, 0.85], [0.18, 0.25], [0.18, 0.75], [0.5, 0.5], [0.08, 0.5],
];

export function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

// One job per 10% of damage (rounded up), each fixes up to 10%.
// Scars from the race decide the job type where they can: lava -> scorch, walls/rocks -> dents.
export function makeJobs(damage, scars = [], seed = 1) {
  const rand = rng(seed);
  const count = Math.min(MAX_JOBS, Math.ceil(Math.max(0, damage) / REPAIR_PER_JOB));
  const hints = scars.flatMap((s) => {
    const l = s.label.toLowerCase();
    const out = [];
    if (l.includes('lava') || l.includes('scorch')) out.push('soot');
    if (l.includes('wall') || l.includes('rock') || l.includes('dent')) out.push('dent');
    if (l.includes('paint') || l.includes('knock')) out.push('bolts');
    return out;
  });
  const kinds = Object.keys(JOB_TYPES);
  const spots = SPOTS.slice().sort(() => rand() - 0.5);
  let left = Math.max(0, damage);
  const jobs = [];
  for (let i = 0; i < count; i++) {
    const type = hints[i] || kinds[Math.floor(rand() * kinds.length)];
    const repair = Math.min(REPAIR_PER_JOB, left);
    left -= repair;
    jobs.push({ id: `j${i}`, type, x: spots[i][0], y: spots[i][1], repair, done: false });
  }
  return jobs;
}

// Hammer: marker bounces 0..1; gold zone is centred with width w.
export function markerAt(t, speed = 1.2) {
  const p = (t * speed) % 2;
  return p < 1 ? p : 2 - p;
}
export function isGoodHit(marker, zoneCenter = 0.5, zoneWidth = 0.22) {
  return Math.abs(marker - zoneCenter) <= zoneWidth / 2;
}

export const ARROWS = ['up', 'right', 'down', 'left'];
export function makePattern(length, seed) {
  const rand = rng(seed);
  return Array.from({ length }, () => ARROWS[Math.floor(rand() * 4)]);
}

export function score({ jobsDone, timeLeft, misses, practice }) {
  const base = jobsDone * 100 + Math.max(0, Math.round(timeLeft)) * 5 - misses * 10;
  return Math.max(0, practice ? Math.round(base / 2) : base);
}

export function coinsFor(jobsDone, practice) {
  return practice ? 0 : jobsDone * COINS_PER_JOB;
}

export function repairedAmount(jobs) {
  return jobs.filter((j) => j.done).reduce((a, j) => a + j.repair, 0);
}
