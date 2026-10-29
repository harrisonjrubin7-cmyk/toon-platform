import { z } from "zod";
import type { Queryable } from "../../db";
import { AppError } from "../../errors";
import type { Actor } from "../../roles";
import { parseOrThrow } from "../accounts";
import { audit } from "../audit";
import { AUTHOR_ACTIVE, assertUuid, canModerate, getSettings, rateLimit, ratingsVisibleTo, requireMember, resolveSpinoff, type FanRating, type Moderation } from "./shared";

const ideaSchema = z.object({
  title: z.string().trim().min(1, "Give your idea a title.").max(120),
  body: z.string().trim().min(20, "Tell people a bit more (at least 20 characters).").max(5000, "Keep it under 5,000 characters."),
  spinoffOf: z.string().trim().transform((s) => (s === "" ? null : s)).nullable().optional(),
  rating: z.enum(["Teen", "Mature"], { message: "Pick a rating." }),
});

export async function createIdea(q: Queryable, actorIn: Actor | null, input: unknown) {
  const me = await requireMember(q, actorIn, "post ideas");
  await rateLimit(q, "select count(*) n from ideas where author_id = $1 and created_at > now() - interval '1 day'", [me.id], 10, "You've posted 10 ideas today. Try again tomorrow.");
  const d = parseOrThrow(ideaSchema, input);
  const settings = await getSettings(q);
  const spinoff = await resolveSpinoff(q, d.spinoffOf, settings);
  const moderation: Moderation = settings.preModeration && !canModerate(me) ? "pending" : "visible";
  const { rows } = await q.query(
    "insert into ideas (author_id, title, body, spinoff_of, rating, moderation) values ($1,$2,$3,$4,$5,$6) returning id",
    [me.id, d.title, d.body, spinoff, d.rating, moderation],
  );
  await audit(q, me.id, "idea.created", "idea", rows[0].id, { title: d.title, spinoffOf: spinoff, moderation });
  return { id: rows[0].id as string, moderation };
}

export async function deleteIdea(q: Queryable, actor: Actor | null, id: string) {
  if (!actor) throw new AppError("unauthenticated", "Sign in first.");
  assertUuid(id, "Idea");
  const { rows } = await q.query("select author_id, title from ideas where id = $1", [id]);
  if (!rows[0] || rows[0].author_id !== actor.id) throw new AppError("not_found", "Idea not found.");
  await q.query("delete from likes where target_type = 'idea' and target_id = $1", [id]);
  await q.query("delete from comments where target_type = 'idea' and target_id = $1", [id]);
  await q.query("delete from ideas where id = $1", [id]);
  await audit(q, actor.id, "idea.deleted", "idea", id, { title: rows[0].title });
}

export type IdeaCard = {
  id: string; title: string; body: string; rating: FanRating; createdAt: Date; author: { handle: string; displayName: string };
  spinoff: { slug: string; title: string } | null; likes: number; comments: number;
};

const SELECT = `select i.id, i.title, i.body, i.rating, i.created_at, i.author_id, i.moderation, i.moderation_note, p.handle, u.display_name, u.disabled_at,
    s.slug s_slug, s.title s_title,
    (select count(*) from likes l where l.target_type='idea' and l.target_id=i.id) likes,
    (select count(*) from comments m where m.target_type='idea' and m.target_id=i.id and m.moderation='visible' and m.deleted_at is null) comments
  from ideas i join users u on u.id = i.author_id join profiles p on p.user_id = i.author_id left join series s on s.id = i.spinoff_of and s.status='published'`;

const card = (r: Record<string, unknown>): IdeaCard => ({
  id: r.id as string, title: r.title as string, body: r.body as string, rating: r.rating as FanRating, createdAt: r.created_at as Date,
  author: { handle: r.handle as string, displayName: r.display_name as string },
  spinoff: r.s_slug ? { slug: r.s_slug as string, title: r.s_title as string } : null, likes: Number(r.likes), comments: Number(r.comments),
});

export async function listIdeas(q: Queryable, actor: Actor | null, opts: { seriesSlug?: string; authorId?: string; following?: boolean; term?: string; before?: Date | null; limit?: number } = {}): Promise<IdeaCard[]> {
  const params: unknown[] = [ratingsVisibleTo(actor)];
  const where = [`i.moderation = 'visible'`, AUTHOR_ACTIVE, "i.rating = any($1)"];
  if (opts.seriesSlug) { params.push(opts.seriesSlug); where.push(`s.slug = $${params.length}`); }
  if (opts.authorId) { params.push(opts.authorId); where.push(`i.author_id = $${params.length}`); }
  if (opts.following && actor) { params.push(actor.id); where.push(`i.author_id in (select followee_id from user_follows where follower_id = $${params.length})`); }
  if (opts.term?.trim()) { params.push(opts.term.trim()); where.push(`(i.title ilike '%' || $${params.length} || '%' or i.body ilike '%' || $${params.length} || '%')`); }
  if (opts.before) { params.push(opts.before); where.push(`i.created_at < $${params.length}`); }
  params.push(Math.min(opts.limit ?? 24, 60));
  const { rows } = await q.query(`${SELECT} where ${where.join(" and ")} order by i.created_at desc limit $${params.length}`, params);
  return rows.map(card);
}

export type IdeaView = IdeaCard & { authorId: string; isAuthor: boolean; liked: boolean; moderation: Moderation; moderationNote: string | null };

export async function getIdea(q: Queryable, id: string, actor: Actor | null): Promise<IdeaView> {
  assertUuid(id, "Idea");
  const { rows } = await q.query(`${SELECT.replace("select ", "select exists(select 1 from likes l2 where l2.target_type='idea' and l2.target_id=i.id and l2.user_id=$2) liked, ")} where i.id = $1`, [id, actor?.id ?? null]);
  const r = rows[0];
  if (!r) throw new AppError("not_found", "Idea not found.");
  const isAuthor = actor?.id === r.author_id;
  const isPublic = r.moderation === "visible" && !r.disabled_at && ratingsVisibleTo(actor).includes(r.rating);
  if (!isPublic && !isAuthor && !canModerate(actor)) throw new AppError("not_found", "Idea not found.");
  return { ...card(r), authorId: r.author_id, isAuthor, liked: r.liked, moderation: r.moderation, moderationNote: r.moderation_note };
}
