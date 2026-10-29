// Arcade car physics: bouncy toon handling, damage that stays.
// Pure logic; the renderer only reads these objects.

import { nearest, advanceProgress } from './track.js';

export const CAR_RADIUS = 22;
export const WALL_MARGIN = 46; // sand run-off between track edge and the wall
export const SPECIAL_CHARGE_SECONDS = 8;
export const MAX_DAMAGE = 100;

export function statsFor(def) {
  const s = def.stats;
  return {
    topSpeed: 380 + s.topSpeed * 32,
    accel: 260 + s.accel * 40,
    grip: 3 + s.grip * 0.9,
    steer: 2.5 + s.grip * 0.08,
    // How much each hit hurts. Tough cars take less.
    hurt: 1.6 - s.toughness * 0.1,
  };
}

export function createCar(def, { x, y, a, damage = 0, isPlayer = false, skill = 1, lane = 0 }) {
  return {
    def,
    id: def.id,
    st: statsFor(def),
    isPlayer,
    x, y, a,
    vx: 0, vy: 0,
    damage: Math.max(0, Math.min(MAX_DAMAGE, damage)),
    damageTaken: 0, // this race only
    hits: [], // labels for scars
    squash: 0, soot: 0, spin: 0, invuln: 0, glide: 0, boost: 0, wrecked: 0,
    charge: 0,
    inLava: false,
    hint: -1,
    s: 0, lastS: 0, progress: 0, lateral: 0, offTrack: false,
    finished: false, finishTime: 0,
    ai: { skill, lane, laneTarget: lane },
    events: [],
  };
}

export function forwardSpeed(car) {
  return car.vx * Math.cos(car.a) + car.vy * Math.sin(car.a);
}

export function maxSpeedOf(car) {
  // A wrecked (100%) car still runs, at 65%: the scar costs you until it is repaired.
  let m = car.st.topSpeed * (1 - car.damage * 0.0035);
  if (car.offTrack && car.glide <= 0) m *= 0.55;
  if (car.boost > 0) m *= 1.45;
  return m;
}

function hurt(car, amount, label) {
  if (car.invuln > 0 || amount <= 0) return;
  const real = amount * car.st.hurt;
  const before = car.damage;
  car.damage = Math.min(MAX_DAMAGE, car.damage + real);
  car.damageTaken += car.damage - before;
  if (label && real >= 4) car.hits.push(label);
  if (before < MAX_DAMAGE && car.damage >= MAX_DAMAGE) {
    car.wrecked = 1.4; // toon explosion, then it pops back
    car.events.push({ type: 'kaboom' });
  }
}

export function stepCar(car, ctrl, dt, world) {
  const { track } = world;
  for (const k of ['squash', 'soot', 'spin', 'invuln', 'glide', 'boost']) car[k] = Math.max(0, car[k] - dt);

  if (car.wrecked > 0) {
    car.wrecked -= dt;
    car.vx *= Math.exp(-6 * dt);
    car.vy *= Math.exp(-6 * dt);
    if (car.wrecked <= 0) {
      // Pop back onto the racing line, facing the right way.
      const n = nearest(track, car.x, car.y, car.hint);
      car.x = n.px; car.y = n.py; car.a = Math.atan2(n.ty, n.tx);
      car.vx = 0; car.vy = 0;
      car.invuln = 1.5;
      car.events.push({ type: 'pop' });
    }
    updateProgress(car, track);
    return;
  }

  car.charge = Math.min(1, car.charge + dt / SPECIAL_CHARGE_SECONDS);
  if (ctrl.special && car.charge >= 1 && !car.finished) activateSpecial(car, world);

  const fx = Math.cos(car.a), fy = Math.sin(car.a);
  const rx = -fy, ry = fx;
  let vf = car.vx * fx + car.vy * fy;
  let vl = car.vx * rx + car.vy * ry;
  const maxV = maxSpeedOf(car);

  let throttle = ctrl.throttle || 0;
  let steer = ctrl.steer || 0;
  if (car.spin > 0) { throttle = 0; steer = 0; car.a += 10 * dt; }
  if (car.def.pullLeftDeg) steer -= car.def.pullLeftDeg / 50; // Duke's car pulls left (canon)

  const speedFactor = Math.min(1, Math.abs(vf) / 160);
  car.a += Math.max(-1, Math.min(1, steer)) * car.st.steer * speedFactor * Math.sign(vf || 1) * dt;

  if (throttle > 0) {
    if (vf < maxV) vf = Math.min(maxV, vf + car.st.accel * throttle * dt);
  } else if (throttle < 0) {
    if (vf > 0) vf = Math.max(0, vf + 900 * throttle * dt);
    else vf = Math.max(-150, vf + 300 * throttle * dt);
  } else {
    vf *= Math.exp(-0.7 * dt);
  }
  if (vf > maxV) vf += (maxV - vf) * Math.min(1, 2.5 * dt);
  vl *= Math.exp(-car.st.grip * dt * (car.spin > 0 ? 0.15 : 1));

  const nfx = Math.cos(car.a), nfy = Math.sin(car.a);
  car.vx = nfx * vf + -nfy * vl;
  car.vy = nfy * vf + nfx * vl;
  car.x += car.vx * dt;
  car.y += car.vy * dt;

  collideWithTrack(car, track);
  collideWithHazards(car, track, dt);
  for (const oil of world.oils || []) {
    if (oil.owner !== car.id && car.spin <= 0 && car.glide <= 0 && Math.hypot(oil.x - car.x, oil.y - car.y) < oil.r + 10) {
      car.spin = 0.9;
      car.events.push({ type: 'spin' });
    }
  }
  updateProgress(car, track);
}

function collideWithTrack(car, track) {
  const n = nearest(track, car.x, car.y, car.hint);
  car.hint = n.i;
  car.lateral = n.lateral;
  const half = track.width / 2;
  car.offTrack = n.dist > half;
  const wall = half + WALL_MARGIN - CAR_RADIUS * 0.5;
  if (n.dist > wall) {
    const side = Math.sign(n.lateral) || 1;
    const ox = n.nx * side, oy = n.ny * side; // outward normal
    car.x = n.px + ox * wall;
    car.y = n.py + oy * wall;
    const vn = car.vx * ox + car.vy * oy;
    if (vn > 0) {
      const bounce = 0.55;
      car.vx -= (1 + bounce) * vn * ox;
      car.vy -= (1 + bounce) * vn * oy;
      if (vn > 120) {
        car.squash = 0.35;
        car.events.push({ type: 'boing', x: car.x, y: car.y, power: vn });
        hurt(car, (vn - 150) * 0.025, 'Wall dent');
      }
    }
  }
}

function collideWithHazards(car, track) {
  let inLavaNow = false;
  for (const h of track.hazards) {
    const dx = car.x - h.x, dy = car.y - h.y;
    const d = Math.hypot(dx, dy);
    if (h.type === 'lava') {
      if (d < h.r + 8 && car.glide <= 0) {
        inLavaNow = true;
        if (!car.inLava && car.invuln <= 0) {
          car.soot = 1.3;
          car.vx *= 0.45; car.vy *= 0.45;
          car.events.push({ type: 'lava', x: car.x, y: car.y });
          hurt(car, 9, 'Lava scorch');
        }
      }
    } else if (h.type === 'rocks') {
      const min = h.r + CAR_RADIUS * 0.8;
      if (d < min && d > 0.001 && car.glide <= 0) {
        const ox = dx / d, oy = dy / d;
        car.x = h.x + ox * min; car.y = h.y + oy * min;
        const vn = -(car.vx * ox + car.vy * oy);
        if (vn > 0) {
          car.vx += 1.6 * vn * ox; car.vy += 1.6 * vn * oy;
          if (vn > 90) {
            car.squash = 0.35;
            car.events.push({ type: 'boing', x: car.x, y: car.y, power: vn });
            hurt(car, (vn - 80) * 0.035, 'Rock smash');
          }
        }
      }
    }
  }
  car.inLava = inLavaNow;
}

function updateProgress(car, track) {
  const n = nearest(track, car.x, car.y, car.hint);
  car.hint = n.i;
  car.progress = advanceProgress(car.progress, car.lastS, n.s, track.length);
  car.lastS = n.s;
  car.s = n.s;
}

export function activateSpecial(car, world) {
  const sp = car.def.special;
  if (!sp) return false;
  car.charge = 0;
  const fx = Math.cos(car.a), fy = Math.sin(car.a);
  switch (sp.id) {
    case 'backfire': {
      car.boost = 1.6;
      const v = maxSpeedOf(car) * 1.05;
      car.vx = fx * v; car.vy = fy * v;
      car.soot = 0.6;
      hurt(car, 3, null);
      car.events.push({ type: 'backfire', x: car.x - fx * 30, y: car.y - fy * 30 });
      break;
    }
    case 'shrug':
      car.invuln = 3.5;
      car.events.push({ type: 'shrug' });
      break;
    case 'wings':
      car.glide = 2.8;
      car.events.push({ type: 'wings' });
      break;
    case 'oil':
      (world.oils ||= []).push({ x: car.x - fx * 40, y: car.y - fy * 40, r: 30, owner: car.id, ttl: 14 });
      car.events.push({ type: 'oil' });
      break;
    case 'slipstream': {
      const ahead = (world.cars || []).filter((o) => o !== car && o.progress > car.progress && o.progress - car.progress < 260);
      car.boost = ahead.length ? 2.2 : 1.0;
      car.events.push({ type: 'slipstream', strong: ahead.length > 0 });
      break;
    }
    default:
      return false;
  }
  return true;
}

// Car-to-car bumps: bouncy, a little damage.
export function collideCars(cars) {
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i], b = cars[j];
      if (a.wrecked > 0 || b.wrecked > 0) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const min = CAR_RADIUS * 2;
      if (d >= min || d < 0.001) continue;
      const nx = dx / d, ny = dy / d;
      const push = (min - d) / 2;
      a.x -= nx * push; a.y -= ny * push;
      b.x += nx * push; b.y += ny * push;
      const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
      if (rel > 0) {
        const imp = rel * 0.8;
        a.vx -= imp * nx; a.vy -= imp * ny;
        b.vx += imp * nx; b.vy += imp * ny;
        if (rel > 120) {
          a.squash = b.squash = 0.25;
          a.events.push({ type: 'bump', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
          hurt(a, (rel - 100) * 0.02, 'Paint trade');
          hurt(b, (rel - 100) * 0.02, 'Paint trade');
        }
      }
    }
  }
}
