// Ember's Flight rules. The sky is 16 units wide and 10 tall; Ember flies right.
// Pure logic, tested in Node.

export const SKY_H = 10;
export const VIEW_W = 16;
export const EMBER_R = 0.7;
export const MOVE_SPEED = 7;
export const START_SCROLL = 4.5;
export const MAX_SCROLL = 9;
export const FIRE_MAX = 100;
export const FIRE_DRAIN = 1.1; // per second, just from flying
export const BREATH_COST = 16; // per second while breathing
export const BREATH_RANGE = 3.2;
export const COAL_FIRE = 14;
export const HIT_FIRE = 22;
export const HATCHLINGS = ['flicker', 'cinder', 'spark'];

export function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

export function createFlight(seed = 1) {
  return {
    rand: rng(seed),
    t: 0,
    dist: 0,
    scroll: START_SCROLL,
    x: 4, y: 5, // Ember, in screen units (x from left edge of the view)
    vx: 0, vy: 0,
    fire: FIRE_MAX,
    breathing: false,
    invuln: 0,
    hug: 0, // happy-hug gag timer when a hatchling is rescued
    trail: [], // past positions, for the hatchlings following behind
    hatchlings: HATCHLINGS.map((id, i) => ({ id, state: 'waiting', at: 8 + i * 22, x: 0, y: 0, bob: i })),
    drones: [],
    coals: [],
    airship: null, // { x, dropAt }
    nextDrone: 3,
    nextCoal: 2,
    nextAirship: 45,
    burned: 0,
    score: 0,
    over: false,
    events: [],
  };
}

export function following(f) {
  return f.hatchlings.filter((h) => h.state === 'follow');
}

// How bright Ember is: 1 = full fire, 0 = grey. Four visible stages, like the fade ladder.
export function fadeStage(fire) {
  if (fire > 75) return 0;
  if (fire > 50) return 1;
  if (fire > 25) return 2;
  return 3;
}

const dist2 = (ax, ay, bx, by) => (ax - bx) ** 2 + (ay - by) ** 2;

// input: { up, down, left, right, breath } (held)
export function stepFlight(f, input, dt) {
  f.events.length = 0;
  if (f.over) return;
  f.t += dt;
  f.scroll = Math.min(MAX_SCROLL, START_SCROLL + f.t * 0.04);
  f.dist += f.scroll * dt;
  f.invuln = Math.max(0, f.invuln - dt);
  f.hug = Math.max(0, f.hug - dt);

  // Movement with a little float
  const ax = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const ay = (input.down ? 1 : 0) - (input.up ? 1 : 0); // screen y grows downward
  f.vx += (ax * MOVE_SPEED - f.vx) * Math.min(1, dt * 6);
  f.vy += (ay * MOVE_SPEED - f.vy) * Math.min(1, dt * 6);
  f.x = Math.max(1.2, Math.min(VIEW_W * 0.6, f.x + f.vx * dt));
  f.y = Math.max(EMBER_R + 0.2, Math.min(SKY_H - 1.4, f.y + f.vy * dt));

  // Fire: drains over time, faster while breathing.
  f.breathing = !!input.breath && f.fire > 0;
  f.fire = Math.max(0, f.fire - (FIRE_DRAIN + (f.breathing ? BREATH_COST : 0)) * dt);

  // Trail of positions for the hatchlings to follow
  f.trail.unshift({ x: f.x, y: f.y });
  if (f.trail.length > 120) f.trail.pop();
  let slot = 0;
  for (const h of f.hatchlings) {
    if (h.state === 'follow') {
      slot++;
      const p = f.trail[Math.min(f.trail.length - 1, slot * 18)] || { x: f.x, y: f.y };
      h.x += (p.x - 0.9 - h.x) * Math.min(1, dt * 8);
      h.y += (p.y + 0.2 - h.y) * Math.min(1, dt * 8);
    } else if (h.state === 'waiting' && f.t >= h.at) {
      h.state = 'lost';
      h.x = VIEW_W + 1;
      h.y = 2 + f.rand() * (SKY_H - 4);
      f.events.push({ type: 'hatchling-appears', id: h.id });
    } else if (h.state === 'lost') {
      h.x -= f.scroll * 0.6 * dt;
      h.y += Math.sin(f.t * 2 + h.bob) * 0.6 * dt;
      if (h.x < -1) { h.state = 'waiting'; h.at = f.t + 6; } // drifted off: comes back later
      if (dist2(h.x, h.y, f.x, f.y) < (EMBER_R + 0.5) ** 2) {
        h.state = 'follow';
        f.hug = 0.8;
        f.events.push({ type: 'rescue', id: h.id });
      }
    }
  }

  spawn(f, dt);

  // Drones
  const kids = following(f).length;
  for (const d of f.drones) {
    d.x += (d.vx - f.scroll) * dt;
    if (d.kind === 'diver') d.vy += 2.2 * dt;
    d.y += d.vy * dt;
    if (d.kind === 'weaver') d.y = d.baseY + Math.sin((f.t + d.phase) * 2.2) * 1.4;
    if (d.dead) continue;
    // Fire breath: a cone in front of Ember
    if (f.breathing) {
      const dx = d.x - f.x, dy = d.y - f.y;
      if (dx > 0 && dx < BREATH_RANGE && Math.abs(dy) < 0.5 + dx * 0.35) {
        d.dead = true;
        f.burned++;
        f.score += 50;
        f.events.push({ type: 'burn', x: d.x, y: d.y });
        continue;
      }
    }
    if (f.invuln <= 0 && dist2(d.x, d.y, f.x, f.y) < (EMBER_R + 0.35) ** 2) {
      d.dead = true;
      f.invuln = 1.5;
      if (kids > 0) {
        // The youngest one gets scared and flies off; go get it back.
        const scared = following(f).pop();
        scared.state = 'lost';
        scared.x = f.x + 4;
        scared.y = Math.max(1.5, Math.min(SKY_H - 2, f.y + (f.rand() < 0.5 ? -2.5 : 2.5)));
        f.events.push({ type: 'scatter', id: scared.id });
      } else {
        f.fire = Math.max(0, f.fire - HIT_FIRE);
        f.events.push({ type: 'hit' });
      }
    }
  }
  f.drones = f.drones.filter((d) => !d.dead && d.x > -2 && d.y < SKY_H + 2);

  // Coals rise from the vents below; each one stokes the fire.
  for (const c of f.coals) {
    c.x -= f.scroll * dt;
    c.y -= c.vy * dt;
    if (!c.taken && dist2(c.x, c.y, f.x, f.y) < (EMBER_R + 0.4) ** 2) {
      c.taken = true;
      f.fire = Math.min(FIRE_MAX, f.fire + COAL_FIRE);
      f.score += 10;
      f.events.push({ type: 'coal' });
    }
  }
  f.coals = f.coals.filter((c) => !c.taken && c.x > -1 && c.y > -1);

  // Score: distance, multiplied by how many hatchlings are with him.
  f.score += f.scroll * dt * (1 + following(f).length);

  if (f.fire <= 0) {
    f.over = true;
    f.events.push({ type: 'over' });
  }
}

function spawn(f, dt) {
  const r = f.rand;
  f.nextDrone -= dt;
  if (f.nextDrone <= 0) {
    const level = Math.min(1, f.t / 150);
    const roll = r();
    const y = 1 + r() * (SKY_H - 3);
    if (roll < 0.5) f.drones.push({ kind: 'drone', x: VIEW_W + 1, y, vx: -1 - r() * 1.5, vy: 0 });
    else if (roll < 0.8) f.drones.push({ kind: 'weaver', x: VIEW_W + 1, y, baseY: y, vx: -1.5, vy: 0, phase: r() * 6 });
    else f.drones.push({ kind: 'diver', x: VIEW_W * (0.5 + r() * 0.5), y: -1, vx: 0, vy: 1.5 });
    f.nextDrone = 1.6 - level * 0.9 + r() * 0.8;
  }
  f.nextCoal -= dt;
  if (f.nextCoal <= 0) {
    f.coals.push({ x: VIEW_W * (0.4 + r() * 0.7), y: SKY_H + 0.5, vy: 1.4 + r() * 1.2 });
    f.nextCoal = 1.1 + r() * 1.4;
  }
  // Gearlock's airship passes overhead now and then and drops a wave.
  f.nextAirship -= dt;
  if (f.nextAirship <= 0 && !f.airship) {
    f.airship = { x: VIEW_W + 8, dropped: 0 };
    f.nextAirship = 50 + r() * 20;
    f.events.push({ type: 'airship' });
  }
  if (f.airship) {
    f.airship.x -= 2.2 * dt;
    if (f.airship.x < VIEW_W * 0.75 && f.airship.dropped < 5 && r() < dt * 2) {
      f.airship.dropped++;
      f.drones.push({ kind: 'diver', x: f.airship.x, y: 1.2, vx: -0.5, vy: 0.5 });
    }
    if (f.airship.x < -10) f.airship = null;
  }
}

export function coinsFor(f) {
  return Math.floor(f.score / 100);
}
