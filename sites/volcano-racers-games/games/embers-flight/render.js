// Drawing for Ember's Flight. PLACEHOLDER art in the approved cast colours.
import { CHARACTERS } from '../../shared/roster.js';
import { CARS } from '../../shared/roster.js';
import { drawCarShape } from '../../shared/draw.js';
import { SKY_H, VIEW_W, FIRE_MAX, BREATH_RANGE } from './logic.js';

const E = CHARACTERS.ember;
const HATCH = Object.fromEntries(CHARACTERS.hatchlings.map((h) => [h.id, h]));
const INK = '#161616';

function mix(a, b, k) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * k)).join(',')})`;
}

export function scaleFor(view) {
  // Fit 10 sky units in the height, but keep the full 16 wide visible on narrow screens.
  const groundH = Math.max(50, view.height * 0.12);
  const hudH = 12; // the HUD is a strip above the canvas now; small top margin only
  const u = Math.min((view.height - groundH - hudH) / SKY_H, view.width / VIEW_W * 1.25);
  return { u, groundH, top: view.height - groundH - SKY_H * u };
}

export function drawFlight(ctx, view, f, fx, t) {
  const { width, height } = view;
  const S = scaleFor(view);
  const X = (x) => x * S.u;
  const Y = (y) => S.top + y * S.u;

  // Night-into-dusk sky
  const g = ctx.createLinearGradient(0, 0, 0, height);
  g.addColorStop(0, '#161226'); g.addColorStop(0.6, '#4a2230'); g.addColorStop(1, '#a8452a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, width, height);
  // stars
  ctx.fillStyle = 'rgba(244,240,232,.7)';
  for (let i = 0; i < 60; i++) {
    const sx = ((i * 97.3 - f.dist * 3) % width + width) % width;
    const sy = (i * 53.7) % (height * 0.5);
    ctx.fillRect(sx, sy, 2, 2);
  }
  // clouds, two depths
  for (const [speed, alpha, size] of [[6, 0.18, 70], [16, 0.28, 44]]) {
    ctx.fillStyle = `rgba(244,240,232,${alpha})`;
    for (let i = 0; i < 6; i++) {
      const cx = (((i * 311 - f.dist * speed) % (width + 300)) + width + 300) % (width + 300) - 150;
      const cy = (i * 131) % (height * 0.7) + 30;
      ctx.beginPath(); ctx.arc(cx, cy, size, 0, Math.PI * 2); ctx.arc(cx + size, cy + 10, size * 0.8, 0, Math.PI * 2); ctx.arc(cx - size, cy + 12, size * 0.7, 0, Math.PI * 2); ctx.fill();
    }
  }

  // Gearlock's airship (background, huge, a little ridiculous)
  if (f.airship) drawAirship(ctx, X(f.airship.x), Y(0.2), S.u, t);

  // The Circuit far below, with the team cars racing
  const gy = height - S.groundH;
  ctx.fillStyle = '#2B2422'; ctx.fillRect(0, gy, width, S.groundH);
  ctx.fillStyle = '#1d1816'; ctx.fillRect(0, gy + S.groundH * 0.3, width, S.groundH * 0.4);
  ctx.fillStyle = '#FF5A1F';
  const kerb = (f.dist * S.u) % 40;
  for (let x = -kerb; x < width; x += 40) ctx.fillRect(x, gy + S.groundH * 0.3 - 4, 20, 4);
  CARS.forEach((c, i) => {
    const cx = ((i * 230 + t * 40 * (1 + i * 0.1) - f.dist * S.u * 0.5) % (width + 200) + width + 200) % (width + 200) - 100;
    ctx.save(); ctx.translate(cx, gy + S.groundH * 0.5); ctx.scale(0.8, 0.8);
    drawCarShape(ctx, c, { t });
    ctx.restore();
  });
  // vents
  ctx.fillStyle = 'rgba(255,90,31,.7)';
  for (let i = 0; i < 4; i++) {
    const vx = ((i * 400 - f.dist * S.u) % (width + 400) + width + 400) % (width + 400) - 200;
    ctx.beginPath(); ctx.ellipse(vx, gy + 4, 30, 6, 0, 0, Math.PI * 2); ctx.fill();
  }

  // Coals
  for (const c of f.coals) {
    const cg = ctx.createRadialGradient(X(c.x), Y(c.y), 1, X(c.x), Y(c.y), S.u * 0.45);
    cg.addColorStop(0, '#FFE08A'); cg.addColorStop(0.5, '#FF5A1F'); cg.addColorStop(1, 'rgba(232,38,43,0)');
    ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(X(c.x), Y(c.y), S.u * 0.45, 0, Math.PI * 2); ctx.fill();
  }

  // Drones
  for (const d of f.drones) drawDrone(ctx, X(d.x), Y(d.y), S.u, t, d.kind);

  // Lost hatchlings call for help; followers trail behind
  for (const h of f.hatchlings) {
    if (h.state === 'waiting') continue;
    drawHatchling(ctx, X(h.x), Y(h.y), S.u, HATCH[h.id], t, h.state === 'lost');
  }

  // Fire breath
  if (f.breathing) {
    const x0 = X(f.x + 0.6), y0 = Y(f.y);
    const len = BREATH_RANGE * S.u;
    const fg = ctx.createLinearGradient(x0, 0, x0 + len, 0);
    fg.addColorStop(0, '#FFE08A'); fg.addColorStop(0.4, '#FFC21A'); fg.addColorStop(1, 'rgba(255,90,31,0)');
    ctx.fillStyle = fg;
    ctx.beginPath(); ctx.moveTo(x0, y0 - 6);
    ctx.lineTo(x0 + len, y0 - S.u * (0.5 + BREATH_RANGE * 0.35) + Math.sin(t * 30) * 4);
    ctx.lineTo(x0 + len, y0 + S.u * (0.5 + BREATH_RANGE * 0.35) + Math.cos(t * 30) * 4);
    ctx.lineTo(x0, y0 + 6); ctx.closePath(); ctx.fill();
  }

  const blink = f.invuln > 0 && Math.floor(t * 12) % 2 === 0;
  if (!blink) drawEmber(ctx, X(f.x), Y(f.y), S.u, f.fire / FIRE_MAX, t, f);

  fx.draw(ctx);
}

// Ember: huge round red-orange dragon, cream belly, small wings, checkered cap.
// His colour dulls toward grey as his fire fades (the fade ladder).
export function drawEmber(ctx, x, y, u, fire, t, f = {}) {
  const r = u * 0.75;
  const body = mix(E.faded, E.body, Math.max(0, Math.min(1, fire)));
  const flap = Math.sin(t * 9) * 0.5;
  ctx.save();
  ctx.translate(x, y);
  const hug = f.hug > 0 ? 1 + Math.sin((f.hug / 0.8) * Math.PI) * 0.15 : 1;
  ctx.scale(hug, 1 / hug);
  ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.lineJoin = 'round';
  // tail
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.moveTo(-r * 0.8, r * 0.1); ctx.quadraticCurveTo(-r * 1.6, r * 0.2 + Math.sin(t * 4) * r * 0.2, -r * 1.9, -r * 0.3); ctx.lineTo(-r * 1.6, r * 0.25); ctx.quadraticCurveTo(-r * 1.2, r * 0.5, -r * 0.7, r * 0.45); ctx.closePath(); ctx.fill(); ctx.stroke();
  // back wing
  ctx.fillStyle = mix('#5a3a32', E.body, fire * 0.6);
  ctx.beginPath(); ctx.moveTo(-r * 0.1, -r * 0.5); ctx.lineTo(-r * 0.9, -r * (1.3 + flap)); ctx.lineTo(-r * 0.2, -r * 0.9); ctx.closePath(); ctx.fill(); ctx.stroke();
  // body
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // grey patch on the chest once the fire starts to go (Issue #4)
  if (fire < 0.8) { ctx.fillStyle = 'rgba(154,154,154,.6)'; ctx.beginPath(); ctx.ellipse(r * 0.15, r * 0.35, r * 0.25, r * 0.18, 0.2, 0, Math.PI * 2); ctx.fill(); }
  // belly
  ctx.fillStyle = E.belly;
  ctx.beginPath(); ctx.ellipse(r * 0.2, r * 0.3, r * 0.55, r * 0.5, 0.2, 0, Math.PI * 2); ctx.fill();
  // front wing
  ctx.fillStyle = mix('#7a4a3a', '#FF8A3D', fire);
  ctx.beginPath(); ctx.moveTo(-r * 0.05, -r * 0.4); ctx.lineTo(-r * 0.7, -r * (1.2 - flap)); ctx.lineTo(r * 0.25, -r * 0.75); ctx.closePath(); ctx.fill(); ctx.stroke();
  // head
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.ellipse(r * 0.85, -r * 0.35, r * 0.48, r * 0.4, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // checkered cap
  const cx = r * 0.75, cy = -r * 0.72;
  ctx.save();
  ctx.beginPath(); ctx.ellipse(cx, cy, r * 0.36, r * 0.18, -0.15, Math.PI, 0); ctx.closePath(); ctx.clip();
  const cs = r * 0.12;
  for (let i = -4; i < 4; i++) for (let j = -2; j < 1; j++) { ctx.fillStyle = (i + j) % 2 ? '#F5F5F0' : INK; ctx.fillRect(cx + i * cs, cy + j * cs, cs, cs); }
  ctx.restore();
  ctx.fillStyle = INK; ctx.fillRect(cx, cy - 2, r * 0.45, 4); // brim
  // eye
  ctx.fillStyle = E.eyes; ctx.beginPath(); ctx.arc(r * 1.0, -r * 0.42, r * 0.1, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(r * 1.03, -r * 0.42, r * 0.045, 0, Math.PI * 2); ctx.fill();
  // nostril smoke when low
  if (fire < 0.3 && Math.sin(t * 3) > 0.6) { ctx.fillStyle = 'rgba(160,160,160,.6)'; ctx.beginPath(); ctx.arc(r * 1.4, -r * 0.5, r * 0.12, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}

function drawHatchling(ctx, x, y, u, h, t, lost) {
  const r = u * 0.28;
  ctx.save();
  ctx.translate(x, y + Math.sin(t * 6 + x) * 2);
  ctx.lineWidth = 2; ctx.strokeStyle = INK;
  ctx.fillStyle = h.color;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(r * 0.8, -r * 0.4, r * 0.55, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  const w = Math.sin(t * 14) * r * 0.4;
  ctx.beginPath(); ctx.moveTo(-r * 0.2, -r * 0.6); ctx.lineTo(-r * 0.8, -r * 1.2 - w); ctx.lineTo(0, -r * 0.8); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(r * 1.0, -r * 0.5, r * 0.12, 0, Math.PI * 2); ctx.fill();
  if (h.id === 'spark') { ctx.fillStyle = '#7a2e1c'; ctx.beginPath(); ctx.arc(r * 1.25, -r * 0.2, r * 0.18, 0, Math.PI * 2); ctx.fill(); } // mouth always open
  if (lost) {
    ctx.font = `900 ${Math.round(u * 0.35)}px "Arial Black", sans-serif`;
    ctx.fillStyle = '#F4F0E8'; ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.textAlign = 'center';
    ctx.strokeText('!', 0, -r * 1.6); ctx.fillText('!', 0, -r * 1.6);
  }
  ctx.restore();
}

function drawDrone(ctx, x, y, u, t, kind) {
  const w = u * 0.55, hgt = u * 0.3;
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = kind === 'diver' ? '#3a3f47' : '#4A4F57'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(0, 0, w / 2, hgt / 2, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#C9A227'; ctx.fillRect(-w * 0.35, -2, w * 0.7, 4);
  ctx.fillStyle = '#E8262B'; ctx.beginPath(); ctx.arc(-w * 0.25, 0, hgt * 0.18, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#C9CED6';
  const s = Math.sin(t * 50) * w * 0.3;
  ctx.beginPath(); ctx.moveTo(-s, -hgt * 0.8); ctx.lineTo(s, -hgt * 0.8); ctx.stroke();
  ctx.restore();
}

function drawAirship(ctx, x, y, u, t) {
  const L = u * 9, H = u * 2.2;
  ctx.save(); ctx.translate(x, y + H / 2);
  // smog
  ctx.fillStyle = 'rgba(58,53,54,.55)';
  for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(-L * 0.3 + i * L * 0.12, -H * 0.8 - Math.sin(t + i) * 6, u * 0.6, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#4A4F57'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(0, 0, L / 2, H / 2, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // stacks
  for (let i = 0; i < 6; i++) { ctx.fillRect(-L * 0.3 + i * L * 0.12, -H * 0.62, u * 0.25, u * 0.5); }
  // glowing logos
  ctx.font = `900 ${Math.round(u * 0.45)}px "Arial Black", sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#C9A227'; ctx.fillText('GEARCORP', -L * 0.2, -H * 0.1);
  ctx.fillStyle = '#2FBF71'; ctx.fillText('GEARBET', L * 0.22, -H * 0.1);
  // LED screen with Gearlock
  ctx.fillStyle = '#e8eef5'; ctx.fillRect(-u * 0.9, H * 0.15, u * 1.8, u * 0.9);
  ctx.fillStyle = '#1F1A24'; ctx.beginPath(); ctx.arc(0, H * 0.15 + u * 0.5, u * 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(-u * 0.22, H * 0.15 + u * 0.02, u * 0.44, u * 0.22); // top hat
  ctx.fillStyle = '#C9A227'; ctx.beginPath(); ctx.arc(u * 0.1, H * 0.15 + u * 0.46, u * 0.08, 0, Math.PI * 2); ctx.fill(); // monocle
  // claw
  ctx.strokeStyle = '#B08D57'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(L * 0.25, H * 0.45); ctx.lineTo(L * 0.25, H * 1.2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(L * 0.25 - u * 0.3, H * 1.45); ctx.lineTo(L * 0.25, H * 1.2); ctx.lineTo(L * 0.25 + u * 0.3, H * 1.45); ctx.stroke();
  ctx.restore();
}
