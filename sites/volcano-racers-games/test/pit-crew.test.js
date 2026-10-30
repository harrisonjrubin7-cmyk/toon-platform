import test from 'node:test';
import assert from 'node:assert/strict';
import { makeJobs, markerAt, isGoodHit, makePattern, score, coinsFor, repairedAmount, MAX_JOBS } from '../games/pit-crew/logic.js';

test('one job per 10% damage, and the jobs add up to the damage', () => {
  const jobs = makeJobs(37, [], 1);
  assert.equal(jobs.length, 4);
  assert.equal(jobs.reduce((a, j) => a + j.repair, 0), 37);
  assert.equal(makeJobs(0).length, 0);
  assert.equal(makeJobs(100).length, MAX_JOBS);
});

test('race scars decide the job type', () => {
  const jobs = makeJobs(30, [{ label: 'Ash Canyon: Lava scorch, Wall dent' }], 2);
  assert.equal(jobs[0].type, 'soot');
  assert.equal(jobs[1].type, 'dent');
});

test('job spots never overlap', () => {
  const jobs = makeJobs(100, [], 3);
  const keys = new Set(jobs.map((j) => `${j.x},${j.y}`));
  assert.equal(keys.size, jobs.length);
});

test('hammer marker bounces between 0 and 1, gold zone is the middle', () => {
  for (let t = 0; t < 5; t += 0.07) {
    const m = markerAt(t);
    assert.ok(m >= 0 && m <= 1);
  }
  assert.ok(isGoodHit(0.5));
  assert.ok(!isGoodHit(0.1));
});

test('patterns are repeatable from a seed', () => {
  assert.deepEqual(makePattern(4, 9), makePattern(4, 9));
  assert.equal(makePattern(4, 9).length, 4);
});

test('score, coins and repairs', () => {
  assert.equal(score({ jobsDone: 3, timeLeft: 10, misses: 1, practice: false }), 340);
  assert.equal(score({ jobsDone: 3, timeLeft: 10, misses: 1, practice: true }), 170);
  assert.equal(score({ jobsDone: 0, timeLeft: 0, misses: 9, practice: false }), 0);
  assert.equal(coinsFor(3, false), 15);
  assert.equal(coinsFor(3, true), 0);
  const jobs = makeJobs(25, [], 4);
  jobs[0].done = true; jobs[2].done = true;
  assert.equal(repairedAmount(jobs), 15);
});
