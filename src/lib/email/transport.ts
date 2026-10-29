/**
 * Sends one email. Resend is used when RESEND_API_KEY and EMAIL_FROM are set.
 * Outside production, with no key, a dev transport records the send without
 * delivering it, so local runs and tests can read links from the outbox.
 */
export type OutgoingEmail = { to: string; subject: string; text: string };
export type Transport = { name: string; send(msg: OutgoingEmail): Promise<{ id: string }> };

export function resendTransport(apiKey: string, from: string, fetchImpl: typeof fetch = fetch): Transport {
  return {
    name: "resend",
    async send(msg) {
      const res = await fetchImpl("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [msg.to], subject: msg.subject, text: msg.text }),
      });
      if (!res.ok) {
        const detail = (await res.text().catch(() => "")).slice(0, 300);
        throw new Error(`Resend ${res.status}: ${detail}`);
      }
      const body = (await res.json()) as { id?: string };
      return { id: body.id ?? "resend" };
    },
  };
}

export const devTransport: Transport = { name: "dev", send: async () => ({ id: "dev" }) };

/** The transport for this environment, or null when production has no provider configured. */
export function configuredTransport(env: NodeJS.ProcessEnv = process.env): Transport | null {
  if (env.RESEND_API_KEY && env.EMAIL_FROM) return resendTransport(env.RESEND_API_KEY, env.EMAIL_FROM);
  return env.NODE_ENV === "production" && !env.EMAIL_DEV_TRANSPORT ? null : devTransport;
}

/** Absolute base URL for links in emails. */
export function appUrl(env: NodeJS.ProcessEnv = process.env): string {
  const raw = env.APP_URL || (env.VERCEL_URL ? `https://${env.VERCEL_URL}` : "http://localhost:3000");
  return raw.replace(/\/+$/, "");
}
