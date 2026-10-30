// Race and cup rules for Circuit Rush. Pure logic.

import { buildTrack, pointAt, curvatureAhead, TRACKS } from './track.js';
import { createCar, stepCar, collideCars, forwardSpeed, maxSpeedOf, CAR_RADIUS } from './car.js';
import { CARS, GEARCORP_CAR } from '../../shared/roster.js';

export const COUNTDOWN = 3;
export const FINISH_GRACE = 10; // seconds the field gets after the player finishes
export const POINTS = [10, 7, 5, 3, 2, 1];
export const COINS = [60, 40, 30, 20, 15, 10];
export const DIFFICULTY = { easy: 0.86, normal: 0.94, hard: 1.0 };

// Simple seeded RNG so tests and races are repeatable.
export function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

export function createRace({ trackIndex = 0, playerCarId = '02', playerDamage = 0, difficulty = 'normal', seed = 1, rivalDamage = {}, aiOnly = false }) {
  const track = buildTrack(TRACKS[trackIndex]);
  const rand = rng(seed + trackIndex * 977);
  const others = CARS.filter((c) => c.id !== playerCarId);
  const field = [CARS.find((c) => c.id === playerCarId) || CARS[0], ...others, GEARCORP_CAR];
  const skillBase = DIFFICULTY[difficulty] ?? DIFFICULTY.normal;
  // Player starts at the back of the grid; that's the drama.
  const order = [...field.slice(1), field[0]];
  const cars = order.map((def, idx) => {
    const row = Math.floor(idx / 2);
    const col = idx % 2 ? 1 : -1;
    const p = pointAt(track, track.length - 60 - row * 70);
    const isPlayer = def === field[0] && !aiOnly;
    return createCar(def, {
      x: p.x + p.nx * col * track.width * 0.22,
      y: p.y + p.ny * col * track.width * 0.22,
      a: Math.atan2(p.ty, p.tx),
      damage: def === field[0] ? playerDamage : rivalDamage[def.id] || 0,
      isPlayer,
      skill: skillBase * (0.95 + rand() * 0.08),
      lane: (rand() - 0.5) * track.width * 0.4,
    });
  });
  // Grid cars start just behind the line; count progress from there.
  for (const c of cars) {
    c.progress = -(track.length - pointNearestS(track, c));
    c.lastS = pointNearestS(track, c);
  }
  return {
    track,
    cars,
    oils: [],
    time: -COUNTDOWN,
    playerFinishedAt: null,
    over: false,
    rand,
    difficulty,
  };
}

function pointNearestS(track, car) {
  // Grid positions were made from pointAt, so a full search is fine (runs once).
  let best = 0, bestD = Infinity;
  const { pts, cum } = track;
  for (let i = 0; i < pts.length; i++) {
    const d = (pts[i].x - car.x) ** 2 + (pts[i].y - car.y) ** 2;
    if (d < bestD) { bestD = d; best = i; }
  }
  car.hint = best;
  return cum[best];
}

export function playerCar(race) {
  return race.cars.find((c) => c.isPlayer) || null;
}

export function lapOf(car, track) {
  return Math.max(0, Math.floor(car.progress / track.length)) + 1;
}

const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function aiControl(car, race) {
  const { track } = race;
  const vf = forwardSpeed(car);
  const look = 90 + Math.max(0, vf) * 0.42;
  // Dodge hazards coming up on the racing line.
  const probe = pointAt(track, car.s + look);
  const half = track.width / 2 - CAR_RADIUS;
  let lane = car.ai.lane;
  const L = track.length;
  for (const h of track.hazards) {
    const ds = (((h.s - car.s) % L) + L) % L;
    if (ds > look + 220 && ds < L - h.r - 40) continue; // not ahead, and already passed
    const clear = h.r + 30;
    if (Math.abs(h.lat - lane) < clear) {
      // Go round on whichever side has room; prefer the shorter swerve.
      const sides = [h.lat + clear, h.lat - clear]
        .map((v) => ({ v: Math.max(-half, Math.min(half, v)) }))
        .map((o) => ({ ...o, room: Math.abs(o.v - h.lat), move: Math.abs(o.v - lane) }))
        .sort((a, b) => (b.room >= clear) - (a.room >= clear) || a.move - b.move || b.room - a.room);
      lane = sides[0].v;
    }
  }
  lane = Math.max(-half, Math.min(half, lane));
  car.ai.laneTarget += (lane - car.ai.laneTarget) * 0.15;
  const tx = probe.x + probe.nx * car.ai.laneTarget;
  const ty = probe.y + probe.ny * car.ai.laneTarget;
  const want = Math.atan2(ty - car.y, tx - car.x);
  const diff = wrapAngle(want - car.a);
  // Plus a pull toward the chosen lane right here, so the car doesn't cut through hazards.
  const laneErr = car.ai.laneTarget - car.lateral;
  let steer = Math.max(-1, Math.min(1, diff * 2.6 + Math.max(-0.6, Math.min(0.6, laneErr * 0.015))));
  if (car.def.pullLeftDeg) steer += car.def.pullLeftDeg / 50; // AI Duke corrects his pull

  // Rubber band so the race stays close.
  const p = playerCar(race);
  let skill = car.ai.skill;
  if (p) {
    const gap = car.progress - p.progress;
    if (gap > 500) skill *= 0.92;
    else if (gap < -500) skill *= 1.05;
  }
  const curve = curvatureAhead(track, car.s, 120 + Math.max(0, vf) * 0.5);
  const targetV = maxSpeedOf(car) * skill * (1 - Math.min(0.6, curve * 0.8));
  let throttle = 1;
  if (vf > targetV + 50) throttle = -0.6;
  else if (vf > targetV) throttle = 0;

  // Use the special sometimes, at sensible moments.
  let special = false;
  if (car.charge >= 1) {
    const sp = car.def.special?.id;
    if (sp === 'oil') special = !!p && p.progress < car.progress && car.progress - p.progress < 200;
    else if (sp === 'wings') special = track.hazards.some((h) => h.type === 'lava' && Math.hypot(h.x - probe.x, h.y - probe.y) < 120);
    else if (sp === 'backfire' || sp === 'slipstream') special = curve < 0.15 && race.rand() < 0.03;
    else special = race.rand() < 0.01;
  }
  return { throttle, steer, special };
}

// Advance the race by dt. playerCtrl: { throttle, steer, special }.
export function stepRace(race, playerCtrl, dt) {
  if (race.over) return;
  race.time += dt;
  for (const c of race.cars) c.events.length = 0;
  if (race.time < 0) return; // countdown

  for (const car of race.cars) {
    let ctrl;
    if (car.finished) {
      // Cool-down lap on autopilot.
      ctrl = aiControl(car, race);
      ctrl.throttle = Math.min(ctrl.throttle, 0.4);
      ctrl.special = false;
    } else if (car.isPlayer) ctrl = playerCtrl;
    else ctrl = aiControl(car, race);
    stepCar(car, ctrl, dt, race);
  }
  collideCars(race.cars);
  for (const o of race.oils) o.ttl -= dt;
  race.oils = race.oils.filter((o) => o.ttl > 0);

  const goal = race.track.laps * race.track.length;
  for (const car of race.cars) {
    if (!car.finished && car.progress >= goal) {
      car.finished = true;
      car.finishTime = race.time;
      car.events.push({ type: 'finish' });
      if (car.isPlayer) race.playerFinishedAt = race.time;
    }
  }
  const allDone = race.cars.every((c) => c.finished);
  const graceUp = race.playerFinishedAt !== null && race.time - race.playerFinishedAt > FINISH_GRACE;
  // Safety net for AI-only simulations or a player who never finishes.
  const timeUp = race.time > 60 * 8;
  if (allDone || graceUp || timeUp) race.over = true;
}

export function standings(race) {
  return [...race.cars].sort((a, b) => {
    if (a.finished && b.finished) return a.finishTime - b.finishTime;
    if (a.finished) return -1;
    if (b.finished) return 1;
    return b.progress - a.progress;
  });
}

export function positionOf(race, car) {
  return standings(race).indexOf(car) + 1;
}

export function raceResults(race) {
  return standings(race).map((car, i) => ({
    id: car.id,
    driver: car.def.driver,
    number: car.def.number,
    isPlayer: car.isPlayer,
    place: i + 1,
    finished: car.finished,
    time: car.finished ? car.finishTime : null,
    points: POINTS[i] ?? 0,
    coins: car.isPlayer ? COINS[i] ?? 0 : 0,
    damage: Math.round(car.damage),
    damageTaken: Math.round(car.damageTaken),
    hits: car.hits.slice(),
  }));
}

// A cup is three races; points and damage carry from race to race.
export function createCup(playerCarId, difficulty = 'normal') {
  return { playerCarId, difficulty, round: 0, points: {}, rivalDamage: {}, results: [], coinsWon: 0 };
}

export function recordCupRace(cup, results) {
  const points = { ...cup.points };
  const rivalDamage = { ...cup.rivalDamage };
  let coinsWon = cup.coinsWon;
  for (const r of results) {
    points[r.id] = (points[r.id] || 0) + r.points;
    // Rival teams have pit crews: they fix half their damage between races.
    if (!r.isPlayer) rivalDamage[r.id] = Math.round(r.damage / 2);
    coinsWon += r.coins;
  }
  return { ...cup, round: cup.round + 1, points, rivalDamage, coinsWon, results: [...cup.results, results] };
}

export function cupTable(cup) {
  return Object.entries(cup.points)
    .map(([id, pts]) => ({ id, pts }))
    .sort((a, b) => b.pts - a.pts);
}

export const CUP_LENGTH = TRACKS.length;
