import test from 'node:test';
import assert from 'node:assert/strict';
import handler, { validate } from '../api/subscribe.js';

function mockRes() {
  const r = { code: 0, body: null, headers: {} };
  r.status = (c) => { r.code = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  r.end = () => r;
  r.setHeader = (k, v) => { r.headers[k] = v; };
  return r;
}
const json = { accept: 'application/json' };

test('rejects non-POST', async () => {
  const res = mockRes();
  await handler({ method: 'GET', headers: {} }, res);
  assert.equal(res.code, 405);
});

test('validation', () => {
  assert.ok(validate({ email: 'bad', age_confirmed: 'yes' }).error);
  assert.ok(validate({ email: 'a@b.co' }).error);
  assert.equal(validate({ email: ' A@B.co ', age_confirmed: 'yes' }).email, 'A@B.co');
  assert.ok(validate({ company: 'x', email: 'a@b.co', age_confirmed: 'yes' }).spam);
});

test('stores a valid sign-up', async () => {
  const calls = [];
  const sql = (strings, ...vals) => { calls.push(vals); return Promise.resolve([{ token: null }]); };
  const res = mockRes();
  await handler({ method: 'POST', headers: json, body: { email: 'reader@example.com', age_confirmed: 'yes' } }, res, { sql, transport: null });
  assert.equal(res.code, 200);
  assert.deepEqual(res.body, { ok: true });
  assert.equal(calls[0][0], 'reader@example.com');
});

test('honeypot does not store', async () => {
  let called = false;
  const res = mockRes();
  await handler({ method: 'POST', headers: json, body: { company: 'bot', email: 'a@b.co', age_confirmed: 'yes' } }, res, { sql: () => { called = true; } });
  assert.equal(res.code, 200);
  assert.equal(called, false);
});

test('database failure returns 500, not success', async () => {
  const res = mockRes();
  await handler({ method: 'POST', headers: json, body: { email: 'a@b.co', age_confirmed: 'yes' } }, res, { sql: () => Promise.reject(new Error('down')) });
  assert.equal(res.code, 500);
  assert.equal(res.body.ok, false);
});

test('no-JS post redirects', async () => {
  const res = mockRes();
  await handler({ method: 'POST', headers: {}, body: { email: 'nope' } }, res, { sql: () => Promise.resolve() });
  assert.equal(res.code, 303);
  assert.equal(res.headers.Location, '/?signup=error#signup');
});

const TOKEN = '3f2b6f0e-8a1c-4d2e-9b7a-1c2d3e4f5a6b';

test('new sign-up gets a welcome email with an unsubscribe link', async () => {
  const sent = [], queries = [];
  const sql = (strings, ...vals) => {
    queries.push(strings.join('?'));
    return Promise.resolve(strings.join('').includes('vr_subscribe') ? [{ token: TOKEN }] : []);
  };
  const transport = { send: async (m) => { sent.push(m); return { id: 'x' }; } };
  process.env.SITE_URL = 'https://vr.example';
  const res = mockRes();
  await handler({ method: 'POST', headers: json, body: { email: 'new@example.com', age_confirmed: 'yes' } }, res, { sql, transport });
  delete process.env.SITE_URL;
  assert.equal(res.code, 200);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, 'new@example.com');
  assert.ok(sent[0].text.includes(`https://vr.example/api/unsubscribe?token=${TOKEN}`));
  assert.equal(sent[0].headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
  assert.ok(queries.some((q) => q.includes('vr_mark_welcome_sent')));
});

test('existing email gets no second welcome email', async () => {
  const sent = [];
  const sql = () => Promise.resolve([{ token: null }]);
  const res = mockRes();
  await handler({ method: 'POST', headers: json, body: { email: 'old@example.com', age_confirmed: 'yes' } }, res, { sql, transport: { send: async (m) => sent.push(m) } });
  assert.equal(res.code, 200);
  assert.equal(sent.length, 0);
});

test('email failure still keeps the sign-up and replies ok', async () => {
  let marked = false;
  const sql = (strings) => { if (strings.join('').includes('vr_mark_welcome_sent')) marked = true; return Promise.resolve([{ token: TOKEN }]); };
  const res = mockRes();
  await handler({ method: 'POST', headers: json, body: { email: 'a@b.co', age_confirmed: 'yes' } }, res, { sql, transport: { send: () => Promise.reject(new Error('Resend 500')) } });
  assert.equal(res.code, 200);
  assert.equal(marked, false);
});
