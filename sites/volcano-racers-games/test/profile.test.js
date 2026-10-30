import test from 'node:test';
import assert from 'node:assert/strict';
import { createProfile, sanitizeProfile, applyDamage, repairCar, addCoins, spendCoins, setRecord, loadProfile, saveProfile, updateProfile, STORAGE_KEY } from '../shared/profile.js';

const memStorage = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m };
};

test('junk and hostile input become a clean profile', () => {
  for (const raw of [null, 5, 'x', [], { coins: -9 }, { coins: 'lots' }, { garage: { '02': { damage: 900, scars: [{ label: 7 }] } } }, { records: { g: { a: 'x', b: 3 } } }]) {
    const p = sanitizeProfile(raw);
    assert.ok(p.coins >= 0);
    for (const g of Object.values(p.garage)) assert.ok(g.damage >= 0 && g.damage <= 100);
  }
  assert.equal(sanitizeProfile({ garage: { '02': { damage: 900 } } }).garage['02'].damage, 100);
  assert.deepEqual(sanitizeProfile({ records: { g: { a: 'x', b: 3 } } }).records, { g: { b: 3 } });
  assert.equal(sanitizeProfile({ name: '  ' + 'x'.repeat(40) }).name.length, 24);
});

test('damage stays until repaired; scars clear when fully fixed', () => {
  let p = createProfile();
  p = applyDamage(p, '02', 35, 'Lava scorch', 1);
  p = applyDamage(p, '02', 20, 'Wall dent', 2);
  assert.equal(p.garage['02'].damage, 55);
  assert.equal(p.garage['02'].scars.length, 2);
  p = repairCar(p, '02', 10);
  assert.equal(p.garage['02'].damage, 45);
  assert.equal(p.garage['02'].scars.length, 1);
  p = repairCar(p, '02', 100);
  assert.equal(p.garage['02'].damage, 0);
  assert.equal(p.garage['02'].scars.length, 0);
  assert.equal(applyDamage(p, 'nope', 10).garage.nope, undefined);
});

test('coins can not go negative', () => {
  let p = addCoins(createProfile(), 30);
  assert.equal(spendCoins(p, 40).ok, false);
  const r = spendCoins(p, 20);
  assert.equal(r.ok, true);
  assert.equal(r.profile.coins, 10);
  assert.equal(addCoins(p, -100).coins, 0);
});

test('records keep the best value', () => {
  let p = createProfile();
  let r = setRecord(p, 'g', 'time', 50, 'lower'); p = r.profile; assert.ok(r.isBest);
  r = setRecord(p, 'g', 'time', 60, 'lower'); assert.ok(!r.isBest);
  r = setRecord(p, 'g', 'time', 40, 'lower'); assert.ok(r.isBest); assert.equal(r.profile.records.g.time, 40);
});

test('storage round trip, blocked storage and corrupt JSON', () => {
  const s = memStorage();
  const p = addCoins(createProfile(), 12);
  assert.ok(saveProfile(p, s));
  assert.equal(loadProfile(s).coins, 12);
  s.setItem(STORAGE_KEY, '{not json');
  assert.equal(loadProfile(s).coins, 0);
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.equal(loadProfile(blocked).coins, 0);
  assert.equal(saveProfile(p, blocked), false);
});

test('updateProfile reads fresh so two tabs do not lose coins', () => {
  const s = memStorage();
  saveProfile(addCoins(createProfile(), 10), s);
  updateProfile((p) => addCoins(p, 5), s); // tab A
  updateProfile((p) => addCoins(p, 7), s); // tab B
  assert.equal(loadProfile(s).coins, 22);
});
