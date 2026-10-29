import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, stepRun, obstacleBox, blazeBox, KNEE_LIMIT, GLOW_BOLTS, coinsFor, metres } from '../games/blazes-run/logic.js';

const DT = 1 / 120;

// A bot that reacts like a decent player: looks a short way ahead and jumps or slides.
function bot(run) {
  const ahead = run.obstacles.filter((o) => !o.hit && o.x + o.w > run.dist - 0.5).sort((a, b) => a.x - b.x)[0];
  if (!ahead) return { jump: false, jumpHeld: false, slide: false };
  const d = ahead.x - run.dist;
  if (ahead.kind === 'smoke') return { jump: false, jumpHeld: false, slide: d < 1.0 + run.speed * 0.05 && d > -ahead.w - 1 };
  const lead = ahead.kind === 'crack' ? 0.3 : 0.12;
  const closing = run.speed + (ahead.kind === 'drone' ? 3 : 0);
  const want = d > 0 && d < closing * lead + 1.6;
  return { jump: want && run.onGround, jumpHeld: run.vy > 0 || want, slide: false };
}

test('the course is always clearable: a reacting bot runs 2.5 km on several seeds', () => {
  for (const seed of [1, 2, 3, 42, 99]) {
    const run = createRun(seed);
    let steps = 0;
    while (!run.over && run.dist < 2500 && steps < 120 * 600) { stepRun(run, bot(run), DT); steps++; }
    assert.ok(run.dist >= 2500, `seed ${seed}: bot stopped at ${metres(run)} m with knee ${run.knee}`);
  }
});

test('running into things strains the knee; three hits end the run', () => {
  const run = createRun(5);
  let steps = 0;
  while (!run.over && steps < 120 * 300) { stepRun(run, { jump: false, jumpHeld: false, slide: false }, DT); steps++; }
  assert.ok(run.over);
  assert.equal(run.knee, KNEE_LIMIT);
});

test('sliding lowers Blaze under smoke; jumping clears a boulder', () => {
  const run = createRun(1);
  stepRun(run, { slide: true }, DT);
  assert.ok(blazeBox(run).y1 < obstacleBox({ kind: 'smoke', x: 0, w: 1 }).y0);
  const r2 = createRun(1);
  stepRun(r2, { jump: true, jumpHeld: true }, DT);
  for (let i = 0; i < 30; i++) stepRun(r2, { jumpHeld: true }, DT);
  assert.ok(r2.y > obstacleBox({ kind: 'boulder', x: 0, w: 1, h: 1.05 }).y1);
});

test('bolts fill the glow; glowing leaves a shadow behind and smashes through', () => {
  const run = createRun(3);
  run.obstacles = []; run.pickups = []; run.nextAt = 1e9;
  for (let i = 0; i < GLOW_BOLTS; i++) run.pickups.push({ x: run.dist + 2 + i, y: 0.5, taken: false });
  let glowed = false;
  for (let i = 0; i < 240; i++) { stepRun(run, {}, DT); if (run.events.some((e) => e.type === 'glow')) glowed = true; }
  assert.ok(glowed);
  assert.equal(run.shadows.length, 1);
  run.obstacles.push({ kind: 'boulder', x: run.dist + 1, w: 0.9, h: 1 });
  for (let i = 0; i < 60; i++) stepRun(run, {}, DT);
  assert.equal(run.knee, 0);
});

test('coins come from distance and bolts', () => {
  assert.equal(coinsFor({ dist: 260, bolts: 7 }), 7);
});
