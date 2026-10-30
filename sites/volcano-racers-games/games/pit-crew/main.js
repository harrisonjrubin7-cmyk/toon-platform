import { CARS, carById } from '../../shared/roster.js';
import { loadProfile, updateProfile, repairCar, addCoins, setRecord } from '../../shared/profile.js';
import { drawCarShape, carSize, createFx } from '../../shared/draw.js';
import { $, h, showPanel, setCoins, announce, fitCanvas } from '../../shared/ui.js';
import { prefersReducedMotion } from '../../shared/input.js';
import {
  SHIFT_SECONDS, JOB_TYPES, MISS_PENALTY, makeJobs, markerAt, isGoodHit, makePattern,
  score, coinsFor, repairedAmount,
} from './logic.js';

const GAME = 'pit-crew';
const params = new URLSearchParams(location.search);
const fromRace = params.get('from') === 'circuit-rush';
const canvas = $('#game');
const ctx = canvas.getContext('2d');
const fx = createFx();
const reduceMotion = prefersReducedMotion();

let profile = loadProfile();
let selected = carById(params.get('car'))?.id || mostDamaged();
let shift = null; // { car, practice, jobs, timeLeft, misses, active }
let rafId = 0, lastTs = 0, t = 0;
let tool = null; // active tool state

setCoins(profile.coins);

function mostDamaged() {
  return [...CARS].sort((a, b) => profile.garage[b.id].damage - profile.garage[a.id].damage)[0].id;
}

// ---------- select ----------

function renderPick() {
  $('#car-pick').replaceChildren(...CARS.map((c) => {
    const d = profile.garage[c.id].damage;
    return h('button', {
      type: 'button', class: 'vr-pick__opt', 'aria-pressed': String(c.id === selected),
      onclick: () => { selected = c.id; renderPick(); },
    },
    h('span', { class: 'vr-pick__swatch', style: { background: c.body, color: c.numberInk } }, c.number),
    h('span', { class: 'vr-pick__name' }, c.driver),
    h('span', { class: 'vr-pick__meta' }, d ? `Damage ${d}%` : 'No damage'));
  }));
  const d = profile.garage[selected].damage;
  $('#select-note').textContent = d
    ? `${carById(selected).number} has ${d}% damage: ${Math.ceil(d / 10)} jobs to do.`
    : `${carById(selected).number} has no damage. You can practise on it (half score, no coins, nothing changes on the car).`;
  $('#btn-start').textContent = d ? 'Start the shift' : 'Practise';
}

$('#btn-start').addEventListener('click', startShift);

function startShift() {
  profile = loadProfile();
  const car = carById(selected);
  const g = profile.garage[car.id];
  const practice = g.damage === 0;
  const jobs = makeJobs(practice ? 40 : g.damage, g.scars, (Date.now() & 0xffff) + 1);
  shift = { car, practice, jobs, timeLeft: SHIFT_SECONDS, misses: 0, startDamage: g.damage, over: false };
  showPanel(null);
  $('#hud').hidden = false;
  pip(practice ? 'Practice run. Pick a job under the car.' : `${jobs.length} jobs. Pick one under the car.`);
  renderJobs();
  lastTs = 0;
  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(frame);
  announce(`Shift started. ${jobs.length} repair jobs. 60 seconds.`);
  $('#jobs .pc-job')?.focus();
}

function pip(text) { $('#pip-says').textContent = text; }

// ---------- layout: map car-space job spots to screen ----------

function carBox(view) {
  const sz = carSize(shift.car);
  const scale = Math.min((view.width * 0.62) / sz.l, (view.height * 0.36) / sz.w, 14);
  return { cx: view.width / 2, cy: view.height * 0.5, scale, L: sz.l, W: sz.w };
}

function spotToScreen(box, job) {
  return { x: box.cx + (job.x - 0.5) * box.L * box.scale, y: box.cy + (job.y - 0.5) * box.W * box.scale };
}

// Where a job is on the car, in words (the car faces right on the lift).
function spotName(j) {
  const along = j.x > 0.62 ? 'front' : j.x < 0.38 ? 'back' : 'middle';
  const side = j.y < 0.45 ? 'left side' : j.y > 0.55 ? 'right side' : 'centre';
  return `${along}, ${side}`;
}

// Job buttons live in a tray under the car, never on top of it (project rule:
// no labels over art). Hovering or focusing one lights up its spot on the car.
let litJob = null;
function renderJobs() {
  const open = shift.jobs.filter((j) => !j.done);
  $('#jobs').replaceChildren(...open.map((j) => {
    const T = JOB_TYPES[j.type];
    const light = () => { litJob = j; };
    const unlight = () => { if (litJob === j) litJob = null; };
    return h('button', {
      type: 'button', class: 'pc-job', 'data-type': j.type,
      'aria-label': `${T.name} at the ${spotName(j)}, use the ${T.tool.toLowerCase()}`,
      onclick: () => openTool(j),
      onfocus: light, onblur: unlight, onpointerenter: light, onpointerleave: unlight,
    }, T.name, h('small', {}, spotName(j)));
  }));
  $('#hud-jobs').textContent = `${shift.jobs.filter((j) => j.done).length}/${shift.jobs.length}`;
}


// ---------- tools ----------

function openTool(job) {
  if (shift.over) return;
  const T = JOB_TYPES[job.type];
  $('#sheet-title').textContent = `${T.name}: ${T.tool}`;
  $('#sheet-how').textContent = T.how;
  $('#jobs').hidden = true;
  const sheet = $('#sheet');
  sheet.hidden = false;
  if (job.type === 'dent') tool = hammerTool(job);
  if (job.type === 'soot') tool = spongeTool(job);
  if (job.type === 'bolts') tool = wrenchTool(job);
  $('#sheet-body').replaceChildren(tool.el);
  tool.focus();
}

function closeTool() {
  tool?.destroy?.();
  tool = null;
  $('#sheet').hidden = true;
  $('#jobs').hidden = false;
  if (shift && !shift.over) {
    renderJobs();
    $('#jobs .pc-job')?.focus();
  }
}

$('#btn-sheet-close').addEventListener('click', closeTool);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && tool) { e.preventDefault(); closeTool(); } });

function miss(msg) {
  shift.misses++;
  shift.timeLeft = Math.max(0, shift.timeLeft - MISS_PENALTY);
  pip(msg);
}

function jobDone(job) {
  job.done = true;
  const box = carBox(fitCanvas(canvas));
  const p = spotToScreen(box, job);
  // The sound effect goes in the empty floor above the lift, not on the car.
  fx.word(['CLANK!', 'GOOD AS NEW!', 'SHINY!', 'TA-DA!'][Math.floor(Math.random() * 4)], p.x, box.cy - box.W * box.scale * 0.8 - 28, { size: 30, fill: '#7CC4A2' });
  fx.sparks(p.x, p.y, 14);
  const left = shift.jobs.filter((j) => !j.done).length;
  pip(left ? `Fixed! ${left} to go.` : 'All fixed. Pip approves.');
  announce(left ? `Job fixed. ${left} left.` : 'All jobs fixed.');
  closeTool();
  if (!left) endShift();
}

function hammerTool(job) {
  const need = JOB_TYPES.dent.hits;
  let hits = 0;
  const start = performance.now();
  const zone = h('div', { class: 'pc-meter__zone', style: { left: '39%', width: '22%' } });
  const marker = h('div', { class: 'pc-meter__marker' });
  const count = h('span', { 'aria-live': 'polite' }, `Hits: 0/${need}`);
  const feedback = h('p', { class: 'pc-feedback', 'aria-live': 'assertive' });
  const btn = h('button', { type: 'button', class: 'tn-btn pc-big' }, 'Hit');
  const speed = 1.1 + Math.random() * 0.4;
  const pos = () => markerAt((performance.now() - start) / 1000, speed);
  btn.addEventListener('click', () => {
    if (isGoodHit(pos())) {
      hits++;
      count.textContent = `Hits: ${hits}/${need}`;
      feedback.textContent = 'BONK! Good hit.';
      if (hits >= need) jobDone(job);
    } else {
      feedback.textContent = 'Missed. Wait for the gold zone.';
      miss('Easy on the hammer!');
    }
  });
  let raf = 0;
  const tick = () => { marker.style.left = `${pos() * 100}%`; raf = requestAnimationFrame(tick); };
  tick();
  const el = h('div', { class: 'pc-row', style: { flexDirection: 'column', alignItems: 'stretch' } },
    h('div', { class: 'pc-meter', role: 'img', 'aria-label': 'Timing bar. The marker moves back and forth; hit when it crosses the middle.' }, zone, marker),
    h('div', { class: 'pc-row' }, btn, count),
    feedback,
    h('p', { class: 'vr-keys' }, 'Keyboard: press ', h('kbd', {}, 'Space'), ' or ', h('kbd', {}, 'Enter'), ' on the Hit button.'));
  return { el, focus: () => btn.focus(), destroy: () => cancelAnimationFrame(raf) };
}

function spongeTool(job) {
  const need = JOB_TYPES.soot.hold;
  let held = 0, holding = false, raf = 0, last = 0;
  const fill = h('div', { class: 'pc-meter__fill', style: { width: '0%' } });
  const meter = h('div', { class: 'pc-meter', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0', 'aria-label': 'Scrubbing' }, fill);
  const btn = h('button', { type: 'button', class: 'tn-btn pc-big' }, 'Hold to scrub');
  const startHold = (e) => { e.preventDefault(); holding = true; };
  const stopHold = () => { holding = false; };
  btn.addEventListener('pointerdown', startHold);
  btn.addEventListener('pointerup', stopHold);
  btn.addEventListener('pointerleave', stopHold);
  btn.addEventListener('pointercancel', stopHold);
  btn.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); holding = true; } });
  btn.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') holding = false; });
  btn.addEventListener('blur', stopHold);
  const tick = (ts) => {
    const dt = last ? (ts - last) / 1000 : 0;
    last = ts;
    if (holding && !shift.over) {
      held += dt;
      const p = Math.min(100, Math.round((held / need) * 100));
      fill.style.width = `${p}%`;
      meter.setAttribute('aria-valuenow', String(p));
      if (Math.random() < 0.3) {
        const job2 = spotToScreen(carBox(fitCanvas(canvas)), job);
        fx.puff(job2.x, job2.y, { n: 1, color: 'rgba(244,240,232,.7)', speed: 40, size: 6, life: 0.5 });
      }
      if (held >= need) { jobDone(job); return; }
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  const el = h('div', { class: 'pc-row', style: { flexDirection: 'column', alignItems: 'stretch' } }, meter, h('div', { class: 'pc-row' }, btn),
    h('p', { class: 'vr-keys' }, 'Keyboard: hold ', h('kbd', {}, 'Space'), ' on the button.'));
  return { el, focus: () => btn.focus(), destroy: () => cancelAnimationFrame(raf) };
}

const GLYPH = { up: '↑', right: '→', down: '↓', left: '←' };

function wrenchTool(job) {
  const pattern = makePattern(JOB_TYPES.bolts.length, (Date.now() & 0xfff) + 7);
  let step = 0;
  const cells = pattern.map((d) => h('span', { 'aria-hidden': 'true' }, GLYPH[d]));
  const feedback = h('p', { class: 'pc-feedback', 'aria-live': 'assertive' });
  const sr = h('p', { class: 'vr-sr' }, `Pattern: ${pattern.join(', ')}`);
  const press = (dir) => {
    if (shift.over) return;
    if (dir === pattern[step]) {
      cells[step].classList.add('is-done');
      step++;
      feedback.textContent = step < pattern.length ? `Click. ${pattern.length - step} to go.` : 'Tight!';
      if (step >= pattern.length) jobDone(job);
    } else {
      step = 0;
      cells.forEach((c) => c.classList.remove('is-done'));
      feedback.textContent = 'Wrong bolt. Start the pattern again.';
      miss('Lefty loosey!');
    }
  };
  const btns = ['up', 'left', 'down', 'right'].map((d) => h('button', { type: 'button', class: 'tn-btn tn-btn--secondary', 'data-dir': d, 'aria-label': d, onclick: () => press(d) }, GLYPH[d]));
  const onKey = (e) => {
    const map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
    if (map[e.key]) { e.preventDefault(); press(map[e.key]); }
  };
  document.addEventListener('keydown', onKey);
  const el = h('div', { class: 'pc-row', style: { flexDirection: 'column', alignItems: 'flex-start' } },
    h('div', { class: 'pc-pattern' }, cells), sr, h('div', { class: 'pc-arrows' }, btns), feedback,
    h('p', { class: 'vr-keys' }, 'Keyboard: use the arrow keys.'));
  return { el, focus: () => btns[0].focus(), destroy: () => document.removeEventListener('keydown', onKey) };
}

// ---------- loop & drawing ----------

function frame(ts) {
  const dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 0;
  lastTs = ts;
  t += dt;
  if (shift && !shift.over) {
    shift.timeLeft = Math.max(0, shift.timeLeft - dt);
    $('#hud-time').textContent = String(Math.ceil(shift.timeLeft));
    if (shift.timeLeft <= 0) endShift();
  }
  fx.update(dt);
  draw();
  if (shift && !shift.over) rafId = requestAnimationFrame(frame);
  else if (fx.parts.length || fx.words.length) rafId = requestAnimationFrame(frame);
}

function draw() {
  const view = fitCanvas(canvas);
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  // Garage floor
  ctx.fillStyle = '#1d1816'; ctx.fillRect(0, 0, view.width, view.height);
  ctx.strokeStyle = 'rgba(244,240,232,.06)'; ctx.lineWidth = 1;
  for (let x = 0; x < view.width; x += 48) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, view.height); ctx.stroke(); }
  for (let y = 0; y < view.height; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(view.width, y); ctx.stroke(); }
  if (!shift) return;
  const box = carBox(view);
  // Lift pad
  ctx.fillStyle = '#FFC21A';
  ctx.fillRect(box.cx - box.L * box.scale * 0.6, box.cy - box.W * box.scale * 0.8, box.L * box.scale * 1.2, box.W * box.scale * 1.6);
  ctx.fillStyle = '#2B2422';
  ctx.fillRect(box.cx - box.L * box.scale * 0.57, box.cy - box.W * box.scale * 0.75, box.L * box.scale * 1.14, box.W * box.scale * 1.5);
  ctx.save();
  ctx.translate(box.cx, box.cy);
  ctx.scale(box.scale, box.scale);
  const remaining = shift.practice ? 0 : Math.max(0, shift.startDamage - repairedAmount(shift.jobs));
  drawCarShape(ctx, shift.car, { damage: 0, t, seed: 4, driver: false });
  ctx.restore();
  // Damage marks at each open job
  for (const j of shift.jobs) {
    if (j.done) continue;
    const p = spotToScreen(box, j);
    const r = box.scale * 4;
    if (j.type === 'soot') {
      ctx.fillStyle = 'rgba(15,12,11,.85)';
      ctx.beginPath(); ctx.ellipse(p.x, p.y, r * 1.6, r, 0.3, 0, Math.PI * 2); ctx.fill();
    } else if (j.type === 'dent') {
      ctx.strokeStyle = 'rgba(15,12,11,.9)'; ctx.lineWidth = Math.max(2, box.scale * 0.5);
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0.3, Math.PI * 1.6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(p.x - r, p.y + r * 0.2); ctx.lineTo(p.x + r * 0.8, p.y - r * 0.4); ctx.stroke();
    } else {
      ctx.fillStyle = '#C9CED6'; ctx.strokeStyle = '#161616'; ctx.lineWidth = 2;
      for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(p.x - r + k * r, p.y + (k % 2 ? r * 0.5 : -r * 0.3), r * 0.35, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    }
  }
  if (litJob && !litJob.done) {
    const p = spotToScreen(box, litJob);
    const r = box.scale * 4 * (reduceMotion ? 1.9 : 1.7 + 0.25 * Math.sin(t * 6));
    ctx.strokeStyle = '#FFC21A'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.stroke();
  }
  if (!reduceMotion && remaining > 50 && Math.random() < 0.2) fx.puff(box.cx - box.L * box.scale * 0.45, box.cy, { n: 1, speed: 25, size: 10, color: 'rgba(80,74,70,.4)' });
  fx.draw(ctx);
}

function endShift() {
  if (shift.over) return;
  shift.over = true;
  if (tool) { tool.destroy?.(); tool = null; $('#sheet').hidden = true; }
  $('#jobs').hidden = false;
  $('#jobs').replaceChildren();
  const jobsDone = shift.jobs.filter((j) => j.done).length;
  const fixed = shift.practice ? 0 : repairedAmount(shift.jobs);
  const sc = score({ jobsDone, timeLeft: shift.timeLeft, misses: shift.misses, practice: shift.practice });
  const coins = coinsFor(jobsDone, shift.practice);
  let best = false;
  profile = updateProfile((p) => {
    let n = fixed ? repairCar(p, shift.car.id, fixed) : p;
    n = addCoins(n, coins);
    const r = setRecord(n, GAME, 'best', sc, 'higher');
    best = r.isBest && sc > 0;
    return r.profile;
  }).profile;
  setCoins(profile.coins);
  $('#hud').hidden = true;
  const now = profile.garage[shift.car.id].damage;
  $('#results-title').textContent = jobsDone === shift.jobs.length ? 'Every job done!' : 'Time’s up';
  $('#results-body').replaceChildren(
    h('p', {}, `You finished ${jobsDone} of ${shift.jobs.length} jobs with ${Math.ceil(shift.timeLeft)} seconds left and ${shift.misses} slip${shift.misses === 1 ? '' : 's'}.`),
    shift.practice
      ? h('p', {}, 'Practice run: the car was not changed.')
      : h('p', {}, `${shift.car.number} went from ${shift.startDamage}% to ${now}% damage.`),
    h('p', {}, `Score ${sc}${best ? ' (new best!)' : ''}. Coins earned: ${coins}.`),
  );
  $('#results-actions').replaceChildren(
    fromRace
      ? h('a', { class: 'tn-btn', href: '../circuit-rush/', 'data-autofocus': true }, 'Back to the race')
      : h('button', { class: 'tn-btn', type: 'button', 'data-autofocus': true, onclick: () => { profile = loadProfile(); renderPick(); showPanel('panel-select'); shift = null; draw(); } }, 'Fix another car'),
    h('a', { class: 'tn-btn tn-btn--secondary', href: '../../' }, 'All games'),
  );
  showPanel('panel-results');
  announce($('#results-title').textContent);
}

window.__pitCrew = { get shift() { return shift; } };

renderPick();
draw();
showPanel('panel-select');
