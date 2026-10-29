// /api/unsubscribe?token=… — GET shows a confirm button (so link scanners that
// prefetch URLs cannot unsubscribe anyone); POST unsubscribes. POST also serves
// one-click unsubscribe from mail apps (RFC 8058, body "List-Unsubscribe=One-Click").
import { neon } from '@neondatabase/serverless';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function page(title, body) {
  return `<!doctype html>
<html lang="en" data-theme="noir">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)} · Volcano Racers</title>
  <meta name="robots" content="noindex, nofollow">
  <link rel="icon" href="/brand/logos/tune-icon-tile.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/brand/tokens/tokens.css">
  <link rel="stylesheet" href="/brand/tokens/components.css">
  <link rel="stylesheet" href="/styles.css">
</head>
<body class="tn-ip--volcano-racers">
  <main class="hero hero--short">
    <div class="wrap wrap--narrow">
      <img class="logo" src="/brand/logos/volcano-racers-wordmark-on-dark.svg" alt="Volcano Racers" width="1040" height="420">
      <h1 class="tagline">${esc(title)}</h1>
      ${body}
    </div>
  </main>
</body>
</html>`;
}

const back = '<a class="tn-btn tn-btn--secondary" href="/">Back to the site</a>';
const invalid = () => page('This link is not valid', `<p class="lede">The unsubscribe link is incomplete or out of date. Use the link in your most recent Volcano Racers email.</p>${back}`);

function tokenFrom(req) {
  const q = req.query && req.query.token;
  const b = req.body && typeof req.body === 'object' ? req.body.token : undefined;
  const t = String(q || b || '').trim();
  return UUID_RE.test(t) ? t.toLowerCase() : null;
}

function html(res, status, markup) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(status).send(markup);
}

export default async function handler(req, res, deps = {}) {
  res.setHeader('Cache-Control', 'no-store');
  const token = tokenFrom(req);

  if (req.method === 'GET') {
    if (!token) return html(res, 400, invalid());
    return html(res, 200, page('Unsubscribe from Volcano Racers emails?',
      `<p class="lede">You will stop getting Volcano Racers news from Tune Comics &amp; Studio.</p>
      <form method="post" action="/api/unsubscribe">
        <input type="hidden" name="token" value="${esc(token)}">
        <button class="tn-btn tn-btn--primary" type="submit">Unsubscribe</button>
      </form>`));
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return html(res, 405, page('Method not allowed', back));
  }

  const oneClick = req.body && req.body['List-Unsubscribe'] === 'One-Click';
  if (!token) return oneClick ? res.status(400).send('Invalid token') : html(res, 400, invalid());

  try {
    const sql = deps.sql || neon(process.env.DATABASE_URL);
    const rows = await sql`SELECT vr_unsubscribe(${token}::uuid) AS ok`;
    const found = Boolean(rows && rows[0] && rows[0].ok);
    if (oneClick) return res.status(found ? 200 : 404).send(found ? 'Unsubscribed' : 'Unknown token');
    if (!found) return html(res, 404, invalid());
    return html(res, 200, page("You're unsubscribed",
      `<p class="lede">You won't get any more Volcano Racers emails.</p>${back}`));
  } catch (err) {
    console.error('unsubscribe_failed', err && err.message);
    if (oneClick) return res.status(500).send('Try again later');
    return html(res, 500, page('Something went wrong',
      `<p class="lede">We could not unsubscribe you just now. Please try the link again in a few minutes.</p>${back}`));
  }
}
