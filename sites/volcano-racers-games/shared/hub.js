import { GAMES } from './games.js';
import { CARS } from './roster.js';
import { loadProfile, updateProfile, setName, createProfile, saveProfile } from './profile.js';
import { $, h, fmtTime, setCoins, announce } from './ui.js';
import { drawCarShape } from './draw.js';

let profile = loadProfile();

function renderGames() {
  $('#game-list').replaceChildren(...GAMES.map((g) => {
    const art = h('canvas', { width: 520, height: 240, 'aria-hidden': 'true' });
    drawCardArt(art, g);
    const foot = g.href
      ? h('a', { class: 'tn-btn', href: g.href, ...(g.external ? { rel: 'noopener' } : {}) }, `Play ${g.title}`)
      : h('p', { class: 'hub-game__pending' }, g.pending);
    return h('li', { class: 'hub-game' },
      h('div', { class: 'hub-game__art' }, art),
      h('div', { class: 'hub-game__body' },
        h('p', { class: 'hub-game__n' }, `Game ${g.n}`),
        h('h3', { class: 'hub-game__title' }, g.title),
        h('p', { class: 'hub-game__stars' }, `Starring ${g.stars}`),
        h('p', { class: 'hub-game__blurb' }, g.blurb)),
      h('div', { class: 'hub-game__foot' }, foot));
  }));
}

// Simple placeholder banner per game, drawn in code.
function drawCardArt(c, g) {
  const ctx = c.getContext('2d');
  const grd = ctx.createLinearGradient(0, 0, 0, c.height);
  grd.addColorStop(0, '#2B2422'); grd.addColorStop(1, '#120e0d');
  ctx.fillStyle = grd; ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = g.color; ctx.globalAlpha = 0.9;
  ctx.beginPath(); ctx.moveTo(0, c.height); ctx.lineTo(c.width * 0.35, c.height * 0.35); ctx.lineTo(c.width * 0.5, c.height * 0.5); ctx.lineTo(c.width * 0.62, c.height * 0.2); ctx.lineTo(c.width, c.height); ctx.fill();
  ctx.globalAlpha = 1;
  if (g.id === 'circuit-rush' || g.id === 'pit-crew') {
    const cars = g.id === 'pit-crew' ? [CARS[2]] : CARS;
    cars.forEach((car, i) => {
      ctx.save();
      ctx.translate(g.id === 'pit-crew' ? c.width / 2 : 70 + i * 95, c.height * 0.72 - (i % 2) * 30);
      ctx.rotate(-0.2);
      ctx.scale(g.id === 'pit-crew' ? 3 : 1.6, g.id === 'pit-crew' ? 3 : 1.6);
      drawCarShape(ctx, car, { damage: g.id === 'pit-crew' ? 70 : 0, seed: i + 3 });
      ctx.restore();
    });
  }
  ctx.font = '900 64px "Arial Black", Impact, sans-serif';
  ctx.textAlign = 'right'; ctx.textBaseline = 'top';
  ctx.lineWidth = 10; ctx.strokeStyle = '#161616'; ctx.lineJoin = 'round';
  ctx.strokeText(String(g.n), c.width - 20, 16);
  ctx.fillStyle = '#F4F0E8'; ctx.fillText(String(g.n), c.width - 20, 16);
}

function renderPlayer() {
  setCoins(profile.coins);
  $('#player-name').value = profile.name;
  const rows = [];
  for (const g of GAMES) {
    for (const r of g.records || []) {
      const v = profile.records[g.id]?.[r.key];
      rows.push(h('dt', {}, `${g.title}: ${r.label}`), h('dd', {}, v === undefined ? '—' : r.time ? fmtTime(v) : `${v}${r.unit ? ' ' + r.unit : ''}`));
    }
  }
  $('#records').replaceChildren(...rows);
  $('#garage').replaceChildren(...CARS.map((c) => {
    const gar = profile.garage[c.id];
    return h('li', {},
      h('strong', {}, `${c.number} ${c.driver}`),
      h('span', {}, gar.damage ? `Damage ${gar.damage}%` : 'No damage'),
      h('div', { class: 'vr-damage', role: 'img', 'aria-label': `Damage ${gar.damage} percent` }, h('span', { style: { width: `${gar.damage}%` } })),
      gar.damage ? h('a', { href: `games/pit-crew/?car=${c.id}` }, `Repair ${c.number} in Pit Crew`) : null);
  }));
}

$('#name-form').addEventListener('submit', (e) => {
  e.preventDefault();
  profile = updateProfile((p) => setName(p, $('#player-name').value)).profile;
  $('#name-status').textContent = profile.name ? `Saved. Hi, ${profile.name}.` : 'Name cleared.';
});

$('#btn-reset').addEventListener('click', () => {
  if (!window.confirm('Wipe coins, scores and car damage in this browser?')) return;
  profile = createProfile();
  saveProfile(profile);
  renderPlayer();
  announce('Racer file wiped.');
});

window.addEventListener('storage', (e) => { if (e.key === 'vr.player') { profile = loadProfile(); renderPlayer(); } });
window.addEventListener('pageshow', () => { profile = loadProfile(); renderPlayer(); });

renderGames();
renderPlayer();
