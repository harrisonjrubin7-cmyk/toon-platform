import { z } from "zod";
import type { Queryable } from "../../db";
import { AppError } from "../../errors";
import type { Actor } from "../../roles";
import { parseOrThrow } from "../accounts";
import { audit } from "../audit";
import { assertUuid, canModerate, notify, rateLimit, ratingsVisibleTo, requireMember, requireSignedIn, type TargetType } from "./shared";

/** The author of a comic or idea that this viewer is allowed to see and interact with, or not-found. */
export async function visibleTargetAuthor(q: Queryable, type: TargetType, id: string, actor: Actor | null): Promise<string> {
  assertUuid(id);
  const sql = type === "comic"
    ? "select c.author_id, c.status = 'published' and c.moderation = 'visible' and u.disabled_at is null and c.rating = any($2) as public from fan_comics c join users u on u.id = c.author_id where c.id = $1"
    : "select i.author_id, i.moderation = 'visible' and u.disabled_at is null and i.rating = any($2) as public from ideas i join users u on u.id = i.author_id where i.id = $1";
  const { rows } = await q.query(sql, [id, ratingsVisibleTo(actor)]);
  const r = rows[0];
  if (!r || (!r.public && r.author_id !== actor?.id && !canModerate(actor))) throw new AppError("not_found", "Not found.");
  return r.author_id;
}

export function parseTarget(raw: string): TargetType {
  if (raw === "comic" || raw === "idea") return raw;
  throw new AppError("invalid", "Unknown item.");
}

export async function setLike(q: Queryable, actorIn: Actor | null, type: TargetType, id: string, like: boolean) {
  const actor = requireSignedIn(actorIn, "like posts");
  const authorId = await visibleTargetAuthor(q, type, id, actor);
  if (like) {
    const r = await q.query("insert into likes (user_id, target_type, target_id) values ($1,$2,$3) on conflict do nothing", [actor.id, type, id]);
    if (r.rowCount) await notify(q, authorId, "like", actor.id, type, id);
  } else {
    await q.query("delete from likes where user_id = $1 and target_type = $2 and target_id = $3", [actor.id, type, id]);
  }
  const { rows } = await q.query("select count(*) n from likes where target_type = $1 and target_id = $2", [type, id]);
  return Number(rows[0].n);
}

const commentSchema = z.object({ body: z.string().trim().min(1, "Write something first.").max(2000, "Keep it under 2,000 characters.") });

export async function addComment(q: Queryable, actorIn: Actor | null, type: TargetType, id: string, input: unknown) {
  const me = await requireMember(q, actorIn, "comment");
  const authorId = await visibleTargetAuthor(q, type, id, me);
  await rateLimit(q, "select count(*) n from comments where author_id = $1 and created_at > now() - interval '10 minutes'", [me.id], 20, "You're commenting very fast. Wait a few minutes and try again.");
  const d = parseOrThrow(commentSchema, input);
  const { rows } = await q.query("insert into comments (author_id, target_type, target_id, body) values ($1,$2,$3,$4) returning id", [me.id, type, id, d.body]);
  await notify(q, authorId, "comment", me.id, type, id, d.body.slice(0, 140));
  return rows[0].id as string;
}

export async function deleteComment(q: Queryable, actor: Actor | null, commentId: string) {
  const a = requireSignedIn(actor);
  assertUuid(commentId, "Comment");
  const { rows } = await q.query("select author_id from comments where id = $1", [commentId]);
  if (!rows[0]) throw new AppError("not_found", "Comment not found.");
  if (rows[0].author_id !== a.id && !canModerate(a)) throw new AppError("forbidden", "You can only delete your own comments.");
  await q.query("update comments set deleted_at = now() where id = $1", [commentId]);
  if (rows[0].author_id !== a.id) await audit(q, a.id, "comment.deleted_by_moderator", "comment", commentId);
}

export type CommentItem = { id: string; body: string; createdAt: Date; author: { handle: string; displayName: string }; mine: boolean; hidden: boolean };

export async function listComments(q: Queryable, actor: Actor | null, type: TargetType, id: string): Promise<CommentItem[]> {
  const mod = canModerate(actor);
  const { rows } = await q.query(
    `select m.id, m.body, m.created_at, m.author_id, m.moderation, p.handle, u.display_name from comments m
     join users u on u.id = m.author_id join profiles p on p.user_id = m.author_id
     where m.target_type = $1 and m.target_id = $2 and m.deleted_at is null and (m.moderation = 'visible' or $3 or m.author_id = $4)
       and (u.disabled_at is null or $3)
     order by m.created_at limit 500`,
    [type, id, mod, actor?.id ?? null],
  );
  return rows.map((r) => ({ id: r.id, body: r.body, createdAt: r.created_at, author: { handle: r.handle, displayName: r.display_name }, mine: r.author_id === actor?.id, hidden: r.moderation !== "visible" }));
}

// ---------- Notifications ----------

export type NotificationItem = { id: string; kind: string; actor: { handle: string | null; displayName: string | null }; targetType: string | null; targetId: string | null; detail: string; read: boolean; createdAt: Date };

export async function listNotifications(q: Queryable, actorIn: Actor | null): Promise<NotificationItem[]> {
  const actor = requireSignedIn(actorIn, "see notifications");
  const { rows } = await q.query(
    `select n.*, p.handle, u.display_name from community_notifications n left join users u on u.id = n.actor_id left join profiles p on p.user_id = n.actor_id
     where n.user_id = $1 order by n.created_at desc limit 100`,
    [actor.id],
  );
  return rows.map((r) => ({ id: String(r.id), kind: r.kind, actor: { handle: r.handle, displayName: r.display_name }, targetType: r.target_type, targetId: r.target_id, detail: r.detail, read: !!r.read_at, createdAt: r.created_at }));
}

export async function unreadCount(q: Queryable, actor: Actor | null): Promise<number> {
  if (!actor) return 0;
  const { rows } = await q.query("select count(*) n from community_notifications where user_id = $1 and read_at is null", [actor.id]);
  return Number(rows[0].n);
}

export async function markAllRead(q: Queryable, actorIn: Actor | null) {
  const actor = requireSignedIn(actorIn);
  await q.query("update community_notifications set read_at = now() where user_id = $1 and read_at is null", [actor.id]);
}
