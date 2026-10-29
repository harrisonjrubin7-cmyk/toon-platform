// Email delivery through Resend (same provider and env vars as the platform app).
// Sends only when RESEND_API_KEY and EMAIL_FROM are set; otherwise returns null
// and the caller skips the email. Sign-ups are saved either way.

export function resendTransport(apiKey, from, fetchImpl = fetch) {
  return {
    name: 'resend',
    async send({ to, subject, text, headers }) {
      const res = await fetchImpl('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [to], subject, text, headers })
      });
      if (!res.ok) {
        const detail = (await res.text().catch(() => '')).slice(0, 300);
        throw new Error(`Resend ${res.status}: ${detail}`);
      }
      const body = await res.json().catch(() => ({}));
      return { id: body.id || 'resend' };
    }
  };
}

export function configuredTransport(env = process.env) {
  if (env.RESEND_API_KEY && env.EMAIL_FROM) return resendTransport(env.RESEND_API_KEY, env.EMAIL_FROM);
  return null;
}

// Base URL for links in emails. Env first; the request host is only a fallback.
export function siteUrl(req, env = process.env) {
  const fromEnv = env.SITE_URL || env.DEPLOY_PRIME_URL || env.URL || (env.VERCEL_URL ? `https://${env.VERCEL_URL}` : '');
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  const host = (req && req.headers && (req.headers['x-forwarded-host'] || req.headers.host)) || 'localhost:8888';
  const proto = String(host).startsWith('localhost') ? 'http' : 'https';
  return `${proto}://${host}`;
}

export function welcomeEmail(to, unsubscribeUrl) {
  return {
    to,
    subject: "You're on the Volcano Racers list",
    text: [
      'Thanks for signing up for Volcano Racers news from Tune Comics & Studio.',
      '',
      "We'll email you when Volcano Racers Issue #1 is ready. Volcano Racers is for readers 18 and over.",
      '',
      "If you didn't sign up, or no longer want these emails, unsubscribe here:",
      unsubscribeUrl
    ].join('\n'),
    headers: {
      'List-Unsubscribe': `<${unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
    }
  };
}
