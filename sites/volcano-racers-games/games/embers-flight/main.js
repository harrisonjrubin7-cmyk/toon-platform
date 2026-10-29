import { loadProfile, updateProfile, addCoins, setRecord } from '../../shared/profile.js';
import { createInput, prefersReducedMotion } from '../../shared/input.js';
import { createFx } from '../../shared/draw.js';
import { CHARACTERS } from '../../shared/roster.js';
import { $, h, showPanel, setCoins, announce, fitCanvas } from '../../shared/ui.js';
import { createFlight, stepFlight, following, fadeStage, coinsFor, FIRE_MAX } from './logic.js';
import { drawFlight, scaleFor } from './render.js';

const GAME = 'embers-flight';
const NAMES = Object.fromEntries(CHARACTERS.hatchlings.map((x) => [x.id, x.name]));
const canvas = $('#game');
const ctx = canvas.getContext('2d');
const input = createInput();
input.bindTouch($('#touch'));
const fx = createFx();
const reduceMotion = prefersReducedMotion();

let profile = loadProfile();
let flight = null;
let mode = 'menu';
let rafId = 0, lastTs = 0, acc = 0, t = 0, shake = 0;
let lastStage = 0;
setCoins(profile.coins);

function start() {
  flight = createFlight((Date.now() & 0xffff) + 1);
  fx.parts.length = 0; fx.words.length = 0;
  lastStage = 0;
  $('#hud').hidden = false;
  announce('Take off!');
  resume();
}

function resume() {
  mode = 'play';
  showPanel(null);
  input.setEnabled(true);
  canvas.focus();
  lastTs = 0;
  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(frame);
}

function pause() {
  if (mode !== 'play') return;
  mode = 'paused';
  input.setEnabled(false);
  showPanel('panel-pause');
}

$('#btn-start').addEventListener('click', start);
$('#btn-again').addEventListener('click', start);
$('#btn-restart').addEventListener('click', start);
$('#btn-resume').addEventListener('click', resume);
$('#btn-pause').addEventListener('click', pause);
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

const STEP = 1 / 120;

function frame(ts) {
  if (mode !== 'play') return;
  const dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 0;
  lastTs = ts;
  if (input.wasPressed('pause')) { input.consume(); pause(); return; }
  const ctrl = {
    up: input.isDown('up'), down: input.isDown('down'), left: input.isDown('left'), right: input.isDown('right'),
    breath: input.isDown('action'),
  };
  input.consume();
  acc += dt;
  while (acc >= STEP && !flight.over) {
    stepFlight(flight, ctrl, STEP);
    handleEvents();
    acc -= STEP;
    t += STEP;
  }
  fx.update(dt);
  shake = Math.max(0, shake - dt * 3);
  draw();
  updateHud();
  if (flight.over) { mode = 'over'; setTimeout(gameOver, 900); return; }
  rafId = requestAnimationFrame(frame);
}

function draw() {
  const view = fitCanvas(canvas);
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  if (shake > 0 && !reduceMotion) ctx.translate((Math.random() - 0.5) * shake * 12, (Math.random() - 0.5) * shake * 12);
  drawFlight(ctx, view, flight, fx, t);
}

function handleEvents() {
  const view = { width: canvas.clientWidth, height: canvas.clientHeight };
  const S = scaleFor(view);
  const ex = flight.x * S.u, ey = S.top + flight.y * S.u;
  for (const e of flight.events) {
    if (e.type === 'rescue') { fx.word('GOTCHA!', ex, ey - S.u, { size: 30, fill: '#7CC4A2' }); announce(`${NAMES[e.id]} rescued!`); }
    if (e.type === 'scatter') { fx.word('EEP!', ex + 30, ey - S.u, { size: 28 }); announce(`${NAMES[e.id]} got scared and flew off. Go get them.`); shake = 0.6; }
    if (e.type === 'hit') { fx.word('CLANG!', ex, ey - S.u, { size: 32, fill: '#FF5A1F' }); fx.puff(ex, ey, { n: 6, color: 'rgba(150,150,150,.6)', speed: 50, size: 8 }); shake = 1; }
    if (e.type === 'burn') { const x = e.x * S.u, y = S.top + e.y * S.u; fx.word('FWOOSH!', x, y - 20, { size: 26 }); fx.sparks(x, y, 14); }
    if (e.type === 'coal') fx.sparks(ex, ey, 6);
    if (e.type === 'airship') announce('Gearlock’s airship overhead!');
    if (e.type === 'hatchling-appears') announce(`${NAMES[e.id]} is lost up ahead.`);
  }
  const stage = fadeStage(flight.fire);
  if (stage !== lastStage) {
    if (stage > lastStage) announce(['', 'Ember’s fire is dimming.', 'Ember is fading. Find coals.', 'Ember’s fire is nearly out!'][stage]);
    lastStage = stage;
  }
}

function updateHud() {
  $('#hud-score').textContent = String(Math.floor(flight.score));
  const f = Math.round((flight.fire / FIRE_MAX) * 100);
  $('#hud-fire').style.width = `${f}%`;
  $('#hud-fire-num').textContent = `${f}%`;
  $('#hud-kids').textContent = `${following(flight).length}/3`;
}

function gameOver() {
  input.setEnabled(false);
  $('#hud').hidden = true;
  const sc = Math.floor(flight.score);
  const coins = coinsFor(flight);
  let best = false;
  profile = updateProfile((p) => {
    const r = setRecord(addCoins(p, coins), GAME, 'best', sc, 'higher');
    best = r.isBest;
    return r.profile;
  }).profile;
  setCoins(profile.coins);
  const kids = following(flight).map((x) => NAMES[x.id]);
  $('#over-body').replaceChildren(
    h('p', {}, kids.length
      ? `His fire went out, but ${kids.join(' and ')} ${kids.length === 1 ? 'is' : 'are'} curled up next to him.`
      : 'His fire went out. He lands alone, coughing ash, and waits for the hatchlings.'),
    h('p', {}, h('strong', {}, `Score ${sc}`), best ? ' (new best!)' : ` (best: ${profile.records[GAME]?.best ?? sc})`),
    h('p', {}, `${flight.burned} drones burned. ${coins} coins earned.`),
  );
  showPanel('panel-over');
  announce(`Flight over. Score ${sc}.`);
}

function idle() {
  const view = fitCanvas(canvas);
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  drawFlight(ctx, view, createFlight(1), createFx(), 0);
}
window.addEventListener('resize', () => { if (mode !== 'play') (flight ? draw() : idle()); });

window.__embersFlight = { get flight() { return flight; } };

idle();
showPanel('panel-start');
