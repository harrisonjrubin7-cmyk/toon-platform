/**
 * Email outbox. Every email is written here first, inside the same
 * transaction as the change that caused it, then delivered by
 * deliverDueEmails (right after the action, and by the cron route).
 */
import type { Queryable } from "../db";
import type { Transport } from "./transport";

export const MAX_ATTEMPTS = 5;

export type EnqueueInput = {
  kind: "password_reset" | "release";
  dedupeKey: string;
  userId?: string | null;
  releaseId?: string | null;
  to: string;
  subject: string;
  text: string;
  sendAfter?: Date | null;
};

/** Adds an email; returns false when one with the same dedupe key already exists. */
export async function enqueueEmail(q: Queryable, e: EnqueueInput): Promise<boolean> {
  const { rowCount } = await q.query(
    `insert into email_outbox (kind, dedupe_key, user_id, release_id, to_email, subject, body_text, send_after)
     values ($1,$2,$3,$4,$5,$6,$7, coalesce($8, now())) on conflict (dedupe_key) do nothing`,
    [e.kind, e.dedupeKey, e.userId ?? null, e.releaseId ?? null, e.to, e.subject, e.text, e.sendAfter ?? null],
  );
  return rowCount === 1;
}

export type DeliveryReport = { sent: number; failed: number; cancelled: number; skipped?: "no_provider" };

/**
 * Sends due emails. Rows are claimed with SKIP LOCKED so two runs never send
 * the same email. Release emails whose release is no longer visible are
 * cancelled instead of sent. Failures retry with a growing delay.
 */
export async function deliverDueEmails(q: Queryable, transport: Transport | null, limit = 50): Promise<DeliveryReport> {
  const report: DeliveryReport = { sent: 0, failed: 0, cancelled: 0 };
  if (!transport) return { ...report, skipped: "no_provider" };

  const cancelled = await q.query(
    `update email_outbox o set status = 'cancelled', last_error = 'release no longer published'
     where o.status = 'pending' and o.kind = 'release' and o.send_after <= now()
       and not exists (select 1 from releases r join volumes v on v.id = r.volume_id join series s on s.id = v.series_id
                       where r.id = o.release_id and r.status = 'published' and s.status = 'published'
                         and (r.publish_at is null or r.publish_at <= now()))`,
  );
  report.cancelled = cancelled.rowCount ?? 0;

  // Rows stuck in 'sending' for 10+ minutes (a crashed run) go back in the queue.
  await q.query(`update email_outbox set status = 'pending' where status = 'sending' and send_after < now() - interval '10 minutes'`);

  const { rows } = await q.query<{ id: string; to_email: string; subject: string; body_text: string; attempts: number }>(
    `update email_outbox set status = 'sending', attempts = attempts + 1, send_after = now()
     where id in (select id from email_outbox where status = 'pending' and send_after <= now()
                  order by send_after limit $1 for update skip locked)
     returning id, to_email, subject, body_text, attempts`,
    [limit],
  );
  for (const r of rows) {
    try {
      const { id } = await transport.send({ to: r.to_email, subject: r.subject, text: r.body_text });
      await q.query(`update email_outbox set status = 'sent', sent_at = now(), provider_id = $2, last_error = null where id = $1`, [r.id, `${transport.name}:${id}`]);
      report.sent++;
    } catch (err) {
      const msg = String((err as Error)?.message ?? err).slice(0, 500);
      const final = r.attempts >= MAX_ATTEMPTS;
      await q.query(
        `update email_outbox set status = $2, last_error = $3, send_after = now() + make_interval(mins => $4) where id = $1`,
        [r.id, final ? "failed" : "pending", msg, 5 * r.attempts],
      );
      report.failed++;
    }
  }
  return report;
}
