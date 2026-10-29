// Runs a Vercel-style (req, res) handler inside a Netlify Function.
export function toNetlify(handler) {
  return async (request) => {
    const url = new URL(request.url);
    const type = request.headers.get('content-type') || '';
    let body = {};
    if (request.method === 'POST') {
      if (type.includes('application/json')) body = await request.json().catch(() => ({}));
      else body = Object.fromEntries(new URLSearchParams(await request.text()));
    }
    const req = {
      method: request.method,
      headers: Object.fromEntries(request.headers),
      query: Object.fromEntries(url.searchParams),
      body
    };
    const out = { code: 200, headers: {}, body: null };
    const res = {
      status(c) { out.code = c; return res; },
      json(b) { out.body = JSON.stringify(b); out.headers['Content-Type'] = 'application/json'; return res; },
      send(b) { out.body = String(b); return res; },
      end() { return res; },
      setHeader(k, v) { out.headers[k] = v; }
    };
    await handler(req, res);
    return new Response(out.body, { status: out.code, headers: out.headers });
  };
}
