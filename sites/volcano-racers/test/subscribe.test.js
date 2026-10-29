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
  const sql = (strings, ...vals) => { calls.push(vals); return Promise.resolve([]); };
  const res = mockRes();
  await handler({ method: 'POST', headers: json, body: { email: 'reader@example.com', age_confirmed: 'yes' } }, res, { sql });
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
