// Small DOM helpers shared by the game pages.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// Build elements without innerHTML so names and labels can never inject markup.
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v === null || v === undefined) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'text') el.textContent = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function fmtTime(sec) {
  if (sec === null || sec === undefined || !Number.isFinite(sec)) return '—';
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
}

// Show one overlay panel, hide the others, and move focus into it.
export function showPanel(id) {
  for (const p of $$('.vr-panel')) p.hidden = p.id !== id;
  if (!id) return;
  const panel = document.getElementById(id);
  const target = panel?.querySelector('[data-autofocus]') || panel?.querySelector('h2');
  if (target) {
    if (!target.hasAttribute('tabindex') && target.tagName === 'H2') target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  }
}

export function setCoins(n) {
  for (const el of $$('[data-coins]')) el.textContent = String(n);
}

export function announce(msg) {
  const live = document.getElementById('vr-live');
  if (!live) return;
  live.textContent = '';
  // Re-set on the next frame so screen readers repeat identical messages.
  requestAnimationFrame(() => { live.textContent = msg; });
}

// Fit a canvas to its box at device pixel ratio. Returns the view size in CSS px.
export function fitCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(1, Math.round(rect.width * dpr));
  const hgt = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== w || canvas.height !== hgt) { canvas.width = w; canvas.height = hgt; }
  return { width: rect.width, height: rect.height, dpr };
}
