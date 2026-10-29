/**
 * Account and reader emails: password reset, new-release notices to
 * followers, the reader's release-email setting, and the admin view of the outbox.
 */
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import type { Queryable } from "../db";
import { AppError } from "../errors";
import { hashPassword } from "../auth/password";
import { permissions, type Actor } from "../roles";
import { appUrl } from "../email/transport";
import { enqueueEmail } from "../email/outbox";
import { audit } from "./audit";
import { parseOrThrow } from "./accounts";

export const RESET_TTL_MINUTES = 60;
export const RESET_LIMIT_PER_HOUR = 3;
const STUDIO = "Tune Comics & Studio";

const sha256 = (t: string) => createHash("sha256").update(t).digest("hex");

/**
 * Starts a password reset. Always succeeds from the caller's point of view, so
 * the form never reveals which emails have accounts. Only active accounts get
 * a link, and at most RESET_LIMIT_PER_HOUR per account per hour.
 */
export async function requestPasswordReset(q: Queryable, emailRaw: unknown, baseUrl = appUrl()): Promise<void> {
  const email = z.string().trim().toLowerCase().email().max(254).safeParse(emailRaw);
  if (!email.success) throw new AppError("invalid", "Please fix the highlighted fields.", { email: "Enter a valid email address." });
  const { rows } = await q.query<{ id: string; email: string; display_name: string }>(
    "select id, email, display_name from users where lower(email) = $1 and disabled_at is null",
    [email.data],
  );
  const user = rows[0];
  if (!user) return;
  const recent = await q.query<{ n: string }>(
    "select count(*) as n from password_resets where user_id = $1 and created_at > now() - interval '1 hour'",
    [user.id],
  );
  if (Number(recent.rows[0].n) >= RESET_LIMIT_PER_HOUR) return;

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + RESET_TTL_MINUTES * 60_000);
  await q.query("insert into password_resets (token_hash, user_id, expires_at) values ($1,$2,$3)", [sha256(token), user.id, expiresAt]);
  await enqueueEmail(q, {
    kind: "password_reset",
    dedupeKey: `reset:${sha256(token)}`,
    userId: user.id,
    to: user.email,
    subject: `Reset your ${STUDIO} password`,
    text: [
      `Hi ${user.display_name},`,
      "",
      "Someone asked to reset the password for this account. If it was you, open this link within the next hour:",
      "",
      `${baseUrl}/reset?token=${token}`,
      "",
      "If it wasn't you, ignore this email. Your password stays the same.",
      "",
      `— ${STUDIO}`,
    ].join("\n"),
  });
  await audit(q, user.id, "user.password_reset_requested", "user", user.id);
}

const resetSchema = z
  .object({
    token: z.string().min(10, "This reset link is not valid.").max(200),
    password: z.string().min(10, "Use at least 10 characters.").max(200),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { message: "The passwords don't match.", path: ["confirm"] });

/** True when the token exists, is unused and has not expired. Used to show the form or an "expired" notice. */
export async function resetTokenIsValid(q: Queryable, token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const { rowCount } = await q.query(
    "select 1 from password_resets r join users u on u.id = r.user_id where r.token_hash = $1 and r.used_at is null and r.expires_at > now() and u.disabled_at is null",
    [sha256(token)],
  );
  return rowCount === 1;
}

/**
 * Sets a new password from a reset link. The token is single use: it is
 * marked used in the same statement that checks it. Every existing session
 * for the account is signed out, and any other open reset links stop working.
 */
export async function resetPassword(q: Queryable, input: unknown): Promise<{ userId: string }> {
  const d = parseOrThrow(resetSchema, input);
  const hash = await hashPassword(d.password);
  const { rows } = await q.query<{ user_id: string }>(
    `update password_resets r set used_at = now()
     from users u
     where r.token_hash = $1 and r.used_at is null and r.expires_at > now() and u.id = r.user_id and u.disabled_at is null
     returning r.user_id`,
    [sha256(d.token)],
  );
  const userId = rows[0]?.user_id;
  if (!userId) throw new AppError("invalid", "This reset link has expired or was already used. Ask for a new one.");
  await q.query("update users set password_hash = $2 where id = $1", [userId, hash]);
  await q.query("update password_resets set used_at = now() where user_id = $1 and used_at is null", [userId]);
  await q.query("delete from sessions where user_id = $1", [userId]);
  await audit(q, userId, "user.password_reset", "user", userId);
  return { userId };
}

type ReleaseForEmail = {
  id: string; number: number; title: string; synopsis: string; format: "comic" | "show";
  volume_title: string; series_id: string; series_title: string; series_status: string; status: string; publish_at: Date | null;
};

/**
 * Queues one "new release" email for each follower of the series who wants
 * them. Safe to call more than once: each reader gets at most one email per
 * release. Scheduled releases are sent at their publish time. Nothing is
 * queued while the series itself is still a draft.
 */
export async function queueReleaseEmails(q: Queryable, releaseId: string, baseUrl = appUrl()): Promise<number> {
  const { rows } = await q.query<ReleaseForEmail>(
    `select r.id, r.number, r.title, r.synopsis, r.status, r.publish_at, v.format, v.title as volume_title,
            s.id as series_id, s.title as series_title, s.status as series_status
     from releases r join volumes v on v.id = r.volume_id join series s on s.id = v.series_id where r.id = $1`,
    [releaseId],
  );
  const r = rows[0];
  if (!r || r.status !== "published" || r.series_status !== "published") return 0;
  // A release that was unpublished and published again: clear the emails that
  // were cancelled by the unpublish, so current followers are told this time.
  await q.query(
    "delete from email_outbox where release_id = $1 and status = 'cancelled' and last_error in ('release unpublished','release no longer published')",
    [releaseId],
  );
  const followers = await q.query<{ id: string; email: string; display_name: string; unsubscribe_token: string }>(
    `select u.id, u.email, u.display_name, u.unsubscribe_token from follows f join users u on u.id = f.user_id
     where f.series_id = $1 and u.email_releases and u.disabled_at is null`,
    [r.series_id],
  );
  const what = r.format === "comic" ? `Issue #${r.number}` : `Episode ${r.number}`;
  const link = `${baseUrl}/${r.format === "comic" ? "read" : "watch"}/${r.id}`;
  let queued = 0;
  for (const f of followers.rows) {
    const added = await enqueueEmail(q, {
      kind: "release",
      dedupeKey: `release:${r.id}:${f.id}`,
      userId: f.id,
      releaseId: r.id,
      to: f.email,
      subject: `New from ${r.series_title}: ${what}, ${r.title}`,
      sendAfter: r.publish_at,
      text: [
        `Hi ${f.display_name},`,
        "",
        `${r.series_title} has a new ${r.format === "comic" ? "issue" : "episode"} in ${r.volume_title}:`,
        `${what}: ${r.title}`,
        ...(r.synopsis ? ["", r.synopsis] : []),
        "",
        `${r.format === "comic" ? "Read" : "Watch"} it here: ${link}`,
        "",
        `You're getting this because you follow ${r.series_title}. Stop these emails: ${baseUrl}/unsubscribe?t=${f.unsubscribe_token}`,
        "",
        `— ${STUDIO}`,
      ].join("\n"),
    });
    if (added) queued++;
  }
  return queued;
}

/** Cancels release emails that have not gone out yet (used when a release is unpublished). */
export async function cancelReleaseEmails(q: Queryable, releaseId: string): Promise<number> {
  const { rowCount } = await q.query(
    "update email_outbox set status = 'cancelled', last_error = 'release unpublished' where release_id = $1 and status = 'pending'",
    [releaseId],
  );
  return rowCount ?? 0;
}

export async function getEmailSettings(q: Queryable, actor: Actor | null): Promise<{ releases: boolean }> {
  if (!actor) throw new AppError("unauthenticated", "Sign in first.");
  const { rows } = await q.query<{ email_releases: boolean }>("select email_releases from users where id = $1", [actor.id]);
  return { releases: !!rows[0]?.email_releases };
}

export async function setReleaseEmails(q: Queryable, actor: Actor | null, on: boolean) {
  if (!actor) throw new AppError("unauthenticated", "Sign in first.");
  await q.query("update users set email_releases = $2 where id = $1", [actor.id, on]);
  await audit(q, actor.id, on ? "user.release_emails_on" : "user.release_emails_off", "user", actor.id);
}

/** One-click opt-out from the link in a release email. No sign-in needed. */
export async function unsubscribeByToken(q: Queryable, token: unknown): Promise<boolean> {
  const t = typeof token === "string" ? token : "";
  if (!/^[0-9a-f]{36}$/.test(t)) return false;
  const { rows } = await q.query<{ id: string }>("update users set email_releases = false where unsubscribe_token = $1 returning id", [t]);
  if (!rows[0]) return false;
  await q.query("update email_outbox set status = 'cancelled', last_error = 'unsubscribed' where user_id = $1 and kind = 'release' and status = 'pending'", [rows[0].id]);
  await audit(q, rows[0].id, "user.release_emails_off", "user", rows[0].id, { via: "unsubscribe_link" });
  return true;
}

export type OutboxRow = { id: string; kind: string; to: string; subject: string; status: string; attempts: number; lastError: string | null; sendAfter: Date; sentAt: Date | null };

/** Admin view of the outbox. Bodies are never returned: reset emails carry live links. */
export async function emailOverview(q: Queryable, actor: Actor | null, limit = 50) {
  if (!permissions.manageUsers(actor)) throw new AppError("forbidden", "Only admins can see the email log.");
  const counts = await q.query<{ status: string; n: string }>("select status, count(*) as n from email_outbox group by status");
  const recent = await q.query(
    `select id, kind, to_email, subject, status, attempts, last_error, send_after, sent_at from email_outbox order by created_at desc limit $1`,
    [limit],
  );
  return {
    counts: Object.fromEntries(counts.rows.map((r) => [r.status, Number(r.n)])) as Record<string, number>,
    recent: recent.rows.map((r): OutboxRow => ({
      id: r.id, kind: r.kind, to: r.to_email, subject: r.subject, status: r.status, attempts: r.attempts,
      lastError: r.last_error, sendAfter: r.send_after, sentAt: r.sent_at,
    })),
  };
}
