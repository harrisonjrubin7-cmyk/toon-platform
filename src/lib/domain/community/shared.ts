import { z } from "zod";
import type { Queryable } from "../../db";
import { AppError } from "../../errors";
import { hasRole, type Actor } from "../../roles";

/** Bump when the guidelines or creator terms change; members re-accept on their next post. */
export const TERMS_VERSION = "2026-10-29";

export type TargetType = "comic" | "idea";
export type ReportTargetType = TargetType | "comment" | "profile";
export type Moderation = "visible" | "pending" | "hidden" | "removed";
export type FanRating = "Teen" | "Mature";
export const FAN_RATINGS: FanRating[] = ["Mature", "Teen"];

/** Editors and admins moderate the community. */
export const canModerate = (a: Actor | null | undefined) => hasRole(a, "editor");
/** Only admins change the community rules. */
export const canConfigure = (a: Actor | null | undefined) => hasRole(a, "admin");

/**
 * Highest fan rating this viewer may see. Every account and visitor is 18+ today
 * (signup and the age gate require it), so everyone may see Mature. When teen
 * accounts exist, they get "Teen" here and every list and page filters on it.
 */
export function maxRatingFor(actor: Actor | null): FanRating {
  return actor && !actor.ageConfirmed ? "Teen" : "Mature";
}
export const ratingsVisibleTo = (actor: Actor | null): FanRating[] => (maxRatingFor(actor) === "Mature" ? ["Teen", "Mature"] : ["Teen"]);

export type CommunitySettings = { preModeration: boolean; allowFanWorks: boolean; autoHideReports: number; version: number };

export async function getSettings(q: Queryable): Promise<CommunitySettings> {
  const { rows } = await q.query("select * from community_settings where id");
  const s = rows[0] ?? { pre_moderation: false, allow_fan_works: true, auto_hide_reports: 3, version: 1 };
  return { preModeration: s.pre_moderation, allowFanWorks: s.allow_fan_works, autoHideReports: s.auto_hide_reports, version: s.version };
}

export function requireSignedIn(actor: Actor | null, what = "do that"): Actor {
  if (!actor) throw new AppError("unauthenticated", `Sign in to ${what}.`);
  return actor;
}

export type Member = Actor & { handle: string };

/**
 * A signed-in member with a creator profile who is not suspended and has accepted the
 * current terms. Everything that posts content goes through this.
 */
export async function requireMember(q: Queryable, actorIn: Actor | null, what = "post"): Promise<Member> {
  const actor = requireSignedIn(actorIn, what);
  const { rows } = await q.query("select handle, suspended_until, terms_version from profiles where user_id = $1", [actor.id]);
  const p = rows[0];
  if (!p) throw new AppError("forbidden", "Set up your creator profile first.", { profile: "missing" });
  if (p.suspended_until && new Date(p.suspended_until) > new Date()) {
    throw new AppError("forbidden", `Your community access is paused until ${new Date(p.suspended_until).toUTCString()}.`);
  }
  if (p.terms_version !== TERMS_VERSION) throw new AppError("forbidden", "Please review and accept the updated community guidelines.", { profile: "terms" });
  return { ...actor, handle: p.handle };
}

/** Simple per-person rate limit over a window, counted from a table's created_at. */
export async function rateLimit(q: Queryable, sql: string, params: unknown[], max: number, message: string) {
  const { rows } = await q.query(sql, params);
  if (Number(rows[0]?.n ?? 0) >= max) throw new AppError("invalid", message);
}

export const uuid = z.string().uuid("Not found.");

export function assertUuid(id: string, what = "Item") {
  if (!uuid.safeParse(id).success) throw new AppError("not_found", `${what} not found.`);
}

export async function notify(q: Queryable, userId: string, kind: "like" | "comment" | "follow" | "moderation" | "approved", actorId: string | null, targetType: string | null, targetId: string | null, detail = "") {
  if (actorId && actorId === userId) return;
  await q.query(
    "insert into community_notifications (user_id, kind, actor_id, target_type, target_id, detail) values ($1,$2,$3,$4,$5,$6)",
    [userId, kind, actorId, targetType, targetId, detail],
  );
}

/** SQL for "this author can be shown publicly": account active. */
export const AUTHOR_ACTIVE = "u.disabled_at is null";

/** A published official series the fan work is a spinoff of, or null. */
export async function resolveSpinoff(q: Queryable, seriesId: string | null | undefined, settings: CommunitySettings): Promise<string | null> {
  if (!seriesId) return null;
  if (!settings.allowFanWorks) throw new AppError("invalid", "The studio isn't accepting spinoffs of its series right now.", { spinoffOf: "Not accepted right now." });
  assertUuid(seriesId, "Series");
  const { rows } = await q.query("select id from series where id = $1 and status = 'published'", [seriesId]);
  if (!rows[0]) throw new AppError("invalid", "Pick one of the studio's published series.", { spinoffOf: "Pick a published series." });
  return rows[0].id;
}
