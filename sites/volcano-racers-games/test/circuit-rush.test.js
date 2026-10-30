import test from 'node:test';
import assert from 'node:assert/strict';
import { TRACKS, buildTrack, nearest, pointAt, advanceProgress } from '../games/circuit-rush/track.js';
import { createRace, stepRace, raceResults, standings, createCup, recordCupRace, cupTable, POINTS } from '../games/circuit-rush/race.js';
import { createCar, stepCar, maxSpeedOf, forwardSpeed } from '../games/circuit-rush/car.js';
import { CARS, carById } from '../shared/roster.js';

const DT = 1 / 60;

test('tracks never pass closer to themselves than the walls allow', () => {
  for (const def of TRACKS) {
    const t = buildTrack(def);
    const n = t.pts.length;
    const wallGap = def.width + 2 * 46; // two half-widths plus run-off on each side
    let worst = Infinity;
    for (let i = 0; i < n; i += 2) {
      for (let j = i + 1; j < n; j += 2) {
        const along = Math.abs(t.cum[j] - t.cum[i]);
        const arc = Math.min(along, t.length - along);
        if (arc < wallGap * 2.5) continue; // neighbours on the same stretch
        worst = Math.min(worst, Math.hypot(t.pts[i].x - t.pts[j].x, t.pts[i].y - t.pts[j].y));
      }
    }
    assert.ok(worst > wallGap, `${def.id}: closest pass ${worst.toFixed(0)}px < ${wallGap}px`);
  }
});

test('hazards sit on the road', () => {
  for (const def of TRACKS) {
    const t = buildTrack(def);
    for (const h of t.hazards) {
      const n = nearest(t, h.x, h.y);
      assert.ok(n.dist < def.width / 2, `${def.id} hazard off road`);
    }
  }
});

test('progress wraps cleanly across the start line', () => {
  assert.equal(advanceProgress(990, 990, 10, 1000), 1010);
  assert.equal(advanceProgress(1010, 10, 990, 1000), 990);
  assert.equal(advanceProgress(0, 100, 150, 1000), 50);
});

test('nearest finds the point we sampled', () => {
  const t = buildTrack(TRACKS[0]);
  const p = pointAt(t, 500);
  const n = nearest(t, p.x + p.nx * 30, p.y + p.ny * 30);
  assert.ok(Math.abs(n.s - 500) < 2);
  assert.ok(Math.abs(n.lateral - 30) < 1);
});

test('a car with no input stays put; throttle moves it forward', () => {
  const t = buildTrack(TRACKS[0]);
  const p = pointAt(t, 100);
  const car = createCar(carById('19'), { x: p.x, y: p.y, a: Math.atan2(p.ty, p.tx) });
  for (let i = 0; i < 60; i++) stepCar(car, { throttle: 0, steer: 0 }, DT, { track: t });
  assert.equal(Math.round(car.x), Math.round(p.x));
  for (let i = 0; i < 60; i++) stepCar(car, { throttle: 1, steer: 0 }, DT, { track: t });
  assert.ok(forwardSpeed(car) > 200);
  assert.ok(car.progress > 50);
});

test('damage lowers top speed, and a wreck still runs at 65%', () => {
  const def = carById('44');
  const fresh = createCar(def, { x: 0, y: 0, a: 0 });
  const hurt = createCar(def, { x: 0, y: 0, a: 0, damage: 100 });
  assert.ok(maxSpeedOf(hurt) < maxSpeedOf(fresh));
  assert.ok(Math.abs(maxSpeedOf(hurt) / maxSpeedOf(fresh) - 0.65) < 0.001);
});

test('driving straight into a wall bounces back and dents the car', () => {
  const t = buildTrack(TRACKS[0]);
  const p = pointAt(t, 300);
  const car = createCar(carById('02'), { x: p.x, y: p.y, a: Math.atan2(p.ny, p.nx) });
  car.vx = p.nx * 600; car.vy = p.ny * 600;
  let boing = false;
  for (let i = 0; i < 40; i++) {
    stepCar(car, { throttle: 0, steer: 0 }, DT, { track: t });
    if (car.events.some((e) => e.type === 'boing')) boing = true;
    car.events.length = 0;
  }
  assert.ok(boing, 'expected a BOING');
  assert.ok(car.damage > 0, 'expected damage');
  const n = nearest(t, car.x, car.y);
  assert.ok(n.dist <= t.width / 2 + 46, 'car stayed inside the wall');
});

for (let ti = 0; ti < TRACKS.length; ti++) {
  test(`AI field finishes all ${TRACKS[ti].laps} laps of ${TRACKS[ti].name}`, () => {
    const race = createRace({ trackIndex: ti, playerCarId: '02', aiOnly: true, seed: 7, difficulty: 'hard' });
    let steps = 0;
    while (!race.over && steps < 60 * 60 * 6) { stepRace(race, {}, DT); steps++; }
    const finished = race.cars.filter((c) => c.finished).length;
    assert.ok(finished >= 5, `only ${finished}/6 finished on ${TRACKS[ti].id} in ${(race.time).toFixed(0)}s`);
    const times = race.cars.filter((c) => c.finished).map((c) => c.finishTime);
    assert.ok(Math.min(...times) < 240, `winner took ${Math.min(...times).toFixed(0)}s`);
  });
}

test('results give points in finishing order and coins to the player only', () => {
  const race = createRace({ trackIndex: 0, playerCarId: '11', seed: 3 });
  for (let i = 0; i < 60 * 20; i++) stepRace(race, { throttle: 1, steer: 0 }, DT);
  const res = raceResults(race);
  assert.equal(res.length, 6);
  assert.deepEqual(res.map((r) => r.points), POINTS);
  assert.ok(res.filter((r) => r.coins > 0).every((r) => r.isPlayer));
  assert.equal(standings(race)[0].id, res[0].id);
});

test('cup adds up points over races', () => {
  let cup = createCup('07');
  const fake = (order) => order.map((id, i) => ({ id, isPlayer: id === '07', points: POINTS[i], coins: id === '07' ? 10 : 0, damage: 5 }));
  cup = recordCupRace(cup, fake(['07', '02', '11', '44', '19', 'gc']));
  cup = recordCupRace(cup, fake(['02', '07', '11', '44', '19', 'gc']));
  assert.equal(cup.round, 2);
  assert.equal(cup.points['07'], 17);
  assert.equal(cup.points['02'], 17);
  assert.equal(cup.coinsWon, 20);
  assert.equal(cupTable(cup).length, 6);
  assert.equal(cup.rivalDamage['02'], 3);
});

test('every team car has a special the physics knows', () => {
  for (const c of CARS) assert.ok(['backfire', 'shrug', 'wings', 'oil', 'slipstream'].includes(c.special.id));
});
