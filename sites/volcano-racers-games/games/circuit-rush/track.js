// Track geometry for Circuit Rush. Pure functions, no DOM, so they run in Node tests.

// Closed Catmull-Rom spline through control points, sampled every ~`step` px.
export function sampleClosedSpline(ctrl, step = 12) {
  const n = ctrl.length;
  const out = [];
  for (let i = 0; i < n; i++) {
    const p0 = ctrl[(i - 1 + n) % n];
    const p1 = ctrl[i];
    const p2 = ctrl[(i + 1) % n];
    const p3 = ctrl[(i + 2) % n];
    const segLen = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const count = Math.max(2, Math.ceil(segLen / step));
    for (let k = 0; k < count; k++) {
      const t = k / count;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a, b, c, d) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push({ x: f(p0[0], p1[0], p2[0], p3[0]), y: f(p0[1], p1[1], p2[1], p3[1]) });
    }
  }
  return out;
}

export function buildTrack(def) {
  const pts = sampleClosedSpline(def.points, 12);
  const n = pts.length;
  const cum = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    cum[i + 1] = cum[i] + Math.hypot(b.x - a.x, b.y - a.y);
  }
  const length = cum[n];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
  }
  const track = {
    id: def.id,
    name: def.name,
    blurb: def.blurb,
    width: def.width,
    laps: def.laps,
    pts,
    cum,
    length,
    bounds: { minX, minY, maxX, maxY },
    hazards: [],
  };
  // Hazards are placed by fraction of lap + sideways offset (in half-widths).
  for (const h of def.hazards || []) {
    const pos = pointAt(track, h.at * length);
    track.hazards.push({
      type: h.type,
      r: h.r,
      s: h.at * length,
      lat: h.offset * (def.width / 2),
      x: pos.x + pos.nx * h.offset * (def.width / 2),
      y: pos.y + pos.ny * h.offset * (def.width / 2),
    });
  }
  return track;
}

// Point, tangent and left-normal at arc length s.
export function pointAt(track, s) {
  const { pts, cum, length } = track;
  const n = pts.length;
  s = ((s % length) + length) % length;
  // binary search segment
  let lo = 0, hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (cum[mid] <= s) lo = mid; else hi = mid - 1;
  }
  const a = pts[lo];
  const b = pts[(lo + 1) % n];
  const segLen = cum[lo + 1] - cum[lo] || 1;
  const t = (s - cum[lo]) / segLen;
  const tx = (b.x - a.x) / segLen;
  const ty = (b.y - a.y) / segLen;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, tx, ty, nx: -ty, ny: tx, i: lo };
}

// Nearest point on the centreline. `hint` (a segment index) makes it a local search,
// which also stops cars snapping to a different part of the track that passes close by.
export function nearest(track, x, y, hint = -1, window = 40) {
  const { pts, cum } = track;
  const n = pts.length;
  let best = { d2: Infinity, i: 0, t: 0 };
  const check = (i) => {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy || 1;
    let t = ((x - a.x) * dx + (y - a.y) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const px = a.x + dx * t, py = a.y + dy * t;
    const d2 = (x - px) ** 2 + (y - py) ** 2;
    if (d2 < best.d2) best = { d2, i, t };
  };
  if (hint >= 0) {
    for (let k = -window; k <= window; k++) check((hint + k + n) % n);
  } else {
    for (let i = 0; i < n; i++) check(i);
  }
  const { i, t } = best;
  const a = pts[i];
  const b = pts[(i + 1) % n];
  const segLen = cum[i + 1] - cum[i] || 1;
  const tx = (b.x - a.x) / segLen, ty = (b.y - a.y) / segLen;
  const px = a.x + (b.x - a.x) * t, py = a.y + (b.y - a.y) * t;
  // signed lateral offset: + is to the left-normal side
  const lateral = (x - px) * -ty + (y - py) * tx;
  return { i, s: cum[i] + segLen * t, dist: Math.sqrt(best.d2), lateral, px, py, tx, ty, nx: -ty, ny: tx };
}

// How sharply the track turns over the next `ahead` px (radians). Used by AI to brake.
export function curvatureAhead(track, s, ahead = 160) {
  const a = pointAt(track, s);
  const b = pointAt(track, s + ahead);
  const ang = Math.atan2(a.tx * b.ty - a.ty * b.tx, a.tx * b.tx + a.ty * b.ty);
  return Math.abs(ang);
}

// Progress tracking that survives the wrap from end of lap to start.
export function advanceProgress(progress, lastS, s, length) {
  let d = s - lastS;
  if (d < -length / 2) d += length;
  else if (d > length / 2) d -= length;
  return progress + d;
}

export const TRACKS = [
  {
    id: 'cinder-loop',
    name: 'Cinder Isle Loop',
    blurb: 'Black-sand sweepers along the shore. No logos allowed.',
    width: 190,
    laps: 3,
    points: [[400, 800], [500, 420], [900, 260], [1500, 300], [2000, 360], [2220, 720], [2000, 1100], [1500, 1150], [1220, 960], [900, 1200], [500, 1240]],
    hazards: [
      { type: 'lava', at: 0.32, offset: 0.45, r: 34 },
      { type: 'lava', at: 0.62, offset: -0.4, r: 38 },
      { type: 'rocks', at: 0.82, offset: 0.35, r: 30 },
    ],
  },
  {
    id: 'ash-canyon',
    name: 'Ash Canyon',
    blurb: 'Hairpins between basalt walls. Brake or bounce.',
    width: 170,
    laps: 3,
    points: [[300, 300], [1000, 200], [1300, 520], [1000, 780], [1400, 1020], [2100, 900], [2220, 1400], [1500, 1620], [800, 1520], [620, 1100], [300, 900]],
    hazards: [
      { type: 'lava', at: 0.18, offset: -0.35, r: 34 },
      { type: 'rocks', at: 0.4, offset: 0.4, r: 30 },
      { type: 'lava', at: 0.55, offset: 0.3, r: 40 },
      { type: 'rocks', at: 0.74, offset: -0.4, r: 32 },
      { type: 'lava', at: 0.9, offset: 0.0, r: 30 },
    ],
  },
  {
    id: 'magma-spiral',
    name: 'Magma Spiral',
    blurb: 'Up the volcano and back down. The lava moves in closer.',
    width: 180,
    laps: 3,
    points: [[1200, 200], [1900, 300], [2300, 700], [2200, 1300], [1700, 1600], [1100, 1500], [900, 1150], [1300, 1000], [1500, 750], [1100, 600], [620, 790], [450, 1300], [230, 1010], [230, 640], [500, 350]],
    hazards: [
      { type: 'lava', at: 0.1, offset: 0.4, r: 36 },
      { type: 'lava', at: 0.26, offset: -0.45, r: 40 },
      { type: 'rocks', at: 0.38, offset: 0.3, r: 30 },
      { type: 'lava', at: 0.5, offset: -0.2, r: 44 },
      { type: 'lava', at: 0.66, offset: 0.45, r: 38 },
      { type: 'rocks', at: 0.78, offset: -0.35, r: 30 },
      { type: 'lava', at: 0.9, offset: 0.4, r: 36 },
    ],
  },
];
