import test from 'node:test';
import assert from 'node:assert/strict';
import { createFlight, stepFlight, following, fadeStage, FIRE_MAX, HIT_FIRE, EMBER_R, SKY_H, coinsFor } from '../games/embers-flight/logic.js';

const DT = 1 / 120;
const idle = {};

function quiet(f) { f.nextDrone = 1e9; f.nextCoal = 1e9; f.nextAirship = 1e9; }

test('the fire burns down on its own and the flight ends when it is out', () => {
  const f = createFlight(1);
  quiet(f);
  for (const h of f.hatchlings) h.at = 1e9;
  let steps = 0;
  while (!f.over && steps < 120 * 200) { stepFlight(f, idle, DT); steps++; }
  assert.ok(f.over);
  assert.equal(f.fire, 0);
  assert.ok(f.t > 80, `burned out too fast (${f.t.toFixed(0)}s)`);
});

test('coals stoke the fire, capped at full', () => {
  const f = createFlight(2);
  quiet(f);
  f.fire = 50;
  f.coals.push({ x: f.x, y: f.y, vy: 0 });
  stepFlight(f, idle, DT);
  assert.ok(f.fire > 60);
  f.fire = FIRE_MAX;
  f.coals.push({ x: f.x, y: f.y, vy: 0 });
  stepFlight(f, idle, DT);
  assert.ok(f.fire <= FIRE_MAX);
});

test('rescued hatchlings follow; a hit scares one off before it costs fire', () => {
  const f = createFlight(3);
  quiet(f);
  const h = f.hatchlings[0];
  h.state = 'lost'; h.x = f.x; h.y = f.y;
  stepFlight(f, idle, DT);
  assert.equal(following(f).length, 1);
  const fire = f.fire;
  f.drones.push({ kind: 'drone', x: f.x, y: f.y, vx: f.scroll, vy: 0 });
  stepFlight(f, idle, DT);
  assert.equal(following(f).length, 0);
  assert.ok(f.fire > fire - 1, 'fire should not drop while a hatchling took the scare');
  f.invuln = 0;
  f.drones.push({ kind: 'drone', x: f.x, y: f.y, vx: f.scroll, vy: 0 });
  stepFlight(f, idle, DT);
  assert.ok(f.fire < fire - HIT_FIRE + 1);
});

test('fire breath burns drones in front, not behind', () => {
  const f = createFlight(4);
  quiet(f);
  f.drones.push({ kind: 'drone', x: f.x + 2, y: f.y, vx: f.scroll, vy: 0 });
  f.drones.push({ kind: 'drone', x: f.x - 2, y: f.y, vx: f.scroll, vy: 0 });
  stepFlight(f, { breath: true }, DT);
  assert.equal(f.burned, 1);
  assert.equal(f.drones.length, 1);
});

test('breathing costs fire', () => {
  const a = createFlight(5), b = createFlight(5);
  quiet(a); quiet(b);
  for (let i = 0; i < 120; i++) { stepFlight(a, idle, DT); stepFlight(b, { breath: true }, DT); }
  assert.ok(b.fire < a.fire - 10);
});

test('Ember stays inside the sky', () => {
  const f = createFlight(6);
  quiet(f);
  for (let i = 0; i < 600; i++) stepFlight(f, { up: true, left: true }, DT);
  assert.ok(f.y >= EMBER_R && f.x >= 1);
  for (let i = 0; i < 600; i++) stepFlight(f, { down: true, right: true }, DT);
  assert.ok(f.y <= SKY_H);
});

test('fade ladder has four stages', () => {
  assert.deepEqual([100, 70, 40, 10].map(fadeStage), [0, 1, 2, 3]);
  assert.equal(coinsFor({ score: 1234 }), 12);
});
