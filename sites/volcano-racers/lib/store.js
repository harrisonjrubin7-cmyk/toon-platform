// Where sign-ups are kept. Two backends with the same three operations:
// - Neon Postgres, when DATABASE_URL is set (role vr_signup_writer, vr_* functions).
// - Netlify Blobs otherwise. Netlify Functions get Blobs access automatically,
//   so no secret has to be configured.
//
// subscribe(email, ua)   -> unsubscribe token for a new sign-up, null if the email is already on the list
// markWelcomeSent(token) -> records that the welcome email went out
// unsubscribe(token)     -> true if the token was found
import { createHash, randomUUID } from 'node:crypto';
import { neon } from '@neondatabase/serverless';

export function neonStore(sql) {
  return {
    kind: 'neon',
    async subscribe(email, ua) {
      const rows = await sql`SELECT vr_subscribe(${email}, ${ua}) AS token`;
      return (rows && rows[0] && rows[0].token) || null;
    },
    async markWelcomeSent(token) {
      await sql`SELECT vr_mark_welcome_sent(${token}::uuid)`;
    },
    async unsubscribe(token) {
      const rows = await sql`SELECT vr_unsubscribe(${token}::uuid) AS ok`;
      return Boolean(rows && rows[0] && rows[0].ok);
    }
  };
}

const emailKey = (email) =>
  'signups/' + createHash('sha256').update(email.trim().toLowerCase()).digest('hex');

// `blobs` is a Netlify Blobs store (getStore(...)) or a test double with the
// same get/setJSON methods.
export function blobStore(blobs, now = () => new Date().toISOString()) {
  async function recordFor(token) {
    const ref = await blobs.get(`tokens/${token}`, { type: 'json' });
    if (!ref) return null;
    const rec = await blobs.get(ref.key, { type: 'json' });
    return rec ? { key: ref.key, rec } : null;
  }
  return {
    kind: 'blobs',
    async subscribe(email, ua) {
      const token = randomUUID();
      const rec = {
        email: email.trim(),
        user_agent: String(ua || '').slice(0, 500),
        created_at: now(),
        token,
        welcome_sent_at: null,
        unsubscribed_at: null
      };
      const key = emailKey(email);
      // onlyIfNew makes the duplicate check atomic: two sign-ups racing for
      // the same address cannot both win.
      const { modified } = await blobs.setJSON(key, rec, { onlyIfNew: true });
      if (!modified) return null;
      await blobs.setJSON(`tokens/${token}`, { key });
      return token;
    },
    async markWelcomeSent(token) {
      const found = await recordFor(token);
      if (!found || found.rec.welcome_sent_at) return;
      await blobs.setJSON(found.key, { ...found.rec, welcome_sent_at: now() });
    },
    async unsubscribe(token) {
      const found = await recordFor(token);
      if (!found) return false;
      if (!found.rec.unsubscribed_at) {
        await blobs.setJSON(found.key, { ...found.rec, unsubscribed_at: now() });
      }
      return true;
    }
  };
}

export async function defaultStore(env = process.env) {
  if (env.DATABASE_URL) return neonStore(neon(env.DATABASE_URL));
  const { getStore } = await import('@netlify/blobs');
  return blobStore(getStore({ name: 'newsletter-signups', consistency: 'strong' }));
}

// Handlers accept deps.store, or deps.sql (Neon tagged template) for tests.
export async function resolveStore(deps = {}) {
  if (deps.store) return deps.store;
  if (deps.sql) return neonStore(deps.sql);
  return defaultStore();
}
