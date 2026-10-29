// Netlify wrapper around the same handler used on Vercel (api/subscribe.js).
import handler from '../../api/subscribe.js';

export default async (request) => {
  const type = request.headers.get('content-type') || '';
  let body = {};
  if (request.method === 'POST') {
    if (type.includes('application/json')) body = await request.json().catch(() => ({}));
    else body = Object.fromEntries(new URLSearchParams(await request.text()));
  }
  const req = { method: request.method, headers: Object.fromEntries(request.headers), body };
  const out = { code: 200, headers: {}, body: null };
  const res = {
    status(c) { out.code = c; return res; },
    json(b) { out.body = JSON.stringify(b); out.headers['Content-Type'] = 'application/json'; return res; },
    end() { return res; },
    setHeader(k, v) { out.headers[k] = v; }
  };
  await handler(req, res);
  return new Response(out.body, { status: out.code, headers: out.headers });
};

export const config = { path: '/api/subscribe' };
