import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blobStore, defaultStore } from '../lib/store.js';
import subscribe from '../api/subscribe.js';
import unsubscribe from '../api/unsubscribe.js';

// In-memory stand-in for a Netlify Blobs store (get / setJSON with onlyIfNew).
function memoryBlobs() {
  const data = new Map();
  return {
    data,
    async get(key) { return data.has(key) ? JSON.parse(data.get(key)) : null; },
    async setJSON(key, value, opts = {}) {
      if (opts.onlyIfNew && data.has(key)) return { modified: false };
      data.set(key, JSON.stringify(value));
      return { modified: true };
    }
  };
}

function mockRes() {
  const r = { statusCode: 200, headers: {}, body: undefined };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  r.send = (b) => { r.body = b; return r; };
  r.end = () => r;
  r.setHeader = (k, v) => { r.headers[k] = v; };
  return r;
}

test('blob store: first sign-up gets a token, duplicate (any case) gets null', async () => {
  const store = blobStore(memoryBlobs());
  const t = await store.subscribe('Rider@Example.com', 'ua');
  assert.match(t, /^[0-9a-f-]{36}$/);
  assert.equal(await store.subscribe('rider@example.com ', 'ua'), null);
});

test('blob store: concurrent duplicates produce exactly one token', async () => {
  const store = blobStore(memoryBlobs());
  const results = await Promise.all([store.subscribe('a@b.co', ''), store.subscribe('a@b.co', '')]);
  assert.equal(results.filter(Boolean).length, 1);
});

test('blob store: welcome mark and unsubscribe update the record', async () => {
  const blobs = memoryBlobs();
  const store = blobStore(blobs, () => '2026-10-29T00:00:00.000Z');
  const t = await store.subscribe('a@b.co', '');
  await store.markWelcomeSent(t);
  assert.equal(await store.unsubscribe(t), true);
  assert.equal(await store.unsubscribe('00000000-0000-4000-8000-000000000000'), false);
  const rec = [...blobs.data.entries()].find(([k]) => k.startsWith('signups/'))[1];
  const parsed = JSON.parse(rec);
  assert.equal(parsed.welcome_sent_at, '2026-10-29T00:00:00.000Z');
  assert.equal(parsed.unsubscribed_at, '2026-10-29T00:00:00.000Z');
});

test('blob store: re-signup after unsubscribing does not resubscribe', async () => {
  const store = blobStore(memoryBlobs());
  const t = await store.subscribe('a@b.co', '');
  await store.unsubscribe(t);
  assert.equal(await store.subscribe('a@b.co', ''), null);
});

test('handlers work end to end on the blob store', async () => {
  const store = blobStore(memoryBlobs());
  const sent = [];
  const transport = { send: async (m) => { sent.push(m); } };
  const res = mockRes();
  await subscribe({ method: 'POST', headers: { accept: 'application/json', host: 'x.test' },
    body: { email: 'fan@example.com', age_confirmed: true } }, res, { store, transport });
  assert.equal(res.statusCode, 200);
  assert.equal(sent.length, 1);
  const token = sent[0].text.match(/token=([0-9a-f-]{36})/)[1];
  const res2 = mockRes();
  await unsubscribe({ method: 'POST', headers: {}, query: {}, body: { token } }, res2, { store });
  assert.equal(res2.statusCode, 200);
});

test('defaultStore picks Neon when DATABASE_URL is set', async () => {
  const s = await defaultStore({ DATABASE_URL: 'postgresql://u:p@localhost/db' });
  assert.equal(s.kind, 'neon');
});
