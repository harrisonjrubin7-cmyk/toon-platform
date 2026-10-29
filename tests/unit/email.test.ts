import { afterAll, describe, expect, it } from "vitest";
import { authenticate, createSession, actorForToken } from "@/lib/domain/accounts";
import {
  requestPasswordReset, resetPassword, resetTokenIsValid, setReleaseEmails, unsubscribeByToken, emailOverview, RESET_LIMIT_PER_HOUR,
} from "@/lib/domain/email";
import { addPages, createRelease, createSeries, createVolume, publishRelease, setSeriesStatus, unpublishRelease } from "@/lib/domain/studio";
import { setFollow } from "@/lib/domain/catalog";
import { deliverDueEmails, MAX_ATTEMPTS } from "@/lib/email/outbox";
import { configuredTransport, resendTransport, type Transport } from "@/lib/email/transport";
import { makeUser, pool, q, uniq } from "./helpers";

afterAll(() => pool.end());

const outbox = async (userId: string) =>
  (await q.query("select kind, status, subject, body_text, release_id, attempts, last_error from email_outbox where user_id = $1 order by created_at", [userId])).rows;
const linkToken = (body: string) => /\/reset\?token=([A-Za-z0-9_-]+)/.exec(body)![1];
const sentTo: string[] = [];
const recorder: Transport = { name: "test", send: async (m) => { sentTo.push(m.to); return { id: "t" }; } };

describe("password reset", () => {
  it("gives the same answer for unknown emails and rejects bad input", async () => {
    await expect(requestPasswordReset(q, "nobody-here@example.com", "https://x.test")).resolves.toBeUndefined();
    await expect(requestPasswordReset(q, "not an email", "https://x.test")).rejects.toMatchObject({ code: "invalid", fields: { email: expect.any(String) } });
  });

  it("emails a single-use link that changes the password and signs out every session", async () => {
    const u = await makeUser();
    const old = await createSession(q, u.id);
    await requestPasswordReset(q, u.email.toUpperCase(), "https://x.test");
    const [mail] = await outbox(u.id);
    expect(mail).toMatchObject({ kind: "password_reset", status: "pending" });
    expect(mail.body_text).toContain("https://x.test/reset?token=");
    const token = linkToken(mail.body_text);
    // The raw token is never stored, only its hash.
    expect((await q.query("select 1 from password_resets where token_hash = $1", [token])).rowCount).toBe(0);
    expect(await resetTokenIsValid(q, token)).toBe(true);

    await expect(resetPassword(q, { token, password: "brand new password", confirm: "different pass" })).rejects.toMatchObject({ fields: { confirm: expect.any(String) } });
    await expect(resetPassword(q, { token, password: "short", confirm: "short" })).rejects.toMatchObject({ fields: { password: expect.any(String) } });
    await resetPassword(q, { token, password: "brand new password", confirm: "brand new password" });

    await expect(authenticate(q, u.email, "brand new password")).resolves.toMatchObject({ id: u.id });
    await expect(authenticate(q, u.email, "correct horse battery")).rejects.toMatchObject({ code: "unauthenticated" });
    expect(await actorForToken(q, old.token)).toBeNull();
    expect(await resetTokenIsValid(q, token)).toBe(false);
    await expect(resetPassword(q, { token, password: "another password!", confirm: "another password!" })).rejects.toMatchObject({ code: "invalid" });
  });

  it("expired links fail, disabled accounts get nothing, and requests are rate limited", async () => {
    const u = await makeUser();
    await requestPasswordReset(q, u.email, "https://x.test");
    const token = linkToken((await outbox(u.id))[0].body_text);
    await q.query("update password_resets set expires_at = now() - interval '1 minute' where user_id = $1", [u.id]);
    await expect(resetPassword(q, { token, password: "brand new password", confirm: "brand new password" })).rejects.toMatchObject({ code: "invalid" });

    for (let i = 0; i < RESET_LIMIT_PER_HOUR + 2; i++) await requestPasswordReset(q, u.email, "https://x.test");
    expect((await outbox(u.id)).length).toBe(RESET_LIMIT_PER_HOUR);

    const d = await makeUser();
    await q.query("update users set disabled_at = now() where id = $1", [d.id]);
    await requestPasswordReset(q, d.email, "https://x.test");
    expect(await outbox(d.id)).toHaveLength(0);
  });
});

async function publishedSeriesWithIssue() {
  const editor = await makeUser("editor");
  const slug = uniq("mail");
  const seriesId = (await createSeries(q, editor, { title: "Mail Racers " + slug, slug, rating: "TV-MA" }))!;
  const vol = await createVolume(q, editor, seriesId, { format: "comic", title: "Saga One" });
  const issue = (await createRelease(q, editor, vol, { number: 1, title: "Ignition" }))!;
  await addPages(q, editor, issue, [{ url: `/media/test/${slug}.png` }]);
  return { editor, seriesId, vol, issue };
}

describe("release emails", () => {
  it("emails followers once per release, skips opted-out readers, and honours unsubscribe links", async () => {
    const { editor, seriesId, issue } = await publishedSeriesWithIssue();
    const fan = await makeUser();
    const quiet = await makeUser();
    const stranger = await makeUser();
    await setSeriesStatus(q, editor, seriesId, "published");
    await setFollow(q, fan, seriesId, true);
    await setFollow(q, quiet, seriesId, true);
    await setReleaseEmails(q, quiet, false);

    // Draft series: nothing is sent, readers can't see it yet.
    await setSeriesStatus(q, editor, seriesId, "draft");
    let r = await publishRelease(q, editor, issue);
    expect(r.emailsQueued).toBe(0);
    await unpublishRelease(q, editor, issue);

    await setSeriesStatus(q, editor, seriesId, "published");
    r = await publishRelease(q, editor, issue);
    expect(r.emailsQueued).toBe(1);
    const [mail] = await outbox(fan.id);
    expect(mail.subject).toContain("Issue #1, Ignition");
    expect(mail.body_text).toMatch(/\/read\/[0-9a-f-]{36}/);
    expect(await outbox(quiet.id)).toHaveLength(0);
    expect(await outbox(stranger.id)).toHaveLength(0);

    // Publishing again never sends a second copy.
    await publishRelease(q, editor, issue);
    expect(await outbox(fan.id)).toHaveLength(1);

    // Unpublish before it goes out cancels it; publishing again re-queues it.
    await unpublishRelease(q, editor, issue);
    expect((await outbox(fan.id))[0].status).toBe("cancelled");
    await publishRelease(q, editor, issue);
    expect((await outbox(fan.id)).map((m) => m.status)).toEqual(["pending"]);

    const t = /unsubscribe\?t=([0-9a-f]+)/.exec((await outbox(fan.id))[0].body_text)![1];
    expect(await unsubscribeByToken(q, "nope")).toBe(false);
    expect(await unsubscribeByToken(q, t)).toBe(true);
    expect((await outbox(fan.id))[0]).toMatchObject({ status: "cancelled", last_error: "unsubscribed" });
  });

  it("scheduled releases are emailed at their publish time", async () => {
    const { editor, seriesId, issue } = await publishedSeriesWithIssue();
    await setSeriesStatus(q, editor, seriesId, "published");
    const fan = await makeUser();
    await setFollow(q, fan, seriesId, true);
    const at = new Date(Date.now() + 3600_000);
    await publishRelease(q, editor, issue, at.toISOString());
    const due = await q.query("select send_after from email_outbox where user_id = $1", [fan.id]);
    expect(Math.abs(new Date(due.rows[0].send_after).getTime() - at.getTime())).toBeLessThan(1000);
    sentTo.length = 0;
    await deliverDueEmails(q, recorder, 500);
    expect(sentTo).not.toContain(fan.email);
  });
});

describe("delivery", () => {
  it("sends due mail once, retries failures, and gives up after the last attempt", async () => {
    const u = await makeUser();
    await requestPasswordReset(q, u.email, "https://x.test");
    sentTo.length = 0;
    await deliverDueEmails(q, recorder, 500);
    expect(sentTo.filter((e) => e === u.email)).toHaveLength(1);
    expect((await outbox(u.id))[0].status).toBe("sent");
    await deliverDueEmails(q, recorder, 500);
    expect(sentTo.filter((e) => e === u.email)).toHaveLength(1);

    const v = await makeUser();
    await requestPasswordReset(q, v.email, "https://x.test");
    const failing: Transport = { name: "down", send: async (m) => { if (m.to === v.email) throw new Error("provider down"); return { id: "ok" }; } };
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      await q.query("update email_outbox set send_after = now() where user_id = $1 and status = 'pending'", [v.id]);
      await deliverDueEmails(q, failing, 500);
    }
    expect((await outbox(v.id))[0]).toMatchObject({ status: "failed", attempts: MAX_ATTEMPTS, last_error: "provider down" });
  });

  it("does nothing without a provider in production", async () => {
    expect(configuredTransport({ NODE_ENV: "production" } as NodeJS.ProcessEnv)).toBeNull();
    expect(configuredTransport({ NODE_ENV: "production", RESEND_API_KEY: "k", EMAIL_FROM: "a@b.c" } as NodeJS.ProcessEnv)?.name).toBe("resend");
    expect(await deliverDueEmails(q, null)).toMatchObject({ skipped: "no_provider" });
  });

  it("calls Resend with the key and reports its errors", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const ok = resendTransport("key123", "Tune <a@b.c>", (async (url: string, init: RequestInit) => { calls.push({ url, init }); return new Response(JSON.stringify({ id: "abc" })); }) as typeof fetch);
    await expect(ok.send({ to: "x@y.z", subject: "s", text: "t" })).resolves.toEqual({ id: "abc" });
    expect(calls[0].url).toBe("https://api.resend.com/emails");
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe("Bearer key123");
    const bad = resendTransport("k", "f", (async () => new Response("nope", { status: 422 })) as unknown as typeof fetch);
    await expect(bad.send({ to: "x@y.z", subject: "s", text: "t" })).rejects.toThrow(/Resend 422/);
  });

  it("only admins can see the email log, and it never includes bodies", async () => {
    await expect(emailOverview(q, await makeUser("editor"))).rejects.toMatchObject({ code: "forbidden" });
    const o = await emailOverview(q, await makeUser("admin"), 5);
    expect(o.recent.length).toBeGreaterThan(0);
    expect(Object.keys(o.recent[0])).not.toContain("body_text");
  });
});
