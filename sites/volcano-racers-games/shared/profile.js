// One player profile shared by every Volcano Racers game on this site.
// Stored in the browser (localStorage key "vr.player"). There is no server
// account yet. Coins here are for fun only: anyone can edit browser storage, so
// nothing of value (like trading cards) is ever awarded from it.

import { CARS } from './roster.js';

export const STORAGE_KEY = 'vr.player';
export const SCHEMA_VERSION = 1;
export const MAX_DAMAGE = 100;
export const MAX_SCARS = 12;
export const MAX_COINS = 999999;

function emptyGarage() {
  const garage = {};
  for (const c of CARS) garage[c.id] = { damage: 0, scars: [] };
  return garage;
}

export function createProfile() {
  return {
    v: SCHEMA_VERSION,
    name: '',
    coins: 0,
    favoriteCar: '02',
    garage: emptyGarage(),
    records: {},
    updatedAt: 0,
  };
}

const clampInt = (n, lo, hi) => {
  const x = Math.round(Number(n));
  if (!Number.isFinite(x)) return lo;
  return Math.min(hi, Math.max(lo, x));
};

// Accept anything (old versions, hand-edited JSON, junk) and return a valid profile.
export function sanitizeProfile(raw) {
  const p = createProfile();
  if (!raw || typeof raw !== 'object') return p;
  if (typeof raw.name === 'string') p.name = raw.name.trim().slice(0, 24);
  p.coins = clampInt(raw.coins, 0, MAX_COINS);
  if (typeof raw.favoriteCar === 'string' && p.garage[raw.favoriteCar]) p.favoriteCar = raw.favoriteCar;
  if (raw.garage && typeof raw.garage === 'object') {
    for (const id of Object.keys(p.garage)) {
      const g = raw.garage[id];
      if (!g || typeof g !== 'object') continue;
      p.garage[id].damage = clampInt(g.damage, 0, MAX_DAMAGE);
      if (Array.isArray(g.scars)) {
        p.garage[id].scars = g.scars
          .filter((s) => s && typeof s.label === 'string')
          .slice(-MAX_SCARS)
          .map((s) => ({ label: s.label.slice(0, 40), at: clampInt(s.at, 0, Number.MAX_SAFE_INTEGER) }));
      }
    }
  }
  if (raw.records && typeof raw.records === 'object') {
    for (const [game, rec] of Object.entries(raw.records)) {
      if (!rec || typeof rec !== 'object' || game.length > 32) continue;
      const clean = {};
      for (const [k, v] of Object.entries(rec)) {
        if (typeof v === 'number' && Number.isFinite(v) && k.length <= 32) clean[k] = v;
      }
      p.records[game] = clean;
    }
  }
  p.updatedAt = clampInt(raw.updatedAt, 0, Number.MAX_SAFE_INTEGER);
  return p;
}

const touch = (p, now) => ({ ...p, updatedAt: now ?? Date.now() });

export function setName(p, name) {
  return touch({ ...p, name: String(name || '').trim().slice(0, 24) });
}

export function setFavoriteCar(p, carId) {
  if (!p.garage[carId]) return p;
  return touch({ ...p, favoriteCar: carId });
}

export function addCoins(p, n) {
  return touch({ ...p, coins: clampInt(p.coins + n, 0, MAX_COINS) });
}

export function spendCoins(p, n) {
  if (n < 0 || p.coins < n) return { profile: p, ok: false };
  return { profile: touch({ ...p, coins: p.coins - n }), ok: true };
}

// "Toon physics, real scars": damage stays on the car until it is repaired.
export function applyDamage(p, carId, amount, scarLabel, now) {
  const g = p.garage[carId];
  if (!g || !(amount > 0)) return p;
  const scars = scarLabel ? [...g.scars, { label: String(scarLabel).slice(0, 40), at: now ?? Date.now() }].slice(-MAX_SCARS) : g.scars;
  const garage = { ...p.garage, [carId]: { damage: clampInt(g.damage + amount, 0, MAX_DAMAGE), scars } };
  return touch({ ...p, garage }, now);
}

// Repairing lowers damage. Scars are removed oldest first, one per 10 points repaired,
// and only once the car is fully fixed do all scars go.
export function repairCar(p, carId, amount) {
  const g = p.garage[carId];
  if (!g || !(amount > 0)) return p;
  const damage = clampInt(g.damage - amount, 0, MAX_DAMAGE);
  const fixed = g.damage - damage;
  const scars = damage === 0 ? [] : g.scars.slice(Math.floor(fixed / 10));
  return touch({ ...p, garage: { ...p.garage, [carId]: { damage, scars } } });
}

// Keep the best value for a game record. Returns whether it was a new best.
export function setRecord(p, game, key, value, better = 'higher') {
  if (typeof value !== 'number' || !Number.isFinite(value)) return { profile: p, isBest: false };
  const prev = p.records[game]?.[key];
  const isBest = prev === undefined || (better === 'higher' ? value > prev : value < prev);
  if (!isBest) return { profile: p, isBest: false };
  const records = { ...p.records, [game]: { ...(p.records[game] || {}), [key]: value } };
  return { profile: touch({ ...p, records }), isBest: true };
}

// ---- storage ----

function defaultStorage() {
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
}

export function loadProfile(storage = defaultStorage()) {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    return sanitizeProfile(raw ? JSON.parse(raw) : null);
  } catch {
    return createProfile();
  }
}

// Returns false when the browser blocks storage (private mode etc.); the game keeps
// working with the in-memory profile.
export function saveProfile(p, storage = defaultStorage()) {
  try {
    if (!storage) return false;
    storage.setItem(STORAGE_KEY, JSON.stringify(p));
    return true;
  } catch {
    return false;
  }
}

// Load, change, save in one step so two games open in two tabs don't overwrite
// each other's coins with a stale copy.
export function updateProfile(fn, storage = defaultStorage()) {
  const next = fn(loadProfile(storage));
  const saved = saveProfile(next, storage);
  return { profile: next, saved };
}
