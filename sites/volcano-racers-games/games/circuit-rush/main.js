import { CARS, carById, GEARCORP_CAR } from '../../shared/roster.js';
import { loadProfile, updateProfile, applyDamage, repairCar, addCoins, spendCoins, setRecord, setFavoriteCar } from '../../shared/profile.js';
import { createInput, prefersReducedMotion } from '../../shared/input.js';
import { createFx } from '../../shared/draw.js';
import { $, h, ordinal, fmtTime, showPanel, setCoins, announce, fitCanvas } from '../../shared/ui.js';
import { createRace, stepRace, playerCar, positionOf, lapOf, raceResults, createCup, recordCupRace, cupTable, CUP_LENGTH } from './race.js';
import { TRACKS } from './track.js';
import { renderTrackLayer, renderMinimap, drawRace, updateCamera } from './render.js';
import { forwardSpeed } from './car.js';

const GAME = 'circuit-rush';
export const REPAIR_COST = 20; // coins per 25% repaired

const canvas = $('#game');
const ctx = canvas.getContext('2d');
const input = createInput();
input.bindTouch($('#touch'));
const reduceMotion = prefersReducedMotion();

let profile = loadProfile();
let selectedCar = profile.favoriteCar;
let difficulty = 'normal';
let cup = null;
let race = null;
let raceStartDamage = 0;
let layer = null, mini = null;
const fx = createFx();
const cam = { x: 0, y: 0, zoom: 1, shake: 0, shakeX: 0, shakeY: 0 };
let mode = 'menu'; // menu | race | paused
let lastLap = 1;
let lastPos = 0;
let rafId = 0;
let lastTs = 0;
let acc = 0;
let t = 0;

setCoins(profile.coins);

// The cup in progress survives a trip to Pit Crew and back (this tab only).
const CUP_KEY = 'vr.circuit-rush.cup';
function saveCup() { try { sessionStorage.setItem(CUP_KEY, JSON.stringify(cup)); } catch { /* storage blocked */ } }
function clearCup() { try { sessionStorage.removeItem(CUP_KEY); } catch { /* storage blocked */ } }
function loadCup() {
  try {
    const c = JSON.parse(sessionStorage.getItem(CUP_KEY) || 'null');
    if (c && carById(c.playerCarId) && Number.isInteger(c.round) && c.round > 0 && c.round < CUP_LENGTH && c.points) return c;
  } catch { /* ignore */ }
  return null;
}

// ---------- car select ----------

function renderCarPick() {
  const box = $('#car-pick');
  box.replaceChildren(
    ...CARS.map((c) => {
      const dmg = profile.garage[c.id]?.damage || 0;
      return h('button', {
        type: 'button', class: 'vr-pick__opt', 'aria-pressed': String(c.id === selectedCar),
        onclick: () => { selectedCar = c.id; renderCarPick(); },
      },
      h('span', { class: 'vr-pick__swatch', style: { background: c.body, color: c.numberInk } }, c.number),
      h('span', { class: 'vr-pick__name' }, c.driver),
      h('span', { class: 'vr-pick__meta' }, dmg > 0 ? `Damage ${dmg}%` : 'No damage'));
    }),
  );
  const c = carById(selectedCar);
  const stat = (label, v) => [h('span', {}, label), h('span', { class: 'vr-stats__bar', role: 'img', 'aria-label': `${label} ${v} out of 10` }, h('span', { style: { width: `${v * 10}%` } }))];
  $('#car-detail').replaceChildren(
    h('strong', { style: { gridColumn: '1 / -1' } }, `${c.driver}, ${c.car}`),
    h('span', { style: { gridColumn: '1 / -1' }, class: 'vr-muted' }, c.blurb),
    ...stat('Top speed', c.stats.topSpeed),
    ...stat('Acceleration', c.stats.accel),
    ...stat('Grip', c.stats.grip),
    ...stat('Toughness', c.stats.toughness),
    h('span', { style: { gridColumn: '1 / -1' } }, h('strong', {}, 'Special: '), `${c.special.name}. ${c.special.desc}`),
  );
}

for (const b of document.querySelectorAll('#diff-pick button')) {
  b.addEventListener('click', () => {
    difficulty = b.dataset.diff;
    for (const o of document.querySelectorAll('#diff-pick button')) o.setAttribute('aria-pressed', String(o === b));
  });
}

$('#btn-start').addEventListener('click', () => {
  profile = updateProfile((p) => setFavoriteCar(p, selectedCar)).profile;
  cup = createCup(selectedCar, difficulty);
  startRace();
});

// ---------- race ----------

function startRace() {
  profile = loadProfile();
  raceStartDamage = profile.garage[cup.playerCarId].damage;
  race = createRace({
    trackIndex: cup.round,
    playerCarId: cup.playerCarId,
    playerDamage: raceStartDamage,
    difficulty: cup.difficulty,
    seed: (Date.now() & 0xffff) + 1,
    rivalDamage: cup.rivalDamage,
  });
  layer = renderTrackLayer(race.track);
  mini = renderMinimap(race.track, window.innerWidth < 600 ? 110 : 150);
  const p = playerCar(race);
  cam.x = p.x; cam.y = p.y;
  lastLap = 1; lastPos = 0;
  fx.parts.length = 0; fx.words.length = 0;
  $('#hud-special-name').textContent = p.def.special.name;
  canvas.setAttribute('aria-label', `${race.track.name}, seen from above. You drive ${p.def.driver}'s ${p.def.number}.`);
  announce(`${race.track.name}. Race ${cup.round + 1} of ${CUP_LENGTH}. Get ready.`);
  showPanel(null);
  $('#hud').hidden = false;
  resume();
}

function resume() {
  mode = 'race';
  showPanel(null);
  input.setEnabled(true);
  canvas.focus?.();
  lastTs = 0;
  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(frame);
}

function pause() {
  if (mode !== 'race') return;
  mode = 'paused';
  input.setEnabled(false);
  showPanel('panel-pause');
}

$('#btn-pause').addEventListener('click', pause);
$('#btn-resume').addEventListener('click', resume);
$('#btn-restart').addEventListener('click', () => startRace());
$('#btn-quit').addEventListener('click', () => {
  clearCup();
  mode = 'menu';
  race = null;
  $('#hud').hidden = true;
  renderCarPick();
  showPanel('panel-select');
});
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

function playerControls() {
  let steer = 0;
  if (input.isDown('left')) steer -= 1;
  if (input.isDown('right')) steer += 1;
  let throttle = 0;
  if (input.isDown('up')) throttle += 1;
  if (input.isDown('down')) throttle -= 1;
  return { throttle, steer, special: input.wasPressed('action') };
}

const STEP = 1 / 120;

function frame(ts) {
  if (mode !== 'race') return;
  const dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 0;
  lastTs = ts;
  if (input.wasPressed('pause')) { input.consume(); pause(); render(); return; }
  acc += dt;
  const ctrl = playerControls();
  input.consume();
  let first = true;
  while (acc >= STEP) {
    stepRace(race, first ? ctrl : { ...ctrl, special: false }, STEP);
    first = false;
    handleEvents();
    acc -= STEP;
    t += STEP;
  }
  fx.update(dt);
  render(dt);
  updateHud();
  if (race.over) { finishRace(); return; }
  rafId = requestAnimationFrame(frame);
}

function render(dt = 0) {
  const view = fitCanvas(canvas);
  const p = playerCar(race);
  updateCamera(cam, p, view, dt, reduceMotion);
  drawRace(ctx, view, race, layer, mini, fx, { cam, t });
}

const WORDS = {
  boing: ['BOING!', 'BONK!', 'SPROING!'],
  lava: ['SIZZLE!', 'FSSSH!'],
  bump: ['BUMP!', 'CLANG!'],
  kaboom: ['KA-BOOM!'],
  backfire: ['BLAM!'],
  spin: ['WHEEE!'],
  oil: ['SPLORT!'],
  wings: ['FWOOP!'],
  shrug: ['MEH.'],
  slipstream: ['WHOOSH!'],
  pop: ['POP!'],
};
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function handleEvents() {
  for (const car of race.cars) {
    for (const e of car.events) {
      const x = e.x ?? car.x, y = e.y ?? car.y;
      const near = Math.hypot(car.x - cam.x, car.y - cam.y) < 900;
      if (!near) continue;
      if (WORDS[e.type] && (car.isPlayer || ['kaboom', 'boing', 'oil'].includes(e.type))) {
        fx.word(pick(WORDS[e.type]), x, y - 30, { size: e.type === 'kaboom' ? 42 : 28, fill: e.type === 'lava' ? '#FF5A1F' : '#FFC21A' });
      }
      if (e.type === 'boing' || e.type === 'bump') { fx.sparks(x, y, 10); if (car.isPlayer) cam.shake = Math.min(1, cam.shake + 0.5); }
      if (e.type === 'lava') { fx.puff(x, y, { n: 10, color: 'rgba(30,26,24,.8)', speed: 60, size: 12 }); if (car.isPlayer) cam.shake = Math.min(1, cam.shake + 0.4); }
      if (e.type === 'kaboom') { fx.puff(x, y, { n: 24, color: 'rgba(22,22,22,.85)', speed: 140, size: 18, life: 1.4 }); fx.sparks(x, y, 24); if (car.isPlayer) cam.shake = 1; }
      if (e.type === 'backfire') fx.puff(x, y, { n: 8, color: 'rgba(40,36,34,.8)', speed: 80, size: 14 });
      if (e.type === 'finish' && car.isPlayer) fx.word('FINISH!', car.x, car.y - 50, { size: 44, life: 1.6, fill: '#F4F0E8' });
    }
    // Damaged cars smoke
    if (car.damage > 50 && Math.random() < car.damage / 2500) fx.puff(car.x, car.y, { n: 1, speed: 20, size: 6, color: 'rgba(80,74,70,.5)' });
  }
}

function updateHud() {
  const p = playerCar(race);
  const pos = positionOf(race, p);
  const laps = race.track.laps;
  const lap = Math.min(laps, lapOf(p, race.track));
  $('#hud-pos').textContent = `${ordinal(pos)}`;
  $('#hud-lap').textContent = `${lap}/${laps}`;
  $('#hud-time').textContent = fmtTime(Math.max(0, p.finished ? p.finishTime : race.time));
  const d = Math.round(p.damage);
  $('#hud-dmg').style.width = `${d}%`;
  $('#hud-dmg-num').textContent = `${d}%`;
  $('#hud-special').style.width = `${Math.round(p.charge * 100)}%`;
  $('#hud-special-chip').classList.toggle('is-ready', p.charge >= 1);
  if (lap !== lastLap && !p.finished) {
    lastLap = lap;
    announce(lap === laps ? 'Final lap!' : `Lap ${lap} of ${laps}`);
    fx.word(lap === laps ? 'FINAL LAP!' : `LAP ${lap}`, p.x, p.y - 60, { size: 34, life: 1.4, fill: '#F4F0E8' });
  }
  lastPos = pos;
}

// ---------- results, garage, cup ----------

function finishRace() {
  mode = 'menu';
  input.setEnabled(false);
  $('#hud').hidden = true;
  const p = playerCar(race);
  const results = raceResults(race);
  const mine = results.find((r) => r.isPlayer);
  const newDamage = Math.max(0, Math.round(p.damage) - raceStartDamage);
  const scar = [...new Set(p.hits)].slice(-2).join(', ') || null;
  let isBest = false;
  profile = updateProfile((pr) => {
    let next = applyDamage(pr, cup.playerCarId, newDamage, newDamage > 0 ? `${race.track.name}: ${scar || 'knocks'}` : null);
    next = addCoins(next, mine.coins);
    if (mine.finished) {
      const r = setRecord(next, GAME, `best-${race.track.id}`, Math.round(mine.time * 100) / 100, 'lower');
      next = r.profile; isBest = r.isBest;
    }
    return next;
  }).profile;
  cup = recordCupRace(cup, results);
  if (cup.round < CUP_LENGTH) saveCup(); else clearCup();
  setCoins(profile.coins);

  $('#results-eyebrow').textContent = `Race ${cup.round} of ${CUP_LENGTH} · ${race.track.name}`;
  $('#results-title').textContent = mine.finished ? `You finished ${ordinal(mine.place)}` : `Race over: ${ordinal(mine.place)}`;
  $('#results-body').replaceChildren(
    resultTable(results),
    h('p', {}, `You earned ${mine.coins} coins.`, isBest ? ` New best time on ${race.track.name}: ${fmtTime(mine.time)}.` : ''),
    newDamage > 0
      ? h('p', {}, `Your ${carById(cup.playerCarId).number} took ${newDamage}% damage this race (now ${Math.round(p.damage)}%). It stays until you repair it.`)
      : h('p', {}, 'Not a scratch. Nice driving.'),
  );
  showPanel('panel-results');
  announce($('#results-title').textContent);
}

function resultTable(rows) {
  return h('table', { class: 'vr-table' },
    h('caption', { class: 'vr-sr' }, 'Race results'),
    h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Place'), h('th', { scope: 'col' }, 'Driver'), h('th', { scope: 'col' }, 'Time'), h('th', { scope: 'col' }, 'Points'), h('th', { scope: 'col' }, 'Damage'))),
    h('tbody', {}, rows.map((r) => h('tr', { class: r.isPlayer ? 'is-you' : '' },
      h('td', {}, ordinal(r.place)),
      h('td', {}, `${r.number} ${r.driver}${r.isPlayer ? ' (you)' : ''}`),
      h('td', {}, r.finished ? fmtTime(r.time) : 'Did not finish'),
      h('td', {}, String(r.points)),
      h('td', {}, `${r.damage}%`)))));
}

$('#btn-to-garage').addEventListener('click', () => {
  if (cup.round >= CUP_LENGTH) showCup();
  else showGarage();
});

function showGarage() {
  profile = loadProfile();
  const car = carById(cup.playerCarId);
  const g = profile.garage[car.id];
  const next = TRACKS[cup.round];
  $('#garage-title').textContent = `${car.number}, ${car.driver}`;
  $('#garage-body').replaceChildren(
    h('p', {}, `Damage: ${g.damage}%. Every 10% damage costs top speed. At 100% the car still runs, slowly.`),
    h('div', { class: 'vr-damage', role: 'img', 'aria-label': `Damage ${g.damage} percent` }, h('span', { style: { width: `${g.damage}%` } })),
    g.scars.length
      ? h('div', {}, h('h3', {}, 'Scars on this car'), h('ul', {}, g.scars.slice().reverse().map((s) => h('li', {}, s.label))))
      : h('p', { class: 'vr-muted' }, 'No scars yet.'),
    h('p', {}, h('strong', {}, `Next: ${next.name}. `), next.blurb),
    h('p', {}, 'Cup points so far: ', cupTable(cup).map((r, i) => `${i + 1}. ${nameOf(r.id)} ${r.pts}`).join(' · ')),
  );
  const canPay = profile.coins >= REPAIR_COST && g.damage > 0;
  $('#garage-actions').replaceChildren(
    h('button', { class: 'tn-btn', type: 'button', 'data-autofocus': true, onclick: () => startRace() }, `Race ${next.name}`),
    h('button', {
      class: 'tn-btn tn-btn--secondary', type: 'button', disabled: !canPay,
      onclick: () => {
        const r = spendCoins(loadProfile(), REPAIR_COST);
        if (!r.ok) return;
        profile = updateProfile(() => repairCar(r.profile, car.id, 25)).profile;
        setCoins(profile.coins);
        showGarage();
        announce(`Repaired. Damage now ${profile.garage[car.id].damage} percent.`);
      },
    }, g.damage > 0 ? `Quick repair 25% (${REPAIR_COST} coins)` : 'Nothing to repair'),
    h('a', { class: 'tn-btn tn-btn--secondary', href: `../pit-crew/?car=${car.id}&from=circuit-rush` }, 'Fix it for free in Pit Crew'),
    h('button', { class: 'tn-btn tn-btn--link', type: 'button', onclick: () => { clearCup(); cup = null; renderCarPick(); showPanel('panel-select'); } }, 'Quit this cup'),
  );
  showPanel('panel-garage');
}

function nameOf(id) {
  return (carById(id) || GEARCORP_CAR).driver;
}

function showCup() {
  const table = cupTable(cup);
  const myPlace = table.findIndex((r) => r.id === cup.playerCarId) + 1;
  if (myPlace === 1) {
    profile = updateProfile((p) => {
      const prev = p.records[GAME]?.cupWins || 0;
      return setRecord(p, GAME, 'cupWins', prev + 1, 'higher').profile;
    }).profile;
  }
  $('#cup-title').textContent = myPlace === 1 ? 'You won the cup!' : `You placed ${ordinal(myPlace)} in the cup`;
  $('#cup-body').replaceChildren(
    h('table', { class: 'vr-table' },
      h('caption', { class: 'vr-sr' }, 'Cup standings'),
      h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Place'), h('th', { scope: 'col' }, 'Driver'), h('th', { scope: 'col' }, 'Points'))),
      h('tbody', {}, table.map((r, i) => h('tr', { class: r.id === cup.playerCarId ? 'is-you' : '' },
        h('td', {}, ordinal(i + 1)), h('td', {}, nameOf(r.id) + (r.id === cup.playerCarId ? ' (you)' : '')), h('td', {}, String(r.pts)))))),
    h('p', {}, `Coins won this cup: ${cup.coinsWon}. Cup wins so far: ${profile.records[GAME]?.cupWins || 0}.`),
  );
  showPanel('panel-cup');
  announce($('#cup-title').textContent);
}

$('#btn-again').addEventListener('click', () => {
  profile = loadProfile();
  setCoins(profile.coins);
  renderCarPick();
  showPanel('panel-select');
});

window.addEventListener('storage', (e) => {
  if (e.key === 'vr.player') { profile = loadProfile(); setCoins(profile.coins); }
});

// Draw something behind the first menu.
function idle() {
  const view = fitCanvas(canvas);
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  ctx.fillStyle = '#2B2422';
  ctx.fillRect(0, 0, view.width, view.height);
}
window.addEventListener('resize', () => { if (mode !== 'race') { if (race) render(); else idle(); } });

// Test hook: lets the browser smoke test drive the game without timing hacks.
window.__circuitRush = { get race() { return race; }, get mode() { return mode; }, forwardSpeed };

renderCarPick();
idle();
const savedCup = loadCup();
if (savedCup) {
  cup = savedCup;
  selectedCar = cup.playerCarId;
  showGarage();
} else {
  showPanel('panel-select');
}
