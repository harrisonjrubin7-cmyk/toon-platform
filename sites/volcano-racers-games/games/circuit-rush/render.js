// Canvas drawing for Circuit Rush. PLACEHOLDER art in brand colours.

import { pointAt } from './track.js';
import { WALL_MARGIN } from './car.js';
import { drawCarShape, drawSfx } from '../../shared/draw.js';

const PAD = 260;

// The static track is drawn once per race into an offscreen canvas.
export function renderTrackLayer(track) {
  const { minX, minY, maxX, maxY } = track.bounds;
  const ox = minX - PAD, oy = minY - PAD;
  const w = Math.ceil(maxX - minX + PAD * 2), h = Math.ceil(maxY - minY + PAD * 2);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.translate(-ox, -oy);

  // Ground: basalt with speckle
  g.fillStyle = '#2B2422';
  g.fillRect(ox, oy, w, h);
  let r = 12345;
  const rand = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < (w * h) / 900; i++) {
    g.fillStyle = rand() < 0.5 ? 'rgba(0,0,0,.18)' : 'rgba(255,255,255,.04)';
    g.fillRect(ox + rand() * w, oy + rand() * h, 2 + rand() * 3, 2 + rand() * 3);
  }
  // Distant lava cracks for mood
  g.strokeStyle = 'rgba(255,90,31,.35)';
  g.lineWidth = 3;
  for (let i = 0; i < 18; i++) {
    let x = ox + rand() * w, y = oy + rand() * h;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 5; k++) { x += (rand() - 0.5) * 90; y += (rand() - 0.5) * 90; g.lineTo(x, y); }
    g.stroke();
  }

  const path = new Path2D();
  track.pts.forEach((p, i) => (i ? path.lineTo(p.x, p.y) : path.moveTo(p.x, p.y)));
  path.closePath();
  g.lineJoin = 'round'; g.lineCap = 'round';

  // Wall (outer ink line), sand run-off, kerbs, road.
  g.strokeStyle = '#161616';
  g.lineWidth = track.width + WALL_MARGIN * 2 + 14;
  g.stroke(path);
  g.strokeStyle = '#6b5446';
  g.lineWidth = track.width + WALL_MARGIN * 2;
  g.stroke(path);
  g.lineCap = 'butt';
  g.setLineDash([22, 22]);
  g.strokeStyle = '#FF5A1F';
  g.lineWidth = track.width + 14;
  g.stroke(path);
  g.setLineDash([22, 22]);
  g.lineDashOffset = 22;
  g.strokeStyle = '#F4F0E8';
  g.stroke(path);
  g.setLineDash([]);
  g.lineCap = 'round';
  g.strokeStyle = '#1d1816';
  g.lineWidth = track.width;
  g.stroke(path);
  // centre dashes
  g.setLineDash([18, 30]);
  g.strokeStyle = 'rgba(244,240,232,.18)';
  g.lineWidth = 3;
  g.stroke(path);
  g.setLineDash([]);

  // Start/finish checkers across the road at s = 0
  const s0 = pointAt(track, 0);
  const cells = 10, cw = track.width / cells;
  for (let i = 0; i < cells; i++) {
    for (let j = 0; j < 2; j++) {
      g.fillStyle = (i + j) % 2 ? '#F4F0E8' : '#161616';
      const lat = -track.width / 2 + i * cw;
      const cx = s0.x + s0.nx * lat + s0.tx * (j * cw - cw);
      const cy = s0.y + s0.ny * lat + s0.ty * (j * cw - cw);
      g.save(); g.translate(cx, cy); g.rotate(Math.atan2(s0.ty, s0.tx));
      g.fillRect(0, 0, cw, cw); g.restore();
    }
  }

  // Rocks are static; lava is drawn live so it can glow.
  for (const hz of track.hazards) {
    if (hz.type !== 'rocks') continue;
    g.fillStyle = '#161616';
    g.beginPath(); g.arc(hz.x + 3, hz.y + 4, hz.r, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#5c5552';
    g.beginPath(); g.arc(hz.x, hz.y, hz.r, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#7a726e';
    g.beginPath(); g.arc(hz.x - hz.r * 0.3, hz.y - hz.r * 0.3, hz.r * 0.45, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#161616'; g.lineWidth = 3;
    g.beginPath(); g.arc(hz.x, hz.y, hz.r, 0, Math.PI * 2); g.stroke();
  }
  return { canvas: c, ox, oy };
}

// Small overview map, drawn once.
export function renderMinimap(track, size = 150) {
  const { minX, minY, maxX, maxY } = track.bounds;
  const scale = (size - 16) / Math.max(maxX - minX, maxY - minY);
  const c = document.createElement('canvas');
  const w = Math.ceil((maxX - minX) * scale + 16), h = Math.ceil((maxY - minY) * scale + 16);
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(22,22,22,.75)'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#F4F0E8'; g.lineWidth = 4; g.lineJoin = 'round';
  g.beginPath();
  track.pts.forEach((p, i) => {
    const x = 8 + (p.x - minX) * scale, y = 8 + (p.y - minY) * scale;
    i ? g.lineTo(x, y) : g.moveTo(x, y);
  });
  g.closePath(); g.stroke();
  return { canvas: c, scale, minX, minY };
}

export function drawRace(ctx, view, race, layer, mini, fx, opts) {
  const { width, height, dpr } = view;
  const { cam, t } = opts;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#2B2422';
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.translate(width / 2 + cam.shakeX, height / 2 + cam.shakeY);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.x, -cam.y);
  ctx.drawImage(layer.canvas, layer.ox, layer.oy);

  // Lava pools pulse
  for (const hz of race.track.hazards) {
    if (hz.type !== 'lava') continue;
    const pulse = 0.85 + 0.15 * Math.sin(t * 3 + hz.x);
    const grd = ctx.createRadialGradient(hz.x, hz.y, 2, hz.x, hz.y, hz.r * 1.5);
    grd.addColorStop(0, '#FFE08A');
    grd.addColorStop(0.35, '#FFC21A');
    grd.addColorStop(0.7, '#FF5A1F');
    grd.addColorStop(1, 'rgba(232,38,43,0)');
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(hz.x, hz.y, hz.r * 1.5 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#161616'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(hz.x, hz.y, hz.r, 0, Math.PI * 2); ctx.stroke();
  }
  for (const o of race.oils) {
    ctx.fillStyle = `rgba(10,10,14,${Math.min(0.85, o.ttl / 2)})`;
    ctx.beginPath(); ctx.ellipse(o.x, o.y, o.r, o.r * 0.7, 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(123,44,191,.6)'; ctx.lineWidth = 2; ctx.stroke();
  }

  // Cars: shadows first, then bodies
  for (const car of race.cars) {
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.beginPath(); ctx.ellipse(car.x + 4, car.y + 6, 26, 15, car.a, 0, Math.PI * 2); ctx.fill();
  }
  for (const car of race.cars) {
    if (car.wrecked > 0) {
      ctx.fillStyle = '#161616';
      ctx.beginPath(); ctx.arc(car.x, car.y, 18 + (1.4 - car.wrecked) * 12, 0, Math.PI * 2); ctx.fill();
      continue;
    }
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.a);
    const sq = car.squash > 0 ? Math.sin((car.squash / 0.35) * Math.PI) * 0.35 : 0;
    ctx.scale(1 - sq * 0.6, 1 + sq);
    if (car.glide > 0) ctx.scale(1.12, 1.12);
    drawCarShape(ctx, car.def, { damage: car.damage, soot: car.soot, glide: car.glide, boost: car.boost, invuln: car.invuln, t, seed: car.def.id.charCodeAt(0) });
    ctx.restore();
    if (car.isPlayer) {
      ctx.strokeStyle = '#FFC21A'; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(car.x - 7, car.y - 40); ctx.lineTo(car.x + 7, car.y - 40); ctx.lineTo(car.x, car.y - 31); ctx.closePath();
      ctx.fillStyle = '#FFC21A'; ctx.fill();
    }
  }
  fx.draw(ctx);
  ctx.restore();

  // Minimap (top right, under HUD on narrow screens it moves to bottom)
  if (mini) {
    const mx = width - mini.canvas.width - 12;
    const my = width < 600 ? height - mini.canvas.height - 96 : 12 + 64;
    ctx.drawImage(mini.canvas, mx, my);
    for (const car of race.cars) {
      ctx.fillStyle = car.isPlayer ? '#FFC21A' : car.def.body;
      ctx.strokeStyle = '#161616'; ctx.lineWidth = 1.5;
      const x = mx + 8 + (car.x - mini.minX) * mini.scale;
      const y = my + 8 + (car.y - mini.minY) * mini.scale;
      ctx.beginPath(); ctx.arc(x, y, car.isPlayer ? 5 : 3.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
  }

  // Countdown
  if (race.time < 0.8) {
    const n = Math.ceil(-race.time);
    const txt = race.time < 0 ? String(n) : 'GO!';
    const age = race.time < 0 ? 1 - (-race.time - (n - 1)) : race.time;
    drawSfx(ctx, txt, width / 2, height / 2 - 40, { size: 96, age: Math.min(age, 0.4), life: 10, angle: 0, fill: race.time < 0 ? '#F4F0E8' : '#FFC21A' });
  }
}

export function updateCamera(cam, target, view, dt, reduceMotion) {
  const lead = 0.35;
  const tx = target.x + target.vx * lead, ty = target.y + target.vy * lead;
  const k = 1 - Math.exp(-dt * 5);
  cam.x += (tx - cam.x) * k;
  cam.y += (ty - cam.y) * k;
  const want = Math.min(view.width, view.height) < 600 ? Math.min(view.width, view.height) / 560 : Math.min(view.width / 1150, view.height / 760);
  cam.zoom += (Math.max(0.45, Math.min(1.3, want)) - cam.zoom) * k;
  cam.shake = Math.max(0, cam.shake - dt * 2.5);
  const s = reduceMotion ? 0 : cam.shake * 14;
  cam.shakeX = (Math.random() - 0.5) * s;
  cam.shakeY = (Math.random() - 0.5) * s;
}
