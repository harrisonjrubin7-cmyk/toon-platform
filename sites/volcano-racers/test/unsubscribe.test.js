import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/unsubscribe.js';
import { resendTransport, configuredTransport } from '../lib/email.js';

function mockRes() {
  const r = { code: 0, body: null, headers: {} };
  r.status = (c) => { r.code = c; return r; };
  r.send = (b) => { r.body = b; return r; };
  r.json = (b) => { r.body = b; return r; };
  r.end = () => r;
  r.setHeader = (k, v) => { r.headers[k] = v; };
  return r;
}
const TOKEN = '3f2b6f0e-8a1c-4d2e-9b7a-1c2d3e4f5a6b';
const db = (ok) => (strings, ...vals) => Promise.resolve([{ ok, vals }]);

test('GET shows a confirm form and changes nothing', async () => {
  let called = false;
  const res = mockRes();
  await handler({ method: 'GET', headers: {}, query: { token: TOKEN } }, res, { sql: () => { called = true; } });
  assert.equal(res.code, 200);
  assert.ok(res.body.includes(`value="${TOKEN}"`));
  assert.equal(called, false);
});

test('bad or missing token is rejected without a query', async () => {
  for (const token of [undefined, 'abc', '"><script>']) {
    const res = mockRes();
    await handler({ method: 'POST', headers: {}, query: { token }, body: {} }, res, { sql: () => { throw new Error('should not query'); } });
    assert.equal(res.code, 400);
    assert.ok(!res.body.includes('<script>'));
  }
});

test('POST unsubscribes a known token', async () => {
  const res = mockRes();
  await handler({ method: 'POST', headers: {}, query: {}, body: { token: TOKEN } }, res, { sql: db(true) });
  assert.equal(res.code, 200);
  assert.ok(res.body.includes('You&#39;re unsubscribed'));
});

test('POST with unknown token says the link is not valid', async () => {
  const res = mockRes();
  await handler({ method: 'POST', headers: {}, query: {}, body: { token: TOKEN } }, res, { sql: db(false) });
  assert.equal(res.code, 404);
});

test('one-click unsubscribe from mail apps', async () => {
  const res = mockRes();
  await handler({ method: 'POST', headers: {}, query: { token: TOKEN }, body: { 'List-Unsubscribe': 'One-Click' } }, res, { sql: db(true) });
  assert.equal(res.code, 200);
  assert.equal(res.body, 'Unsubscribed');
});

test('database failure is a 500 page, not a fake success', async () => {
  const res = mockRes();
  await handler({ method: 'POST', headers: {}, query: {}, body: { token: TOKEN } }, res, { sql: () => Promise.reject(new Error('down')) });
  assert.equal(res.code, 500);
  assert.ok(!res.body.includes('You&#39;re unsubscribed'));
});

test('email is off unless both env vars are set', () => {
  assert.equal(configuredTransport({}), null);
  assert.equal(configuredTransport({ RESEND_API_KEY: 'k' }), null);
  assert.equal(configuredTransport({ RESEND_API_KEY: 'k', EMAIL_FROM: 'a@b.c' }).name, 'resend');
});

test('Resend call shape and error reporting', async () => {
  const calls = [];
  const t = resendTransport('key', 'Tune <a@b.c>', async (url, init) => { calls.push({ url, init }); return new Response('{"id":"e1"}'); });
  assert.equal((await t.send({ to: 'x@y.z', subject: 's', text: 't' })).id, 'e1');
  assert.equal(calls[0].url, 'https://api.resend.com/emails');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer key');
  const bad = resendTransport('k', 'f', async () => new Response('nope', { status: 422 }));
  await assert.rejects(bad.send({ to: 'x@y.z', subject: 's', text: 't' }), /Resend 422/);
});
