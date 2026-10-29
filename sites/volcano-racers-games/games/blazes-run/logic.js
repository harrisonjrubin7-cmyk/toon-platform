// Blaze's Run rules. Units are metres and seconds; y is height above the ground.
// Pure logic, tested in Node.

export const GRAVITY = 32;
export const JUMP_V = 11;
export const STAND_H = 1.6;
export const SLIDE_H = 0.7;
export const BLAZE_W = 0.9;
export const START_SPEED = 9;
export const MAX_SPEED = 19;
export const ACCEL = 0.11; // m/s per second
export const KNEE_LIMIT = 3; // hits before Blaze has to stop
export const GLOW_BOLTS = 12; // bolts to fill the glow meter
export const GLOW_SECONDS = 4.5;
export const COYOTE = 0.1;
export const BUFFER = 0.14;
export const SLIDE_MIN = 0.45;
export const SLIDE_MAX = 1.1;
export const DRONE_SPEED = 3;
export const DRONE_SWOOP_RANGE = 25;
const DRONE_SWOOP_EXTRA = 8; // drones close in by up to ~8 m, so leave that much more room

export function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

export function createRun(seed = 1) {
  const run = {
    rand: rng(seed),
    t: 0,
    dist: 0,
    speed: START_SPEED,
    y: 0, vy: 0,
    onGround: true,
    sinceGround: 0,
    jumpBuffer: 0,
    sliding: 0, // seconds left of slide
    knee: 0,
    invuln: 0,
    flat: 0, // squashed-flat gag timer
    soot: 0,
    glow: 0, // meter 0..GLOW_BOLTS
    glowing: 0, // seconds left of glow
    bolts: 0,
    obstacles: [],
    pickups: [],
    shadows: [], // shadows left behind at top speed
    nextAt: 30,
    over: false,
    events: [],
  };
  fillAhead(run);
  return run;
}

// Obstacle kinds. x is the leading edge distance, w its length.
//  crack: gap in the ground, jump it.  boulder: jump it.  smoke: overhang, slide under it.  drone: low flyer, jump it.
export function blazeBox(run) {
  const h = run.sliding > 0 ? SLIDE_H : STAND_H;
  return { x0: run.dist - BLAZE_W / 2, x1: run.dist + BLAZE_W / 2, y0: run.y, y1: run.y + h };
}

function overlaps(a, b) {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
}

export function obstacleBox(o) {
  switch (o.kind) {
    case 'crack': return { x0: o.x + 0.3, x1: o.x + o.w - 0.3, y0: -10, y1: -0.3 }; // only once she sinks in
    case 'boulder': return { x0: o.x, x1: o.x + o.w, y0: 0, y1: o.h };
    case 'smoke': return { x0: o.x, x1: o.x + o.w, y0: 1.0, y1: 6 };
    case 'drone': return { x0: o.x, x1: o.x + o.w, y0: o.y, y1: o.y + 0.5 };
    default: return { x0: 0, x1: 0, y0: 0, y1: 0 };
  }
}

// Keep the course generated ~120 m ahead. Gaps scale with speed so every
// obstacle can be reacted to and cleared (the test suite checks this with a bot).
function fillAhead(run) {
  const r = run.rand;
  while (run.nextAt < run.dist + 120) {
    const level = Math.min(1, run.dist / 1500);
    const roll = r();
    let o;
    if (roll < 0.3) o = { kind: 'crack', x: run.nextAt, w: 1.4 + r() * (0.8 + level * 1.0) };
    else if (roll < 0.55) o = { kind: 'boulder', x: run.nextAt, w: 0.9, h: 0.7 + r() * 0.35 };
    else if (roll < 0.8) o = { kind: 'smoke', x: run.nextAt, w: 1.6 + r() * (1.2 + level) };
    else o = { kind: 'drone', x: run.nextAt + DRONE_SWOOP_EXTRA, w: 0.8, y: 0.15 + r() * 0.35 };
    run.obstacles.push(o);
    // Bolts: an arc over jump obstacles, a line under smoke.
    if (o.kind === 'smoke') {
      for (let i = 0; i < 3; i++) run.pickups.push({ x: o.x + 0.4 + i * 0.7, y: 0.35, taken: false });
    } else if (r() < 0.6) {
      for (let i = 0; i < 3; i++) run.pickups.push({ x: o.x + o.w / 2 - 1 + i, y: 1.6 + (i === 1 ? 0.5 : 0), taken: false });
    }
    // Room to land and react before the next one.
    const speedAt = Math.min(MAX_SPEED, START_SPEED + ACCEL * (run.t + (run.nextAt - run.dist) / Math.max(1, run.speed)));
    const gap = speedAt * (0.95 + r() * 0.9 - level * 0.2) + o.w + 3;
    run.nextAt += Math.max(speedAt * 0.85 + o.w + 3, gap) + (o.kind === 'drone' ? DRONE_SWOOP_EXTRA : 0);
  }
  // Drop what is far behind.
  run.obstacles = run.obstacles.filter((o) => o.x + o.w > run.dist - 20);
  run.pickups = run.pickups.filter((p) => p.x > run.dist - 20);
  run.shadows = run.shadows.filter((s) => s.x > run.dist - 40);
}

// input: { jump: pressed this frame, jumpHeld, slide: held }
export function stepRun(run, input, dt) {
  run.events.length = 0;
  if (run.over) return;
  run.t += dt;
  run.invuln = Math.max(0, run.invuln - dt);
  run.flat = Math.max(0, run.flat - dt);
  run.soot = Math.max(0, run.soot - dt);

  if (run.glowing > 0) {
    run.glowing = Math.max(0, run.glowing - dt);
    if (run.glowing === 0) run.events.push({ type: 'glow-end' });
  }
  const base = Math.min(MAX_SPEED, START_SPEED + ACCEL * run.t);
  run.speed = run.flat > 0 ? base * 0.35 : run.glowing > 0 ? base * 1.6 : base;
  run.dist += run.speed * dt;
  for (const sh of run.shadows) { sh.v = Math.max(0, sh.v - 6 * dt); sh.x += sh.v * dt; }

  // Jump with coyote time and input buffer, variable height.
  if (input.jump) run.jumpBuffer = BUFFER;
  else run.jumpBuffer = Math.max(0, run.jumpBuffer - dt);
  run.sinceGround = run.onGround ? 0 : run.sinceGround + dt;
  if (run.jumpBuffer > 0 && run.sinceGround <= COYOTE && run.flat <= 0) {
    run.vy = JUMP_V;
    run.onGround = false;
    run.sinceGround = COYOTE + 1;
    run.jumpBuffer = 0;
    run.sliding = 0;
    run.events.push({ type: 'jump' });
  }
  if (!input.jumpHeld && run.vy > 4) run.vy = 4; // short hop when released early

  // Slide: hold to keep sliding (up to SLIDE_MAX), a tap gives SLIDE_MIN.
  if (input.slide && run.onGround && run.flat <= 0) {
    if (run.sliding <= 0) { run.sliding = SLIDE_MIN; run.slideTime = 0; run.events.push({ type: 'slide' }); }
    run.slideTime = (run.slideTime || 0) + dt;
    if (run.slideTime < SLIDE_MAX) run.sliding = Math.max(run.sliding, 0.05);
  }
  if (!input.slide) run.slideTime = 0;
  if (input.slide && !run.onGround && run.flat <= 0) {
    run.vy = Math.min(run.vy, -14); // fast-fall, tucked low, into a slide
    run.sliding = Math.max(run.sliding, 0.05);
  }
  run.sliding = Math.max(0, run.sliding - dt);

  // Gravity; the ground is solid except over cracks.
  const overCrack = run.obstacles.some((o) => o.kind === 'crack' && run.dist > o.x + 0.3 && run.dist < o.x + o.w - 0.3);
  run.vy -= GRAVITY * dt;
  run.y += run.vy * dt;
  if (run.y <= 0 && !(overCrack && run.glowing <= 0 && run.invuln <= 0)) {
    if (!run.onGround) run.events.push({ type: 'land' });
    run.y = 0; run.vy = 0; run.onGround = true;
  } else if (run.y > 0 || overCrack) {
    run.onGround = run.y <= 0 && !overCrack;
  }

  // Collisions
  const me = blazeBox(run);
  for (const o of run.obstacles) {
    if (o.hit) continue;
    if (o.kind === 'drone' && o.x - run.dist < DRONE_SWOOP_RANGE) o.x -= DRONE_SPEED * dt; // swoops at her when close
    if (!overlaps(me, obstacleBox(o))) continue;
    if (run.glowing > 0) { o.hit = true; run.events.push({ type: 'smash', kind: o.kind }); continue; }
    if (run.invuln > 0) continue;
    o.hit = true;
    hit(run, o.kind);
  }
  if (run.y < -1.2) {
    // Fell into a crack: toon physics pops her back out, sooty.
    run.y = 0; run.vy = JUMP_V * 0.7; run.onGround = false;
    run.soot = 1.2;
    if (run.invuln <= 0) hit(run, 'crack');
  }

  for (const p of run.pickups) {
    if (p.taken) continue;
    if (Math.abs(p.x - run.dist) < 0.7 && p.y > me.y0 - 0.3 && p.y < me.y1 + 0.3) {
      p.taken = true;
      run.bolts++;
      run.events.push({ type: 'bolt' });
      if (run.glowing <= 0) {
        run.glow = Math.min(GLOW_BOLTS, run.glow + 1);
        if (run.glow >= GLOW_BOLTS) startGlow(run);
      }
    }
  }
  fillAhead(run);
}

function hit(run, kind) {
  run.knee++;
  run.invuln = 1.4;
  run.flat = 0.7;
  if (kind === 'crack') run.soot = 1.2;
  run.events.push({ type: 'hit', kind, knee: run.knee });
  if (run.knee >= KNEE_LIMIT) {
    run.over = true;
    run.events.push({ type: 'over' });
  }
}

function startGlow(run) {
  run.glow = 0;
  run.glowing = GLOW_SECONDS;
  // Canon gag: at top speed she leaves her own shadow behind.
  run.shadows.push({ x: run.dist, v: run.speed, t: run.t }); // it tries to keep up, then gives up panting
  run.events.push({ type: 'glow' });
}

export function metres(run) {
  return Math.floor(run.dist);
}

export function coinsFor(run) {
  return Math.floor(run.dist / 50) + Math.floor(run.bolts / 3);
}
