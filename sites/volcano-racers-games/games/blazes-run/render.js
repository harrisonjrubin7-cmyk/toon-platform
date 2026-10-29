// Side-on drawing for Blaze's Run. PLACEHOLDER art in the approved cast colours.
import { CHARACTERS } from '../../shared/roster.js';
import { STAND_H } from './logic.js';

const B = CHARACTERS.blaze;
const INK = '#161616';

export function layout(view) {
  const ppm = Math.max(28, Math.min(64, view.height / 8.5));
  return { ppm, groundY: Math.round(view.height * 0.78), blazeX: Math.round(view.width * 0.26) };
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

export function drawScene(ctx, view, run, fx, t) {
  const { width, height } = view;
  const L = layout(view);
  const toX = (d) => L.blazeX + (d - run.dist) * L.ppm;
  const toY = (y) => L.groundY - y * L.ppm;

  // Sky: dusk over the volcano
  const sky = ctx.createLinearGradient(0, 0, 0, L.groundY);
  sky.addColorStop(0, '#2B2422'); sky.addColorStop(0.55, '#7a2e1c'); sky.addColorStop(1, '#FF8A3D');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, width, L.groundY);
  ctx.fillStyle = 'rgba(255,194,26,.85)';
  ctx.beginPath(); ctx.arc(width * 0.78, L.groundY * 0.55, Math.min(width, height) * 0.08, 0, Math.PI * 2); ctx.fill();

  // Far volcano (slow parallax)
  const farOff = -((run.dist * 2) % (width * 1.6));
  for (let k = 0; k < 2; k++) {
    const bx = farOff + k * width * 1.6 + width * 0.5;
    ctx.fillStyle = '#3a2a26';
    ctx.beginPath();
    ctx.moveTo(bx - width * 0.5, L.groundY);
    ctx.lineTo(bx - width * 0.08, L.groundY * 0.42);
    ctx.lineTo(bx + width * 0.08, L.groundY * 0.42);
    ctx.lineTo(bx + width * 0.5, L.groundY);
    ctx.fill();
    ctx.fillStyle = '#FF5A1F';
    ctx.beginPath(); ctx.ellipse(bx, L.groundY * 0.43, width * 0.075, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(60,52,50,.6)';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath(); ctx.arc(bx + Math.sin(t * 0.5 + i) * 20 + i * 18, L.groundY * 0.38 - i * 30, 22 + i * 8, 0, Math.PI * 2); ctx.fill();
    }
  }
  // Mid hills
  ctx.fillStyle = '#2B2422';
  const midOff = -((run.dist * L.ppm * 0.3) % 400);
  ctx.beginPath(); ctx.moveTo(0, L.groundY);
  for (let x = -400; x <= width + 400; x += 40) {
    const wx = x + midOff;
    ctx.lineTo(wx, L.groundY - 40 - Math.sin((x - midOff + run.dist * L.ppm * 0.3) / 90) * 22 - 30);
  }
  ctx.lineTo(width + 400, L.groundY); ctx.fill();

  // Ground
  ctx.fillStyle = '#1d1816'; ctx.fillRect(0, L.groundY, width, height - L.groundY);
  ctx.fillStyle = '#4a3b33'; ctx.fillRect(0, L.groundY, width, 6);
  ctx.strokeStyle = 'rgba(244,240,232,.12)'; ctx.lineWidth = 2;
  const stripe = (run.dist * L.ppm) % 60;
  for (let x = -stripe; x < width; x += 60) { ctx.beginPath(); ctx.moveTo(x, L.groundY + 26); ctx.lineTo(x + 24, L.groundY + 26); ctx.stroke(); }

  // Obstacles
  for (const o of run.obstacles) {
    const x0 = toX(o.x), x1 = toX(o.x + o.w);
    if (x1 < -50 || x0 > width + 50) continue;
    if (o.kind === 'crack') {
      ctx.fillStyle = '#0a0706'; ctx.fillRect(x0, L.groundY - 1, x1 - x0, height - L.groundY + 1);
      const g = ctx.createLinearGradient(0, L.groundY + 20, 0, height);
      g.addColorStop(0, 'rgba(255,90,31,0)'); g.addColorStop(1, `rgba(255,${120 + Math.sin(t * 4) * 40},31,.95)`);
      ctx.fillStyle = g; ctx.fillRect(x0 + 4, L.groundY + 10, x1 - x0 - 8, height - L.groundY);
      ctx.strokeStyle = INK; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x0, L.groundY); ctx.lineTo(x0 + 6, height); ctx.moveTo(x1, L.groundY); ctx.lineTo(x1 - 6, height); ctx.stroke();
    } else if (o.kind === 'boulder') {
      const hgt = o.h * L.ppm;
      ctx.fillStyle = '#5c5552'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse((x0 + x1) / 2, L.groundY - hgt / 2, (x1 - x0) / 2 + 4, hgt / 2, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#7a726e';
      ctx.beginPath(); ctx.ellipse((x0 + x1) / 2 - 6, L.groundY - hgt * 0.65, (x1 - x0) / 5, hgt / 6, -0.3, 0, Math.PI * 2); ctx.fill();
    } else if (o.kind === 'smoke') {
      const top = toY(3.6), bottom = toY(1.0);
      ctx.fillStyle = 'rgba(40,36,34,.95)';
      ctx.fillRect(x0, top, x1 - x0, bottom - top);
      for (let x = x0; x <= x1; x += 22) {
        ctx.beginPath(); ctx.arc(x, bottom + Math.sin(x * 0.1 + t * 3) * 3, 14, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + 8, top, 18, 0, Math.PI * 2); ctx.fill();
      }
      // falling pebbles
      ctx.fillStyle = '#7a726e';
      for (let i = 0; i < 4; i++) {
        const px = x0 + ((i * 37 + t * 50) % Math.max(10, x1 - x0));
        const py = bottom + ((t * 120 + i * 30) % 30);
        ctx.fillRect(px, py, 4, 4);
      }
    } else if (o.kind === 'drone') {
      const cx = (x0 + x1) / 2, cy = toY(o.y + 0.25);
      ctx.fillStyle = '#4A4F57'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
      rr(ctx, cx - 18, cy - 9, 36, 18, 6); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#C9A227'; ctx.fillRect(cx - 14, cy - 2, 28, 4);
      ctx.fillStyle = '#E8262B'; ctx.beginPath(); ctx.arc(cx - 10, cy, 4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#C9CED6'; ctx.lineWidth = 2;
      const spin = Math.sin(t * 50) * 12;
      ctx.beginPath(); ctx.moveTo(cx - 12 - spin, cy - 14); ctx.lineTo(cx - 12 + spin, cy - 14); ctx.moveTo(cx + 12 - spin, cy - 14); ctx.lineTo(cx + 12 + spin, cy - 14); ctx.stroke();
    }
  }

  // Bolts
  for (const p of run.pickups) {
    if (p.taken) continue;
    const x = toX(p.x), y = toY(p.y) + Math.sin(t * 5 + p.x) * 3;
    if (x < -20 || x > width + 20) continue;
    drawBolt(ctx, x, y, 11);
  }

  // Shadows Blaze left behind
  for (const s of run.shadows) {
    const x = toX(s.x);
    if (x < -60 || x > width + 60) continue;
    drawBlazeFigure(ctx, x, L.groundY, L.ppm, { pose: s.v > 2 ? 'run' : 'panting', t: s.v > 2 ? run.t * 0.8 : t, shadow: true });
  }

  // Blaze
  const pose = run.flat > 0 ? 'flat' : run.sliding > 0 ? 'slide' : run.onGround ? 'run' : 'jump';
  if (run.glowing > 0) {
    const g = ctx.createRadialGradient(L.blazeX, toY(run.y + 0.8), 4, L.blazeX, toY(run.y + 0.8), L.ppm * 1.8);
    g.addColorStop(0, 'rgba(255,194,26,.55)'); g.addColorStop(1, 'rgba(255,194,26,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(L.blazeX, toY(run.y + 0.8), L.ppm * 1.8, 0, Math.PI * 2); ctx.fill();
    // speed streaks
    ctx.strokeStyle = 'rgba(255,194,26,.6)'; ctx.lineWidth = 3;
    for (let i = 0; i < 5; i++) { const y = toY(run.y + 0.3 + i * 0.3); ctx.beginPath(); ctx.moveTo(L.blazeX - 30 - i * 6, y); ctx.lineTo(L.blazeX - 90 - ((t * 400 + i * 30) % 60), y); ctx.stroke(); }
  }
  const blink = run.invuln > 0 && run.flat <= 0 && Math.floor(t * 12) % 2 === 0;
  if (!blink) drawBlazeFigure(ctx, L.blazeX, toY(run.y), L.ppm, { pose, t: run.t, glow: run.glowing > 0, soot: run.soot > 0 });

  fx.draw(ctx);
}

export function drawBolt(ctx, x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#FFC21A'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(s * 0.2, -s); ctx.lineTo(-s * 0.6, s * 0.15); ctx.lineTo(-s * 0.05, s * 0.15);
  ctx.lineTo(-s * 0.3, s); ctx.lineTo(s * 0.6, -s * 0.2); ctx.lineTo(s * 0.05, -s * 0.2); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.restore();
}

// Blaze: slim golden cheetah, magma spots, red bandana, bolt pendant, knee brace (locked design notes).
export function drawBlazeFigure(ctx, x, footY, ppm, { pose = 'run', t = 0, glow = false, soot = false, shadow = false }) {
  const u = (ppm * STAND_H) / 2.1; // head top sits at her standing height
  const fur = shadow ? 'rgba(10,8,8,.75)' : soot ? '#141212' : B.fur;
  const spots = glow ? B.glow : B.spots;
  ctx.save();
  ctx.translate(x, footY);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (pose === 'flat') {
    // squashed into a rug, eyes blinking
    ctx.scale(1.7, 0.22);
  } else if (pose === 'slide') {
    ctx.rotate(-1.25);
    ctx.translate(-u * 0.2, -u * 0.25);
  } else if (pose === 'panting') {
    ctx.rotate(0.35);
  } else {
    ctx.rotate(0.22); // forward lean, built on a diagonal
  }
  const phase = t * 14;
  const legA = pose === 'run' ? Math.sin(phase) : pose === 'jump' ? 0.9 : pose === 'panting' ? 0.15 : 0.5;
  const legB = pose === 'run' ? Math.sin(phase + Math.PI) : pose === 'jump' ? -0.6 : pose === 'panting' ? -0.15 : -0.3;
  const hip = { x: 0, y: -u * 0.85 };
  const leg = (swing, brace) => {
    const knee = { x: hip.x + Math.sin(swing) * u * 0.42, y: hip.y + Math.cos(swing) * u * 0.42 };
    const foot = { x: knee.x + Math.sin(swing - 0.6 * Math.abs(swing)) * u * 0.45, y: Math.min(0, knee.y + u * 0.45) };
    if (!shadow) { // light rim so dark tights read against the black sand
      ctx.strokeStyle = 'rgba(232,179,58,.55)'; ctx.lineWidth = u * 0.16 + 3;
      ctx.beginPath(); ctx.moveTo(hip.x, hip.y); ctx.lineTo(knee.x, knee.y); ctx.lineTo(foot.x, foot.y); ctx.stroke();
    }
    ctx.strokeStyle = shadow ? fur : B.tights; ctx.lineWidth = u * 0.16;
    ctx.beginPath(); ctx.moveTo(hip.x, hip.y); ctx.lineTo(knee.x, knee.y); ctx.lineTo(foot.x, foot.y); ctx.stroke();
    if (brace && !shadow && !soot) {
      ctx.strokeStyle = B.brace; ctx.lineWidth = u * 0.2;
      ctx.beginPath(); ctx.moveTo(knee.x - u * 0.04, knee.y - u * 0.05); ctx.lineTo(knee.x + u * 0.03, knee.y + u * 0.06); ctx.stroke();
    }
  };
  leg(legB, false);
  // tail
  ctx.strokeStyle = fur; ctx.lineWidth = u * 0.09;
  ctx.beginPath(); ctx.moveTo(-u * 0.1, -u * 0.95); ctx.quadraticCurveTo(-u * 0.7, -u * 1.0 + Math.sin(phase) * u * 0.1, -u * 0.85, -u * 1.35); ctx.stroke();
  // torso
  ctx.fillStyle = fur; ctx.strokeStyle = INK; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(0, -u * 1.25, u * 0.22, u * 0.48, 0, 0, Math.PI * 2); ctx.fill(); if (!shadow) ctx.stroke();
  if (!shadow && !soot) {
    ctx.fillStyle = spots;
    for (const [sx, sy] of [[-0.08, -1.05], [0.07, -1.3], [-0.05, -1.5], [0.1, -1.1]]) { ctx.beginPath(); ctx.arc(sx * u, sy * u, u * 0.045, 0, Math.PI * 2); ctx.fill(); }
  }
  leg(legA, true);
  // arm
  ctx.strokeStyle = fur; ctx.lineWidth = u * 0.11;
  const arm = pose === 'run' ? Math.sin(phase + Math.PI) * 0.9 : pose === 'panting' ? 0.6 : -0.8;
  ctx.beginPath(); ctx.moveTo(0, -u * 1.55); ctx.lineTo(Math.sin(arm) * u * 0.4, -u * 1.55 + Math.cos(arm) * u * 0.4); ctx.stroke();
  // head
  const hy = -u * 1.9;
  ctx.fillStyle = fur; ctx.strokeStyle = INK; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(u * 0.05, hy, u * 0.2, 0, Math.PI * 2); ctx.fill(); if (!shadow) ctx.stroke();
  ctx.beginPath(); ctx.ellipse(u * 0.24, hy + u * 0.05, u * 0.12, u * 0.08, 0, 0, Math.PI * 2); ctx.fill(); if (!shadow) ctx.stroke();
  // ears
  for (const ex of [-0.08, 0.12]) { ctx.beginPath(); ctx.arc(ex * u, hy - u * 0.18, u * 0.06, 0, Math.PI * 2); ctx.fill(); }
  if (!shadow) {
    // eyes
    ctx.fillStyle = soot ? '#fff' : INK;
    ctx.beginPath(); ctx.arc(u * 0.14, hy - u * 0.04, u * 0.03, 0, Math.PI * 2); ctx.fill();
    if (!soot) {
      // tear marks
      ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(u * 0.15, hy); ctx.lineTo(u * 0.2, hy + u * 0.1); ctx.stroke();
      // bandana scarf, flapping behind
      ctx.fillStyle = B.bandana;
      ctx.beginPath(); ctx.moveTo(-u * 0.12, hy + u * 0.17); ctx.lineTo(u * 0.16, hy + u * 0.2); ctx.lineTo(u * 0.1, hy + u * 0.3);
      ctx.lineTo(-u * 0.12, hy + u * 0.28); ctx.closePath(); ctx.fill();
      const flap = Math.sin(phase * 1.3) * u * 0.06;
      ctx.beginPath(); ctx.moveTo(-u * 0.12, hy + u * 0.2); ctx.lineTo(-u * 0.55, hy + u * 0.1 + flap); ctx.lineTo(-u * 0.5, hy + u * 0.28 + flap); ctx.closePath(); ctx.fill();
      // pendant
      drawBolt(ctx, u * 0.06, hy + u * 0.42, u * 0.07);
    }
  } else {
    // panting shadow: white eyes and a HUFF puff
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(u * 0.14, hy - u * 0.04, u * 0.035, Math.sin(t * 6) > 0.8 ? 1 : u * 0.04, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
