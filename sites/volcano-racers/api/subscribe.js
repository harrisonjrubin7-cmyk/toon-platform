// POST /api/subscribe — stores a newsletter sign-up in Neon Postgres.
// DATABASE_URL must use the insert-only role (vr_signup_writer).
import { neon } from '@neondatabase/serverless';

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

export default async function handler(req, res, deps = {}) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const v = validate(req.body);
  if (v.spam) return reply(req, res, 200, { ok: true });
  if (v.error) return reply(req, res, 400, { ok: false, error: v.error });

  try {
    const sql = deps.sql || neon(process.env.DATABASE_URL);
    const ua = String(req.headers['user-agent'] || '').slice(0, 300);
    // Duplicate emails are ignored, and the reply is the same so the form
    // does not reveal who is already on the list.
    await sql`INSERT INTO newsletter_signups (email, age_confirmed, source, user_agent)
              VALUES (${v.email}, true, 'landing-page', ${ua})
              ON CONFLICT (email_normalized) DO NOTHING`;
    return reply(req, res, 200, { ok: true });
  } catch (err) {
    console.error('subscribe_failed', err && err.message);
    return reply(req, res, 500, { ok: false, error: 'We could not save your sign-up. Please try again.' });
  }
}
