import { z } from "zod";
import type { Queryable } from "../../db";
import { AppError } from "../../errors";
import type { Actor } from "../../roles";
import { isOwnCommunityImage } from "../../community-media";
import { LAYOUT_KEYS, LAYOUTS, LETTER_KINDS, LIMITS, type FanPage, type LetterKind } from "../../comic-layouts";
import { parseOrThrow } from "../accounts";
import { audit } from "../audit";
import {
  AUTHOR_ACTIVE, assertUuid, canModerate, getSettings, rateLimit, ratingsVisibleTo, requireMember, resolveSpinoff,
  type FanRating, type Moderation,
} from "./shared";

const letterSchema = z.object({
  kind: z.enum(Object.keys(LETTER_KINDS) as [LetterKind, ...LetterKind[]]),
  speaker: z.string().trim().max(LIMITS.speaker).default(""),
  text: z.string().trim().min(1, "Lettering can't be empty.").max(LIMITS.text, `Keep each line under ${LIMITS.text} characters.`),
});
const panelSchema = z.object({
  imageUrl: z.string().trim().nullable().default(null),
  alt: z.string().trim().max(LIMITS.alt).default(""),
  lettering: z.array(letterSchema).max(LIMITS.letters, `Up to ${LIMITS.letters} lines per panel.`).default([]),
});
const pageSchema = z.object({
  layout: z.enum(LAYOUT_KEYS as [string, ...string[]]),
  panels: z.array(panelSchema),
}).refine((p) => p.panels.length === LAYOUTS[p.layout as keyof typeof LAYOUTS].panels, "Panel count doesn't match the layout.");

const comicSchema = z.object({
  title: z.string().trim().min(1, "Give your comic a title.").max(120),
  summary: z.string().trim().max(2000).default(""),
  rating: z.enum(["Teen", "Mature"], { message: "Pick a rating." }),
  contentNotes: z.string().trim().max(300).default(""),
  spinoffOf: z.string().trim().transform((s) => (s === "" ? null : s)).nullable().optional(),
  coverUrl: z.string().trim().transform((s) => (s === "" ? null : s)).nullable().optional(),
  pages: z.array(pageSchema).max(LIMITS.pages, `Up to ${LIMITS.pages} pages.`).default([]),
});

export type ComicInput = z.input<typeof comicSchema>;

function checkImages(userId: string, d: z.output<typeof comicSchema>) {
  const bad = (u: string | null | undefined) => !!u && !isOwnCommunityImage(u, userId);
  if (bad(d.coverUrl)) throw new AppError("invalid", "Upload the cover here.", { coverUrl: "Upload the cover here." });
  for (const p of d.pages) for (const panel of p.panels) {
    if (bad(panel.imageUrl)) throw new AppError("invalid", "Every panel image has to be uploaded here, by you.");
  }
}

/** What's still missing before a comic can be published. Empty when ready. */
export function publishProblems(pages: FanPage[], title: string): string[] {
  const out: string[] = [];
  if (!title.trim()) out.push("Add a title.");
  if (pages.length === 0) out.push("Add at least one page.");
  pages.forEach((p, i) => p.panels.forEach((panel, j) => {
    if (!panel.imageUrl) out.push(`Page ${i + 1}, panel ${j + 1} needs art.`);
  }));
  return out;
}

const cols = `c.id, c.author_id, c.title, c.summary, c.rating, c.content_notes, c.spinoff_of, c.cover_url, c.pages, c.status, c.moderation,
  c.moderation_note, c.published_at, c.version, c.created_at, c.updated_at`;

export async function createComic(q: Queryable, actorIn: Actor | null, input: unknown) {
  const me = await requireMember(q, actorIn, "make comics");
  await rateLimit(q, "select count(*) n from fan_comics where author_id = $1 and created_at > now() - interval '1 day'", [me.id], 20, "You've started 20 comics today. Try again tomorrow.");
  const d = parseOrThrow(comicSchema.pick({ title: true, rating: true, spinoffOf: true }), input);
  const spinoff = await resolveSpinoff(q, d.spinoffOf, await getSettings(q));
  const { rows } = await q.query(
    `insert into fan_comics (author_id, title, rating, spinoff_of, pages) values ($1,$2,$3,$4,$5) returning id`,
    [me.id, d.title, d.rating, spinoff, JSON.stringify([{ layout: "full", panels: [{ imageUrl: null, alt: "", lettering: [] }] }])],
  );
  await audit(q, me.id, "fan_comic.created", "fan_comic", rows[0].id, { title: d.title, spinoffOf: spinoff });
  return rows[0].id as string;
}

export type EditableComic = {
  id: string; title: string; summary: string; rating: FanRating; contentNotes: string; spinoffOf: string | null; coverUrl: string | null;
  pages: FanPage[]; status: "draft" | "published"; moderation: Moderation; moderationNote: string | null; version: number; updatedAt: Date;
};

async function ownComic(q: Queryable, actor: Actor, id: string, lock = false) {
  assertUuid(id, "Comic");
  const { rows } = await q.query(`select ${cols} from fan_comics c where c.id = $1 ${lock ? "for update" : ""}`, [id]);
  const c = rows[0];
  if (!c || c.author_id !== actor.id) throw new AppError("not_found", "Comic not found.");
  return c;
}

const toEditable = (c: Record<string, unknown>): EditableComic => ({
  id: c.id as string, title: c.title as string, summary: c.summary as string, rating: c.rating as FanRating, contentNotes: c.content_notes as string,
  spinoffOf: c.spinoff_of as string | null, coverUrl: c.cover_url as string | null, pages: c.pages as FanPage[], status: c.status as "draft" | "published",
  moderation: c.moderation as Moderation, moderationNote: c.moderation_note as string | null, version: c.version as number, updatedAt: c.updated_at as Date,
});

export async function getComicForEdit(q: Queryable, actorIn: Actor | null, id: string): Promise<EditableComic> {
  // Suspended members can still open their own drafts; saving is what's blocked.
  if (!actorIn) throw new AppError("unauthenticated", "Sign in to edit comics.");
  return toEditable(await ownComic(q, actorIn, id));
}

/** Saves everything in the editor. Fails with a conflict if it changed since the editor loaded it. */
export async function saveComic(q: Queryable, actorIn: Actor | null, id: string, expectedVersion: number, input: unknown) {
  const me = await requireMember(q, actorIn, "edit comics");
  const c = await ownComic(q, me, id, true);
  if (c.moderation === "removed") throw new AppError("forbidden", "This comic was taken down by the studio and can't be edited.");
  if (c.version !== expectedVersion) throw new AppError("conflict", "This comic was saved somewhere else since you opened it. Reload to get the latest, then redo your change.");
  const parsed = comicSchema.safeParse(input);
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    const where = i.path[0] === "pages" && typeof i.path[1] === "number" ? `Page ${i.path[1] + 1}${typeof i.path[3] === "number" ? `, panel ${i.path[3] + 1}` : ""}: ` : "";
    throw new AppError("invalid", `${where}${i.message}`, i.path.length === 1 ? { [String(i.path[0])]: i.message } : undefined);
  }
  const d = parsed.data;
  checkImages(me.id, d);
  const settings = await getSettings(q);
  const spinoff = d.spinoffOf === c.spinoff_of ? c.spinoff_of : await resolveSpinoff(q, d.spinoffOf, settings);
  if (c.status === "published") {
    const problems = publishProblems(d.pages as FanPage[], d.title);
    if (problems.length) throw new AppError("invalid", `This comic is live, so it has to stay complete. ${problems[0]}`);
  }
  // With approval on, edits to a live comic go back for review.
  const moderation = c.status === "published" && c.moderation === "visible" && settings.preModeration && !canModerate(me) ? "pending" : c.moderation;
  const { rows } = await q.query(
    `update fan_comics set title=$2, summary=$3, rating=$4, content_notes=$5, spinoff_of=$6, cover_url=$7, pages=$8, moderation=$9,
       version = version + 1, updated_at = now() where id = $1 returning version`,
    [id, d.title, d.summary, d.rating, d.contentNotes, spinoff, d.coverUrl ?? null, JSON.stringify(d.pages), moderation],
  );
  await audit(q, me.id, "fan_comic.saved", "fan_comic", id, { pages: d.pages.length });
  return { version: rows[0].version as number, moderation: moderation as Moderation };
}

export async function publishComic(q: Queryable, actorIn: Actor | null, id: string) {
  const me = await requireMember(q, actorIn, "publish comics");
  const c = await ownComic(q, me, id, true);
  if (c.moderation === "removed") throw new AppError("forbidden", "This comic was taken down by the studio.");
  const problems = publishProblems(c.pages, c.title);
  if (problems.length) throw new AppError("invalid", `Not ready yet: ${problems.slice(0, 3).join(" ")}${problems.length > 3 ? ` (and ${problems.length - 3} more)` : ""}`);
  const settings = await getSettings(q);
  if (c.spinoff_of && !settings.allowFanWorks) throw new AppError("invalid", "The studio isn't accepting spinoffs of its series right now.");
  const moderation: Moderation = c.moderation === "hidden" ? "hidden" : settings.preModeration && !canModerate(me) ? "pending" : "visible";
  await q.query(
    `update fan_comics set status='published', moderation=$2, published_at = coalesce(published_at, now()), version = version + 1, updated_at = now() where id = $1`,
    [id, moderation],
  );
  await audit(q, me.id, "fan_comic.published", "fan_comic", id, { moderation });
  return moderation;
}

export async function unpublishComic(q: Queryable, actorIn: Actor | null, id: string) {
  const me = await requireMember(q, actorIn, "manage comics");
  await ownComic(q, me, id, true);
  await q.query("update fan_comics set status='draft', version = version + 1, updated_at = now() where id = $1", [id]);
  await audit(q, me.id, "fan_comic.unpublished", "fan_comic", id);
}

export async function deleteComic(q: Queryable, actorIn: Actor | null, id: string, confirmTitle: string) {
  const actor = actorIn;
  if (!actor) throw new AppError("unauthenticated", "Sign in first.");
  const c = await ownComic(q, actor, id, true);
  if (confirmTitle.trim() !== c.title) throw new AppError("invalid", "Type the title exactly to confirm.", { confirmTitle: "Doesn't match." });
  await q.query("delete from likes where target_type = 'comic' and target_id = $1", [id]);
  await q.query("delete from comments where target_type = 'comic' and target_id = $1", [id]);
  await q.query("delete from fan_comics where id = $1", [id]);
  await audit(q, actor.id, "fan_comic.deleted", "fan_comic", id, { title: c.title });
}

export type MyComic = { id: string; title: string; status: "draft" | "published"; moderation: Moderation; pageCount: number; updatedAt: Date; likes: number; comments: number };

export async function myComics(q: Queryable, actor: Actor): Promise<MyComic[]> {
  const { rows } = await q.query(
    `select c.id, c.title, c.status, c.moderation, jsonb_array_length(c.pages) n, c.updated_at,
       (select count(*) from likes l where l.target_type='comic' and l.target_id=c.id) likes,
       (select count(*) from comments m where m.target_type='comic' and m.target_id=c.id and m.moderation='visible' and m.deleted_at is null) comments
     from fan_comics c where author_id = $1 order by updated_at desc`,
    [actor.id],
  );
  return rows.map((r) => ({ id: r.id, title: r.title, status: r.status, moderation: r.moderation, pageCount: Number(r.n), updatedAt: r.updated_at, likes: Number(r.likes), comments: Number(r.comments) }));
}

// ---------- Reading ----------

export type ComicCard = {
  id: string; title: string; summary: string; rating: FanRating; coverUrl: string | null; firstPanelUrl: string | null; pageCount: number;
  publishedAt: Date; author: { handle: string; displayName: string }; spinoff: { slug: string; title: string } | null; likes: number; comments: number;
};

const PUBLIC_COMIC = `c.status = 'published' and c.moderation = 'visible' and ${AUTHOR_ACTIVE}`;

function comicCard(r: Record<string, unknown>): ComicCard {
  const pages = (r.pages as FanPage[]) ?? [];
  return {
    id: r.id as string, title: r.title as string, summary: r.summary as string, rating: r.rating as FanRating, coverUrl: r.cover_url as string | null,
    firstPanelUrl: pages[0]?.panels.find((p) => p.imageUrl)?.imageUrl ?? null, pageCount: pages.length, publishedAt: r.published_at as Date,
    author: { handle: r.handle as string, displayName: r.display_name as string },
    spinoff: r.s_slug ? { slug: r.s_slug as string, title: r.s_title as string } : null,
    likes: Number(r.likes), comments: Number(r.comments),
  };
}

const CARD_SELECT = `select c.id, c.title, c.summary, c.rating, c.cover_url, c.pages, c.published_at, p.handle, u.display_name, s.slug s_slug, s.title s_title,
    (select count(*) from likes l where l.target_type='comic' and l.target_id=c.id) likes,
    (select count(*) from comments m where m.target_type='comic' and m.target_id=c.id and m.moderation='visible' and m.deleted_at is null) comments
  from fan_comics c join users u on u.id = c.author_id join profiles p on p.user_id = c.author_id left join series s on s.id = c.spinoff_of and s.status = 'published'`;

export async function listComics(q: Queryable, actor: Actor | null, opts: { seriesSlug?: string; authorId?: string; following?: boolean; term?: string; before?: Date | null; limit?: number } = {}): Promise<ComicCard[]> {
  const params: unknown[] = [ratingsVisibleTo(actor)];
  const where = [PUBLIC_COMIC, "c.rating = any($1)"];
  if (opts.seriesSlug) { params.push(opts.seriesSlug); where.push(`s.slug = $${params.length}`); }
  if (opts.authorId) { params.push(opts.authorId); where.push(`c.author_id = $${params.length}`); }
  if (opts.following && actor) { params.push(actor.id); where.push(`c.author_id in (select followee_id from user_follows where follower_id = $${params.length})`); }
  if (opts.term?.trim()) { params.push(opts.term.trim()); where.push(`(c.title ilike '%' || $${params.length} || '%' or c.summary ilike '%' || $${params.length} || '%' or p.handle ilike '%' || $${params.length} || '%')`); }
  if (opts.before) { params.push(opts.before); where.push(`c.published_at < $${params.length}`); }
  params.push(Math.min(opts.limit ?? 24, 60));
  const { rows } = await q.query(`${CARD_SELECT} where ${where.join(" and ")} order by c.published_at desc limit $${params.length}`, params);
  return rows.map(comicCard);
}

export type ComicView = ComicCard & {
  authorId: string; contentNotes: string; pages: FanPage[]; liked: boolean; isAuthor: boolean; status: "draft" | "published"; moderation: Moderation;
  moderationNote: string | null; authorFollowed: boolean;
};

/** A fan comic for reading. Authors and moderators can also open drafts and hidden ones. */
export async function getComic(q: Queryable, id: string, actor: Actor | null): Promise<ComicView> {
  assertUuid(id, "Comic");
  const { rows } = await q.query(
    `${CARD_SELECT.replace("select ", `select c.author_id, c.content_notes, c.status, c.moderation, c.moderation_note, u.disabled_at,
       exists(select 1 from likes l2 where l2.target_type='comic' and l2.target_id=c.id and l2.user_id=$2) liked,
       exists(select 1 from user_follows f where f.follower_id=$2 and f.followee_id=c.author_id) followed, `)} where c.id = $1`,
    [id, actor?.id ?? null],
  );
  const r = rows[0];
  if (!r) throw new AppError("not_found", "Comic not found.");
  const isAuthor = actor?.id === r.author_id;
  const isPublic = r.status === "published" && r.moderation === "visible" && !r.disabled_at && ratingsVisibleTo(actor).includes(r.rating);
  if (!isPublic && !isAuthor && !canModerate(actor)) throw new AppError("not_found", "Comic not found.");
  return {
    ...comicCard(r), authorId: r.author_id, contentNotes: r.content_notes, pages: r.pages, liked: r.liked, isAuthor, status: r.status, moderation: r.moderation,
    moderationNote: r.moderation_note, authorFollowed: r.followed,
  };
}
