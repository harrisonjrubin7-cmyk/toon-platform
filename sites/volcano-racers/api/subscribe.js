// POST /api/subscribe — stores a newsletter sign-up in Neon Postgres and sends
// a welcome email with an unsubscribe link when email is configured.
// DATABASE_URL uses role vr_signup_writer, which can only call the vr_* functions.
import { neon } from '@neondatabase/serverless';
import { configuredTransport, siteUrl, welcomeEmail } from '../lib/email.js';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function validate(body) {
  const b = body && typeof body === 'object' ? body : {};
  if (b.company) return { spam: true }; // honeypot filled: pretend success, store nothing
  const email = String(b.email || '').trim();
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return { error: 'Please enter a valid email address.' };
  }
  const age = b.age_confirmed === true || b.age_confirmed === 'yes' || b.age_confirmed === 'on';
  if (!age) return { error: 'Please confirm you are 18 or older.' };
  return { email };
}

function wantsJson(req) {
  return String(req.headers.accept || '').includes('application/json');
}

function reply(req, res, status, payload) {
  if (wantsJson(req)) return res.status(status).json(payload);
  // No-JS form post: send the browser to a page instead of raw JSON
  const to = payload.ok ? '/thanks' : '/?signup=error#signup';
  res.setHeader('Location', to);
  return res.status(303).end();
}

// Sends the welcome email. A failure is logged and never undoes the sign-up.
async function sendWelcome(sql, transport, req, email, token) {
  if (!transport) return;
  try {
    const url = `${siteUrl(req)}/api/unsubscribe?token=${token}`;
    await transport.send(welcomeEmail(email, url));
    await sql`SELECT vr_mark_welcome_sent(${token}::uuid)`;
  } catch (err) {
    console.error('welcome_email_failed', err && err.message);
  }
}

export default async function handler(req, res, deps = {}) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const v = validate(req.body);
  if (v.spam) return reply(req, res, 200, { ok: true });
  if (v.error) return reply(req, res, 400, { ok: false, error: v.error });

  let sql, token;
  try {
    sql = deps.sql || neon(process.env.DATABASE_URL);
    const ua = String(req.headers['user-agent'] || '');
    // Returns null for an email already on the list. The reply is the same
    // either way so the form does not reveal who has signed up, and no
    // second welcome email goes out.
    const rows = await sql`SELECT vr_subscribe(${v.email}, ${ua}) AS token`;
    token = rows && rows[0] && rows[0].token;
  } catch (err) {
    console.error('subscribe_failed', err && err.message);
    return reply(req, res, 500, { ok: false, error: 'We could not save your sign-up. Please try again.' });
  }
  if (token) {
    const transport = 'transport' in deps ? deps.transport : configuredTransport();
    await sendWelcome(sql, transport, req, v.email, token);
  }
  return reply(req, res, 200, { ok: true });
}
