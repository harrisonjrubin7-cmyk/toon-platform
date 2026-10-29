import { z } from "zod";
import type { Queryable } from "../../db";
import { AppError } from "../../errors";
import { hasRole, type Actor } from "../../roles";
import { parseOrThrow } from "../accounts";
import { audit } from "../audit";
import { assertUuid, canConfigure, canModerate, getSettings, notify, rateLimit, requireSignedIn, type ReportTargetType } from "./shared";

export const REPORT_REASONS = {
  minor_safety: "Involves a minor in sexual or abusive content",
  sexual: "Sexually explicit, or sexual content of a real person",
  harassment: "Harassment or bullying",
  hate: "Hate speech",
  violence: "Threats or real-world violence",
  copyright: "Copies someone else's work",
  wrong_rating: "Wrong rating (should be Mature)",
  spam: "Spam or scams",
  other: "Something else",
} as const;
type Reason = keyof typeof REPORT_REASONS;

const reportSchema = z.object({
  targetType: z.enum(["comic", "idea", "comment", "profile"]),
  targetId: z.string().uuid("Not found."),
  reason: z.enum(Object.keys(REPORT_REASONS) as [Reason, ...Reason[]], { message: "Pick a reason." }),
  details: z.string().trim().max(1000, "Keep it under 1,000 characters.").default(""),
});

const TABLE: Record<ReportTargetType, string> = { comic: "fan_comics", idea: "ideas", comment: "comments", profile: "profiles" };

async function targetAuthor(q: Queryable, type: ReportTargetType, id: string): Promise<string | null> {
  const col = type === "profile" ? "user_id" : "author_id";
  const key = type === "profile" ? "user_id" : "id";
  const { rows } = await q.query(`select ${col} a from ${TABLE[type]} where ${key} = $1`, [id]);
  return rows[0]?.a ?? null;
}

/**
 * Anyone signed in can report. A child-safety report hides the item at once; otherwise it
 * is hidden automatically once enough different people report it. Moderators then decide.
 */
export async function report(q: Queryable, actorIn: Actor | null, input: unknown) {
  const actor = requireSignedIn(actorIn, "report");
  const d = parseOrThrow(reportSchema, input);
  const author = await targetAuthor(q, d.targetType, d.targetId);
  if (!author) throw new AppError("not_found", "Not found.");
  if (author === actor.id) throw new AppError("invalid", "You can't report your own post. Delete it instead.");
  await rateLimit(q, "select count(*) n from reports where reporter_id = $1 and created_at > now() - interval '1 day'", [actor.id], 30, "You've sent a lot of reports today. The studio will review them.");
  const r = await q.query(
    `insert into reports (reporter_id, target_type, target_id, reason, details) values ($1,$2,$3,$4,$5)
     on conflict (reporter_id, target_type, target_id) where status = 'open' do nothing`,
    [actor.id, d.targetType, d.targetId, d.reason, d.details],
  );
  if (!r.rowCount) return { duplicate: true, autoHidden: false };
  let autoHidden = false;
  if (d.targetType !== "profile") {
    const settings = await getSettings(q);
    const { rows } = await q.query("select count(distinct reporter_id) n from reports where target_type = $1 and target_id = $2 and status = 'open'", [d.targetType, d.targetId]);
    if (d.reason === "minor_safety" || Number(rows[0].n) >= settings.autoHideReports) {
      const res = await q.query(`update ${TABLE[d.targetType]} set moderation = 'hidden' where id = $1 and moderation in ('visible','pending')`, [d.targetId]);
      autoHidden = !!res.rowCount;
      if (autoHidden) await audit(q, null, "community.auto_hidden", d.targetType, d.targetId, { reason: d.reason });
    }
  }
  await audit(q, actor.id, "community.reported", d.targetType, d.targetId, { reason: d.reason });
  return { duplicate: false, autoHidden };
}

function requireModerator(actor: Actor | null): Actor {
  const a = requireSignedIn(actor, "moderate");
  if (!canModerate(a)) throw new AppError("forbidden", "Only studio editors can moderate.");
  return a;
}

export type QueueItem = {
  targetType: ReportTargetType; targetId: string; title: string; excerpt: string; link: string | null; moderation: string;
  author: { userId: string | null; handle: string | null; displayName: string | null };
  reports: { id: string; reason: Reason; details: string; createdAt: Date; reporter: string | null }[];
};

async function describe(q: Queryable, type: ReportTargetType, id: string) {
  if (type === "comic") {
    const { rows } = await q.query("select c.title, c.summary, c.moderation, c.author_id, p.handle, u.display_name from fan_comics c join users u on u.id=c.author_id left join profiles p on p.user_id=c.author_id where c.id=$1", [id]);
    const r = rows[0];
    return r && { title: r.title, excerpt: r.summary, link: `/c/${id}`, moderation: r.moderation, author: { userId: r.author_id, handle: r.handle, displayName: r.display_name } };
  }
  if (type === "idea") {
    const { rows } = await q.query("select i.title, i.body, i.moderation, i.author_id, p.handle, u.display_name from ideas i join users u on u.id=i.author_id left join profiles p on p.user_id=i.author_id where i.id=$1", [id]);
    const r = rows[0];
    return r && { title: r.title, excerpt: r.body.slice(0, 300), link: `/ideas/${id}`, moderation: r.moderation, author: { userId: r.author_id, handle: r.handle, displayName: r.display_name } };
  }
  if (type === "comment") {
    const { rows } = await q.query("select m.body, m.moderation, m.author_id, m.target_type, m.target_id, p.handle, u.display_name from comments m join users u on u.id=m.author_id left join profiles p on p.user_id=m.author_id where m.id=$1", [id]);
    const r = rows[0];
    return r && { title: "Comment", excerpt: r.body.slice(0, 300), link: r.target_type === "comic" ? `/c/${r.target_id}` : `/ideas/${r.target_id}`, moderation: r.moderation, author: { userId: r.author_id, handle: r.handle, displayName: r.display_name } };
  }
  const { rows } = await q.query("select p.handle, p.bio, p.user_id, u.display_name, p.suspended_until from profiles p join users u on u.id=p.user_id where p.user_id=$1", [id]);
  const r = rows[0];
  return r && { title: `@${r.handle}`, excerpt: r.bio, link: `/u/${r.handle}`, moderation: r.suspended_until && new Date(r.suspended_until) > new Date() ? "suspended" : "visible", author: { userId: r.user_id, handle: r.handle, displayName: r.display_name } };
}

/** Open reports grouped by the item they're about, child-safety reports first. */
export async function reportQueue(q: Queryable, actor: Actor | null): Promise<QueueItem[]> {
  requireModerator(actor);
  const { rows } = await q.query(
    `select r.*, pr.handle reporter from reports r left join profiles pr on pr.user_id = r.reporter_id where r.status = 'open'
     order by (r.reason = 'minor_safety') desc, r.created_at limit 500`,
  );
  const groups = new Map<string, QueueItem>();
  for (const r of rows) {
    const key = `${r.target_type}:${r.target_id}`;
    if (!groups.has(key)) {
      const info = await describe(q, r.target_type, r.target_id);
      groups.set(key, { targetType: r.target_type, targetId: r.target_id, title: info?.title ?? "(deleted)", excerpt: info?.excerpt ?? "", link: info?.link ?? null, moderation: info?.moderation ?? "deleted", author: info?.author ?? { userId: null, handle: null, displayName: null }, reports: [] });
    }
    groups.get(key)!.reports.push({ id: r.id, reason: r.reason, details: r.details, createdAt: r.created_at, reporter: r.reporter });
  }
  return [...groups.values()];
}

export type PendingItem = { targetType: "comic" | "idea"; targetId: string; title: string; link: string; handle: string; createdAt: Date };

/** Posts waiting for approval (only used while approval is switched on). */
export async function pendingQueue(q: Queryable, actor: Actor | null): Promise<PendingItem[]> {
  requireModerator(actor);
  const { rows } = await q.query(
    `select 'comic' t, c.id, c.title, p.handle, c.updated_at at from fan_comics c join profiles p on p.user_id=c.author_id where c.moderation='pending' and c.status='published'
     union all select 'idea', i.id, i.title, p.handle, i.created_at from ideas i join profiles p on p.user_id=i.author_id where i.moderation='pending'
     order by at limit 200`,
  );
  return rows.map((r) => ({ targetType: r.t, targetId: r.id, title: r.title, link: r.t === "comic" ? `/c/${r.id}` : `/ideas/${r.id}`, handle: r.handle, createdAt: r.at }));
}

const decisionSchema = z.object({
  targetType: z.enum(["comic", "idea", "comment", "profile"]),
  targetId: z.string().uuid(),
  decision: z.enum(["dismiss", "hide", "remove", "restore", "approve"]),
  note: z.string().trim().max(500).default(""),
});

/**
 * Applies a moderator's decision to an item and closes its open reports.
 * hide: out of public view, can be restored. remove: taken down for good (the author
 * can't edit or republish it). restore/approve: public again. dismiss: no change.
 */
export async function decide(q: Queryable, actorIn: Actor | null, input: unknown) {
  const actor = requireModerator(actorIn);
  const d = parseOrThrow(decisionSchema, input);
  const author = await targetAuthor(q, d.targetType, d.targetId);
  if (d.targetType === "profile" && d.decision !== "dismiss") throw new AppError("invalid", "Use suspend for a profile.");
  if (d.decision !== "dismiss") {
    if (!author) throw new AppError("not_found", "That item no longer exists.");
    const to = d.decision === "hide" ? "hidden" : d.decision === "remove" ? "removed" : "visible";
    if (d.targetType === "comment") {
      await q.query("update comments set moderation = $2 where id = $1", [d.targetId, to === "removed" ? "removed" : to]);
    } else {
      await q.query(`update ${TABLE[d.targetType]} set moderation = $2, moderation_note = $3 where id = $1`, [d.targetId, to, d.note || null]);
    }
    if (d.decision === "approve") await notify(q, author, "approved", actor.id, d.targetType, d.targetId);
    else if (d.decision !== "restore") await notify(q, author, "moderation", actor.id, d.targetType, d.targetId, d.note || (d.decision === "remove" ? "Removed for breaking the community guidelines." : "Hidden while the studio reviews it."));
  }
  const status = d.decision === "dismiss" || d.decision === "restore" || d.decision === "approve" ? "dismissed" : "actioned";
  const closed = await q.query(
    "update reports set status = $3, resolved_by = $4, resolved_at = now(), resolution_note = $5 where target_type = $1 and target_id = $2 and status = 'open'",
    [d.targetType, d.targetId, status, actor.id, d.note || d.decision],
  );
  await audit(q, actor.id, `community.${d.decision}`, d.targetType, d.targetId, { note: d.note, reportsClosed: closed.rowCount });
}

const suspendSchema = z.object({
  userId: z.string().uuid(),
  days: z.coerce.number().int().min(0).max(3650),
  reason: z.string().trim().max(500).default(""),
});

/** Pauses (days > 0) or restores (days = 0) someone's ability to post. Staff can't be suspended here. */
export async function suspend(q: Queryable, actorIn: Actor | null, input: unknown) {
  const actor = requireModerator(actorIn);
  const d = parseOrThrow(suspendSchema, input);
  const { rows } = await q.query("select u.role from profiles p join users u on u.id = p.user_id where p.user_id = $1", [d.userId]);
  if (!rows[0]) throw new AppError("not_found", "Profile not found.");
  if (hasRole({ role: rows[0].role }, "editor")) throw new AppError("forbidden", "Studio staff can't be suspended here. Change their role first.");
  const until = d.days > 0 ? new Date(Date.now() + d.days * 864e5) : null;
  await q.query("update profiles set suspended_until = $2, suspended_reason = $3 where user_id = $1", [d.userId, until, d.days > 0 ? d.reason || null : null]);
  if (d.days > 0) await notify(q, d.userId, "moderation", actor.id, "profile", d.userId, d.reason || `Posting paused for ${d.days} days.`);
  await q.query(
    "update reports set status = 'actioned', resolved_by = $2, resolved_at = now(), resolution_note = $3 where target_type = 'profile' and target_id = $1 and status = 'open'",
    [d.userId, actor.id, d.days > 0 ? `suspended ${d.days}d` : "unsuspended"],
  );
  await audit(q, actor.id, d.days > 0 ? "community.suspended" : "community.unsuspended", "profile", d.userId, { days: d.days, reason: d.reason });
  return until;
}

export type SuspendedMember = { userId: string; handle: string; until: Date; reason: string | null };

export async function listSuspended(q: Queryable, actor: Actor | null): Promise<SuspendedMember[]> {
  requireModerator(actor);
  const { rows } = await q.query("select user_id, handle, suspended_until, suspended_reason from profiles where suspended_until > now() order by suspended_until");
  return rows.map((r) => ({ userId: r.user_id, handle: r.handle, until: r.suspended_until, reason: r.suspended_reason }));
}

export type HiddenItem = { targetType: "comic" | "idea"; targetId: string; title: string; moderation: string; link: string; handle: string };

export async function listHidden(q: Queryable, actor: Actor | null): Promise<HiddenItem[]> {
  requireModerator(actor);
  const { rows } = await q.query(
    `select 'comic' t, c.id, c.title, c.moderation, p.handle, c.updated_at at from fan_comics c join profiles p on p.user_id=c.author_id where c.moderation in ('hidden','removed')
     union all select 'idea', i.id, i.title, i.moderation, p.handle, i.updated_at from ideas i join profiles p on p.user_id=i.author_id where i.moderation in ('hidden','removed')
     order by at desc limit 200`,
  );
  return rows.map((r) => ({ targetType: r.t, targetId: r.id, title: r.title, moderation: r.moderation, link: r.t === "comic" ? `/c/${r.id}` : `/ideas/${r.id}`, handle: r.handle }));
}

const settingsSchema = z.object({
  preModeration: z.boolean(),
  allowFanWorks: z.boolean(),
  autoHideReports: z.coerce.number().int().min(1, "At least 1.").max(100),
});

export async function updateSettings(q: Queryable, actorIn: Actor | null, expectedVersion: number, input: unknown) {
  const actor = requireSignedIn(actorIn);
  if (!canConfigure(actor)) throw new AppError("forbidden", "Only admins can change community rules.");
  const d = parseOrThrow(settingsSchema, input);
  const r = await q.query(
    "update community_settings set pre_moderation=$2, allow_fan_works=$3, auto_hide_reports=$4, version = version + 1, updated_at = now() where id and version = $1",
    [expectedVersion, d.preModeration, d.allowFanWorks, d.autoHideReports],
  );
  if (!r.rowCount) throw new AppError("conflict", "Someone else changed these settings. Reload and try again.");
  await audit(q, actor.id, "community.settings_changed", "community_settings", null, d);
}

export async function assertTargetExists(q: Queryable, type: ReportTargetType, id: string) {
  assertUuid(id);
  if (!(await targetAuthor(q, type, id))) throw new AppError("not_found", "Not found.");
}
