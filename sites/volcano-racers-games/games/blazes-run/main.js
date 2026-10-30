import { loadProfile, updateProfile, addCoins, setRecord } from '../../shared/profile.js';
import { createInput, prefersReducedMotion } from '../../shared/input.js';
import { createFx } from '../../shared/draw.js';
import { $, h, showPanel, setCoins, announce, fitCanvas } from '../../shared/ui.js';
import { createRun, stepRun, metres, coinsFor, KNEE_LIMIT, GLOW_BOLTS } from './logic.js';
import { drawScene, layout } from './render.js';

const GAME = 'blazes-run';
const canvas = $('#game');
const ctx = canvas.getContext('2d');
const input = createInput();
input.bindTouch($('#touch'));
const fx = createFx();
const reduceMotion = prefersReducedMotion();

let profile = loadProfile();
let run = null;
let mode = 'menu';
let rafId = 0, lastTs = 0, acc = 0, t = 0;
let lastMilestone = 0;
let shake = 0;
setCoins(profile.coins);

function start() {
  run = createRun((Date.now() & 0xffff) + 1);
  fx.parts.length = 0; fx.words.length = 0;
  lastMilestone = 0;
  $('#hud').hidden = false;
  announce('Go!');
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
  const jumpPressed = input.wasPressed('up') || input.wasPressed('action');
  const ctrl = { jump: false, jumpHeld: input.isDown('up') || input.isDown('action'), slide: input.isDown('down') };
  input.consume();
  acc += dt;
  let first = true;
  while (acc >= STEP && !run.over) {
    stepRun(run, { ...ctrl, jump: first && jumpPressed }, STEP);
    first = false;
    handleEvents();
    acc -= STEP;
    t += STEP;
  }
  fx.update(dt);
  shake = Math.max(0, shake - dt * 3);
  draw();
  updateHud();
  if (run.over) { setTimeout(gameOver, 700); mode = 'over'; return; }
  rafId = requestAnimationFrame(frame);
}

function draw() {
  const view = fitCanvas(canvas);
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  if (shake > 0 && !reduceMotion) ctx.translate((Math.random() - 0.5) * shake * 12, (Math.random() - 0.5) * shake * 12);
  drawScene(ctx, view, run, fx, t);
}

function handleEvents() {
  const view = { width: canvas.clientWidth, height: canvas.clientHeight };
  const L = layout(view);
  const bx = L.blazeX, by = L.groundY - run.y * L.ppm;
  for (const e of run.events) {
    if (e.type === 'hit') {
      fx.word(e.kind === 'crack' ? 'SIZZLE!' : e.kind === 'drone' ? 'BZZT!' : 'BONK!', bx + 20, by - L.ppm * 1.8, { size: 32, fill: e.kind === 'crack' ? '#FF5A1F' : '#FFC21A' });
      fx.sparks(bx, by - L.ppm, 12);
      shake = 1;
      announce(e.knee >= KNEE_LIMIT ? 'Ouch. That was the last one.' : `Ouch. Knee strain ${e.knee} of ${KNEE_LIMIT}.`);
    }
    if (e.type === 'bolt') fx.sparks(bx + 10, by - L.ppm * 0.8, 4);
    if (e.type === 'glow') {
      fx.word('ZOOM!', bx + 40, by - L.ppm * 2, { size: 40, life: 1.2 });
      announce('Top speed! Blaze glows and leaves her shadow behind.');
    }
    if (e.type === 'smash') { fx.word('SMASH!', bx + 40, by - L.ppm * 1.5, { size: 30 }); fx.sparks(bx + 30, by - L.ppm * 0.6, 14); }
    if (e.type === 'land') fx.puff(bx - 8, L.groundY, { n: 3, color: 'rgba(30,26,24,.7)', speed: 40, size: 6, life: 0.4 });
  }
  if (run.onGround && run.flat <= 0 && Math.random() < 0.35) {
    // the rooster-tail of black sand
    fx.parts.push({ x: bx - 14, y: L.groundY - 2, vx: -run.speed * 14 - Math.random() * 60, vy: -40 - Math.random() * 80, size: 3, grow: 0, life: 0.45, age: 0, color: 'rgba(20,16,14,.85)' });
  }
  const m = metres(run);
  if (m >= lastMilestone + 250) {
    lastMilestone = Math.floor(m / 250) * 250;
    fx.word(`${lastMilestone} m!`, bx + 60, by - L.ppm * 2.4, { size: 28, fill: '#F4F0E8', life: 1.2 });
    announce(`${lastMilestone} metres`);
  }
}

function updateHud() {
  $('#hud-dist').textContent = `${metres(run)} m`;
  const left = KNEE_LIMIT - run.knee;
  const knee = $('#hud-knee');
  knee.textContent = '●'.repeat(Math.max(0, left)) + '○'.repeat(Math.min(KNEE_LIMIT, run.knee));
  knee.setAttribute('aria-label', `Knee: ${left} hit${left === 1 ? '' : 's'} left`);
  const g = run.glowing > 0 ? 100 : Math.round((run.glow / GLOW_BOLTS) * 100);
  $('#hud-glow').style.width = `${g}%`;
  $('#hud-glow-chip').classList.toggle('is-ready', run.glowing > 0);
}

function gameOver() {
  input.setEnabled(false);
  $('#hud').hidden = true;
  const m = metres(run);
  const coins = coinsFor(run);
  let best = false;
  profile = updateProfile((p) => {
    const r = setRecord(addCoins(p, coins), GAME, 'best', m, 'higher');
    best = r.isBest;
    return r.profile;
  }).profile;
  setCoins(profile.coins);
  $('#over-title').textContent = 'Blaze sits down';
  $('#over-body').replaceChildren(
    h('p', {}, 'She pulls the brace down and rubs the knee. Done for today.'),
    h('p', {}, h('strong', {}, `${m} m`), best ? ' (new best!)' : ` (best: ${profile.records[GAME]?.best ?? m} m)`),
    h('p', {}, `${run.bolts} bolts grabbed. ${coins} coins earned.`),
  );
  showPanel('panel-over');
  announce(`Run over. ${m} metres.`);
}

function idle() {
  const view = fitCanvas(canvas);
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  drawScene(ctx, view, createRun(1), createFx(), 0);
}
window.addEventListener('resize', () => { if (mode !== 'play') (run ? draw() : idle()); });

window.__blazesRun = { get run() { return run; } };

idle();
showPanel('panel-start');
