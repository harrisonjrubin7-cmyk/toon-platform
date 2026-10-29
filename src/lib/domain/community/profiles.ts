import { z } from "zod";
import type { Queryable } from "../../db";
import { AppError } from "../../errors";
import type { Actor } from "../../roles";
import { isOwnCommunityImage } from "../../community-media";
import { parseOrThrow } from "../accounts";
import { audit } from "../audit";
import { canModerate, notify, requireSignedIn, TERMS_VERSION } from "./shared";

const RESERVED = new Set(["admin", "studio", "tune", "tunecomics", "moderator", "mod", "support", "staff", "official", "volcanoracers", "starfall", "community", "create", "new"]);

const profileSchema = z.object({
  handle: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,30}$/, "Use 3 to 30 lowercase letters, numbers or underscores.")
    .refine((h) => !RESERVED.has(h.replace(/_/g, "")), "That handle is reserved."),
  bio: z.string().trim().max(500, "Keep it under 500 characters.").default(""),
  avatarUrl: z.string().trim().transform((s) => (s === "" ? null : s)).nullable().optional(),
  acceptTerms: z.literal(true, { message: "Accept the community guidelines and creator terms to continue." }),
});

export type MyProfile = { handle: string; bio: string; avatarUrl: string | null; termsCurrent: boolean; suspendedUntil: Date | null; suspendedReason: string | null } | null;

export async function getMyProfile(q: Queryable, actor: Actor | null): Promise<MyProfile> {
  if (!actor) return null;
  const { rows } = await q.query("select * from profiles where user_id = $1", [actor.id]);
  const p = rows[0];
  if (!p) return null;
  const suspended = p.suspended_until && new Date(p.suspended_until) > new Date();
  return { handle: p.handle, bio: p.bio, avatarUrl: p.avatar_url, termsCurrent: p.terms_version === TERMS_VERSION, suspendedUntil: suspended ? p.suspended_until : null, suspendedReason: suspended ? p.suspended_reason : null };
}

/** Creates or updates the signed-in person's creator profile. Accepting the current terms is required. */
export async function saveProfile(q: Queryable, actorIn: Actor | null, input: unknown) {
  const actor = requireSignedIn(actorIn, "set up a profile");
  if (!actor.ageConfirmed) throw new AppError("forbidden", "The community is for members 18 and older.");
  const d = parseOrThrow(profileSchema, input);
  if (d.avatarUrl && !isOwnCommunityImage(d.avatarUrl, actor.id)) throw new AppError("invalid", "Upload your picture here.", { avatarUrl: "Upload your picture here." });
  try {
    const { rows } = await q.query(
      `insert into profiles (user_id, handle, bio, avatar_url, terms_accepted_at, terms_version) values ($1,$2,$3,$4,now(),$5)
       on conflict (user_id) do update set handle = excluded.handle, bio = excluded.bio, avatar_url = excluded.avatar_url,
         terms_accepted_at = now(), terms_version = excluded.terms_version, updated_at = now()
       returning (xmax = 0) as created`,
      [actor.id, d.handle, d.bio, d.avatarUrl ?? null, TERMS_VERSION],
    );
    await audit(q, actor.id, rows[0].created ? "profile.created" : "profile.updated", "profile", actor.id, { handle: d.handle, termsVersion: TERMS_VERSION });
    return d.handle;
  } catch (e) {
    if ((e as { code?: string }).code === "23505") throw new AppError("conflict", "That handle is taken.", { handle: "Already taken. Try another." });
    throw e;
  }
}

export type PublicProfile = {
  userId: string; handle: string; displayName: string; bio: string; avatarUrl: string | null; joinedAt: Date;
  followers: number; following: number; isFollowing: boolean; isSelf: boolean; suspended: boolean;
};

export async function getProfileByHandle(q: Queryable, handle: string, actor: Actor | null): Promise<PublicProfile> {
  const { rows } = await q.query(
    `select p.*, u.display_name, u.disabled_at,
       (select count(*) from user_follows f where f.followee_id = p.user_id) as followers,
       (select count(*) from user_follows f where f.follower_id = p.user_id) as following,
       exists(select 1 from user_follows f where f.follower_id = $2 and f.followee_id = p.user_id) as is_following
     from profiles p join users u on u.id = p.user_id where lower(p.handle) = lower($1)`,
    [handle, actor?.id ?? null],
  );
  const p = rows[0];
  if (!p || (p.disabled_at && !canModerate(actor))) throw new AppError("not_found", "Profile not found.");
  return {
    userId: p.user_id, handle: p.handle, displayName: p.display_name, bio: p.bio, avatarUrl: p.avatar_url, joinedAt: p.created_at,
    followers: Number(p.followers), following: Number(p.following), isFollowing: p.is_following, isSelf: actor?.id === p.user_id,
    suspended: !!p.suspended_until && new Date(p.suspended_until) > new Date(),
  };
}

export async function setUserFollow(q: Queryable, actorIn: Actor | null, followeeId: string, follow: boolean) {
  const actor = requireSignedIn(actorIn, "follow creators");
  if (actor.id === followeeId) throw new AppError("invalid", "You can't follow yourself.");
  const { rowCount } = await q.query("select 1 from profiles where user_id = $1", [followeeId]);
  if (!rowCount) throw new AppError("not_found", "Profile not found.");
  if (follow) {
    const r = await q.query("insert into user_follows (follower_id, followee_id) values ($1,$2) on conflict do nothing", [actor.id, followeeId]);
    if (r.rowCount) await notify(q, followeeId, "follow", actor.id, "profile", followeeId);
  } else {
    await q.query("delete from user_follows where follower_id = $1 and followee_id = $2", [actor.id, followeeId]);
  }
}
