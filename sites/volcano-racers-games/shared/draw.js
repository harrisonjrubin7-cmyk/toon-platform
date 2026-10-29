// Placeholder art drawn in code: simple shapes in the approved cast colours.
// PLACEHOLDER: replace with Harrison's character and car designs once approved.

const DRIVER_HEADS = {
  '02': { color: '#1F7A4D', helmet: '#F07C1B' }, // Quackers: green head, dented orange helmet
  '07': { color: '#C9A277', ears: '#1E1E1E' }, // Joe: tan, black-tipped ears
  '11': { color: '#F7F5F0', goggles: '#B5853A' }, // Pip: white mouse, brass goggles
  '44': { color: '#F08A2C', shades: '#D4AF37' }, // Duke: orange tabby, gold aviators
  '19': { color: '#8B6B4A', patch: '#2E5EAA' }, // Wren: speckled brown, blue wing patch
  gc: { color: '#4A4F57' },
};

const SIZES = {
  roadster: { l: 40, w: 24 },
  cruiser: { l: 52, w: 24 },
  micro: { l: 30, w: 20 },
  wedge: { l: 50, w: 25 },
  modern: { l: 46, w: 23 },
};

export function carSize(def) {
  return SIZES[def.shape] || SIZES.modern;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Draws a car centred on (0,0) pointing along +x. Caller sets transform.
export function drawCarShape(ctx, def, o = {}) {
  const { damage = 0, soot = 0, glide = 0, boost = 0, invuln = 0, t = 0, seed = 1, driver = true } = o;
  const sz = SIZES[def.shape] || SIZES.modern;
  const L = sz.l, W = sz.w;
  const sooty = soot > 0;
  const ink = '#161616';

  // Wings (Pip's glide)
  if (glide > 0) {
    ctx.fillStyle = '#B5853A';
    ctx.strokeStyle = ink; ctx.lineWidth = 2;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(-4, s * W * 0.4);
      ctx.lineTo(-12, s * (W * 0.5 + 26));
      ctx.lineTo(8, s * (W * 0.5 + 14));
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  }
  // Boost flame
  if (boost > 0) {
    const f = 14 + Math.sin(t * 40) * 5;
    ctx.fillStyle = '#FFC21A';
    ctx.beginPath(); ctx.moveTo(-L / 2, -6); ctx.lineTo(-L / 2 - f - 10, 0); ctx.lineTo(-L / 2, 6); ctx.fill();
    ctx.fillStyle = '#FF5A1F';
    ctx.beginPath(); ctx.moveTo(-L / 2, -4); ctx.lineTo(-L / 2 - f, 0); ctx.lineTo(-L / 2, 4); ctx.fill();
  }

  // Wheels
  ctx.fillStyle = ink;
  const wx = L * 0.3, wy = W / 2;
  for (const [x, y] of [[wx, -wy], [wx, wy], [-wx, -wy], [-wx, wy]]) {
    if (def.id === '07' && x < 0 && y > 0 && damage > 60) continue; // Joe's tire falls off ("it's a style")
    roundRect(ctx, x - 6, y - 3.5, 12, 7, 2); ctx.fill();
  }

  // Body
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = ink;
  ctx.fillStyle = sooty ? '#1a1a1a' : def.body;
  if (def.shape === 'wedge') {
    ctx.beginPath();
    ctx.moveTo(L / 2, 0);
    ctx.lineTo(-L / 2 + 4, -W / 2);
    ctx.lineTo(-L / 2, -W / 2 + 4);
    ctx.lineTo(-L / 2, W / 2 - 4);
    ctx.lineTo(-L / 2 + 4, W / 2);
    ctx.closePath();
  } else {
    roundRect(ctx, -L / 2, -W / 2, L, W, def.shape === 'micro' ? 9 : 7);
  }
  ctx.fill(); ctx.stroke();

  if (!sooty) {
    // Trim stripe
    ctx.fillStyle = def.trim;
    ctx.fillRect(-L / 2 + 3, -2, L - 6, 4);
    // Number roundel
    ctx.fillStyle = '#F5F5F0';
    ctx.beginPath(); ctx.arc(-L * 0.12, 0, 8, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = ink; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = ink;
    ctx.font = '700 8px Arial, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(def.id === 'gc' ? 'GC' : def.id, -L * 0.12, 0.5);
    if (def.logos) {
      ctx.fillStyle = '#C9A227';
      ctx.fillRect(L * 0.18, -W / 2 + 3, 8, 4);
      ctx.fillRect(L * 0.18, W / 2 - 7, 8, 4);
    }
  }

  // Driver head (left out when the car is up on the lift)
  const head = DRIVER_HEADS[def.id] || DRIVER_HEADS.gc;
  const hx = L * 0.14;
  if (!driver) {
    ctx.fillStyle = '#161616';
    ctx.beginPath(); ctx.ellipse(hx, 0, 6, 5, 0, 0, Math.PI * 2); ctx.fill();
  } else {
  ctx.fillStyle = sooty ? '#000' : head.helmet || head.color;
  ctx.beginPath(); ctx.arc(hx, 0, 6.5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = ink; ctx.lineWidth = 1.5; ctx.stroke();
  if (!sooty) {
    if (head.ears) { // Joe's ears stream back
      ctx.fillStyle = head.color;
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(hx - 9, s * 3, 8, 2.5, s * 0.2, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = head.ears;
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(hx - 15, s * 4, 2.5, 2, 0, 0, Math.PI * 2); ctx.fill(); }
    }
    if (head.goggles) { ctx.fillStyle = head.goggles; ctx.fillRect(hx + 1, -5, 4, 10); }
    if (head.shades) { ctx.fillStyle = head.shades; ctx.fillRect(hx + 2, -4, 3, 8); }
    if (head.patch) { ctx.fillStyle = head.patch; ctx.fillRect(hx - 4, -6, 3, 3); }
  }
  }

  // Scars: scratches and dents that build up with damage. Deterministic per car.
  if (!sooty && damage > 5) {
    let r = seed * 9301 + 49297;
    const rand = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
    const n = Math.min(10, Math.floor(damage / 10));
    ctx.strokeStyle = 'rgba(22,22,22,.75)'; ctx.lineWidth = 1.5;
    for (let i = 0; i < n; i++) {
      const x = (rand() - 0.5) * (L - 8), y = (rand() - 0.5) * (W - 6);
      ctx.beginPath(); ctx.moveTo(x - 4, y - 2); ctx.lineTo(x + 3, y + 1); ctx.lineTo(x + 5, y - 1); ctx.stroke();
    }
    if (damage >= 50) {
      ctx.fillStyle = 'rgba(22,22,22,.35)';
      ctx.beginPath(); ctx.ellipse(L * 0.3, -W * 0.25, 6, 4, 0.4, 0, Math.PI * 2); ctx.fill();
    }
  }

  // Soot gag: blinking white eyes on a black silhouette
  if (sooty) {
    const blink = Math.sin(t * 9) > 0.85;
    ctx.fillStyle = '#fff';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(hx + 4, s * 4, blink ? 2.5 : 2.5, blink ? 0.6 : 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (invuln > 0) {
    ctx.strokeStyle = `rgba(255,194,26,${0.5 + 0.5 * Math.sin(t * 20)})`;
    ctx.lineWidth = 3;
    roundRect(ctx, -L / 2 - 6, -W / 2 - 6, L + 12, W + 12, 12); ctx.stroke();
  }
}

// Comic sound-effect lettering.
export function drawSfx(ctx, text, x, y, { size = 28, fill = '#FFC21A', stroke = '#161616', age = 0, life = 0.8, angle = -0.12 } = {}) {
  const k = Math.min(1, age / 0.12);
  const fade = age > life * 0.6 ? 1 - (age - life * 0.6) / (life * 0.4) : 1;
  if (fade <= 0) return;
  ctx.save();
  ctx.translate(x, y - age * 30);
  ctx.rotate(angle);
  const s = 0.6 + 0.5 * k - 0.1 * Math.max(0, k - 0.9);
  ctx.scale(s, s);
  ctx.globalAlpha = Math.max(0, fade);
  ctx.font = `900 ${size}px "Arial Black", Impact, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = size * 0.22; ctx.strokeStyle = stroke;
  ctx.strokeText(text, 0, 0);
  ctx.fillStyle = fill;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

// Tiny particle system for smoke, sparks and SFX words.
export function createFx() {
  const parts = [];
  const words = [];
  return {
    parts, words,
    puff(x, y, { color = 'rgba(60,55,52,.6)', n = 4, speed = 40, size = 10, life = 0.9 } = {}) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = speed * (0.4 + Math.random());
        parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, size: size * (0.6 + Math.random() * 0.8), grow: size * 1.2, life, age: 0, color });
      }
    },
    sparks(x, y, n = 8) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = 120 + Math.random() * 220;
        parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, size: 2.5, grow: -2, life: 0.35 + Math.random() * 0.2, age: 0, color: Math.random() < 0.5 ? '#FFC21A' : '#FF5A1F' });
      }
    },
    word(text, x, y, opts = {}) {
      words.push({ text, x, y, age: 0, ...opts });
      if (words.length > 12) words.shift();
    },
    update(dt) {
      for (const p of parts) { p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.94; p.vy *= 0.94; p.size = Math.max(0.5, p.size + p.grow * dt); }
      for (const w of words) w.age += dt;
      for (let i = parts.length - 1; i >= 0; i--) if (parts[i].age >= parts[i].life) parts.splice(i, 1);
      for (let i = words.length - 1; i >= 0; i--) if (words[i].age >= (words[i].life || 0.8)) words.splice(i, 1);
      if (parts.length > 400) parts.splice(0, parts.length - 400);
    },
    draw(ctx) {
      for (const p of parts) {
        ctx.globalAlpha = Math.max(0, 1 - p.age / p.life);
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      for (const w of words) drawSfx(ctx, w.text, w.x, w.y, w);
    },
  };
}
