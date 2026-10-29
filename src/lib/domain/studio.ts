import { z } from "zod";
import type { Queryable } from "../db";
import { AppError } from "../errors";
import { isImageRef, isStoredMediaUrl, videoSource } from "../media";
import { permissions, type Actor } from "../roles";
import { parseOrThrow } from "./accounts";
import { audit } from "./audit";

function requireEditor(actor: Actor | null): Actor {
  if (!actor) throw new AppError("unauthenticated", "Sign in to use the studio.");
  if (!permissions.manageContent(actor)) throw new AppError("forbidden", "Only studio editors can do that.");
  return actor;
}

const optionalMedia = z
  .string()
  .trim()
  .transform((s) => (s === "" ? null : s))
  .nullable()
  .optional()
  .refine((s) => s == null || isImageRef(s), "Upload the image here instead of linking to another site.");

const RATINGS = ["TV-MA", "TV-14", "TV-PG", "R", "PG-13", "Teen", "Mature", "Unrated"] as const;

const seriesSchema = z.object({
  title: z.string().trim().min(1, "Enter a title.").max(120),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes.").max(80),
  tagline: z.string().trim().max(160).default(""),
  synopsis: z.string().trim().max(4000).default(""),
  rating: z.enum(RATINGS).default("TV-MA"),
  coverUrl: optionalMedia,
  logoUrl: optionalMedia,
  theme: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes.").max(40).default("studio"),
  position: z.coerce.number().int().min(0).max(9999).default(0),
});

export const THEMES = ["studio", "volcano-racers", "starfall"] as const;

function conflictOnSlug(e: unknown): never {
  if ((e as { code?: string }).code === "23505") throw new AppError("conflict", "That web address is already used by another series.", { slug: "Already in use." });
  throw e;
}

function staleWrite(): never {
  throw new AppError("conflict", "Someone else saved this since you opened it. Reload to see their changes, then try again.");
}

// ---------- Overview ----------

export async function studioOverview(q: Queryable, actor: Actor | null) {
  requireEditor(actor);
  const { rows } = await q.query(
    `select s.*, 
       (select count(*) from releases r join volumes v on v.id = r.volume_id where v.series_id = s.id) as total,
       (select count(*) from releases r join volumes v on v.id = r.volume_id where v.series_id = s.id and r.status = 'published') as published
     from series s order by s.position, s.created_at`,
  );
  return rows.map((s) => ({ id: s.id, slug: s.slug, title: s.title, status: s.status as "draft" | "published", total: Number(s.total), published: Number(s.published), coverUrl: s.cover_url as string | null, rating: s.rating as string, theme: s.theme as string, logoUrl: s.logo_url as string | null }));
}

// ---------- Series (IP) ----------

export async function createSeries(q: Queryable, actorIn: Actor | null, input: unknown) {
  const actor = requireEditor(actorIn);
  const d = parseOrThrow(seriesSchema, input);
  try {
    const { rows } = await q.query(
      `insert into series (title, slug, tagline, synopsis, rating, cover_url, position, theme, logo_url) values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
      [d.title, d.slug, d.tagline, d.synopsis, d.rating, d.coverUrl ?? null, d.position, d.theme, d.logoUrl ?? null],
    );
    await audit(q, actor.id, "series.created", "series", rows[0].id, { title: d.title });
    return rows[0].id as string;
  } catch (e) {
    conflictOnSlug(e);
  }
}

export async function getStudioSeries(q: Queryable, actor: Actor | null, id: string) {
  requireEditor(actor);
  const { rows } = await q.query("select * from series where id = $1", [id]);
  if (!rows[0]) throw new AppError("not_found", "Series not found.");
  const vols = await q.query(
    `select v.*, (select count(*) from releases r where r.volume_id = v.id) as total,
       (select count(*) from releases r where r.volume_id = v.id and r.status = 'published') as published
     from volumes v where series_id = $1 order by position, created_at`,
    [id],
  );
  const s = rows[0];
  return {
    id: s.id, slug: s.slug, title: s.title, tagline: s.tagline, synopsis: s.synopsis, rating: s.rating, coverUrl: s.cover_url as string | null,
    theme: s.theme as string, logoUrl: s.logo_url as string | null,
    status: s.status as "draft" | "published", position: s.position as number, version: s.version as number,
    volumes: vols.rows.map((v) => ({ id: v.id, format: v.format as "comic" | "show", title: v.title, description: v.description, position: v.position, total: Number(v.total), published: Number(v.published) })),
  };
}

export async function updateSeries(q: Queryable, actorIn: Actor | null, id: string, expectedVersion: number, input: unknown) {
  const actor = requireEditor(actorIn);
  const d = parseOrThrow(seriesSchema, input);
  try {
    const { rowCount } = await q.query(
      `update series set title=$3, slug=$4, tagline=$5, synopsis=$6, rating=$7, cover_url=$8, position=$9, theme=$10, logo_url=$11, version = version + 1, updated_at = now()
       where id = $1 and version = $2`,
      [id, expectedVersion, d.title, d.slug, d.tagline, d.synopsis, d.rating, d.coverUrl ?? null, d.position, d.theme, d.logoUrl ?? null],
    );
    if (!rowCount) await existsOrNotFound(q, "series", id).then(staleWrite);
  } catch (e) {
    conflictOnSlug(e);
  }
  await audit(q, actor.id, "series.updated", "series", id, { title: d.title });
}

export async function setSeriesStatus(q: Queryable, actorIn: Actor | null, id: string, status: "draft" | "published") {
  const actor = requireEditor(actorIn);
  if (status !== "draft" && status !== "published") throw new AppError("invalid", "Unknown status.");
  const { rowCount } = await q.query("update series set status = $2, version = version + 1, updated_at = now() where id = $1", [id, status]);
  if (!rowCount) throw new AppError("not_found", "Series not found.");
  await audit(q, actor.id, status === "published" ? "series.published" : "series.unpublished", "series", id);
}

export async function deleteSeries(q: Queryable, actorIn: Actor | null, id: string, confirmTitle: string) {
  const actor = requireEditor(actorIn);
  const { rows } = await q.query("select title, status from series where id = $1", [id]);
  if (!rows[0]) throw new AppError("not_found", "Series not found.");
  if (rows[0].status === "published") throw new AppError("invalid", "Unpublish the series before deleting it.");
  if (confirmTitle.trim() !== rows[0].title) throw new AppError("invalid", "Type the series title exactly to confirm.", { confirmTitle: "Doesn't match." });
  await q.query("delete from series where id = $1", [id]);
  await audit(q, actor.id, "series.deleted", "series", id, { title: rows[0].title });
}

async function existsOrNotFound(q: Queryable, table: "series" | "releases", id: string) {
  const { rowCount } = await q.query(`select 1 from ${table} where id = $1`, [id]);
  if (!rowCount) throw new AppError("not_found", "Not found.");
}

// ---------- Volumes (comic sagas / show seasons) ----------

const volumeSchema = z.object({
  format: z.enum(["comic", "show"], { message: "Pick comic or show." }),
  title: z.string().trim().min(1, "Enter a title.").max(120),
  description: z.string().trim().max(2000).default(""),
  position: z.coerce.number().int().min(0).max(9999).default(0),
});

export async function createVolume(q: Queryable, actorIn: Actor | null, seriesId: string, input: unknown) {
  const actor = requireEditor(actorIn);
  const d = parseOrThrow(volumeSchema, input);
  const s = await q.query("select 1 from series where id = $1", [seriesId]);
  if (!s.rowCount) throw new AppError("not_found", "Series not found.");
  const { rows } = await q.query(
    "insert into volumes (series_id, format, title, description, position) values ($1,$2,$3,$4,$5) returning id",
    [seriesId, d.format, d.title, d.description, d.position],
  );
  await audit(q, actor.id, "volume.created", "volume", rows[0].id, { seriesId, title: d.title, format: d.format });
  return rows[0].id as string;
}

export async function updateVolume(q: Queryable, actorIn: Actor | null, id: string, input: unknown) {
  const actor = requireEditor(actorIn);
  const d = parseOrThrow(volumeSchema.omit({ format: true }), input);
  const { rowCount } = await q.query("update volumes set title=$2, description=$3, position=$4 where id=$1", [id, d.title, d.description, d.position]);
  if (!rowCount) throw new AppError("not_found", "Not found.");
  await audit(q, actor.id, "volume.updated", "volume", id, { title: d.title });
}

export async function deleteVolume(q: Queryable, actorIn: Actor | null, id: string) {
  const actor = requireEditor(actorIn);
  const { rows } = await q.query("select (select count(*) from releases where volume_id = $1) n, series_id from volumes where id = $1", [id]);
  if (!rows[0]) throw new AppError("not_found", "Not found.");
  if (Number(rows[0].n) > 0) throw new AppError("invalid", "Delete or move its issues/episodes first.");
  await q.query("delete from volumes where id = $1", [id]);
  await audit(q, actor.id, "volume.deleted", "volume", id);
  return rows[0].series_id as string;
}

export async function getStudioVolume(q: Queryable, actor: Actor | null, id: string) {
  requireEditor(actor);
  const { rows } = await q.query("select v.*, s.title as series_title from volumes v join series s on s.id = v.series_id where v.id = $1", [id]);
  if (!rows[0]) throw new AppError("not_found", "Not found.");
  const rel = await q.query(
    "select r.*, (select count(*) from pages p where p.release_id = r.id) as page_count from releases r where volume_id = $1 order by number",
    [id],
  );
  const v = rows[0];
  return {
    id: v.id, seriesId: v.series_id, seriesTitle: v.series_title, format: v.format as "comic" | "show", title: v.title, description: v.description, position: v.position,
    releases: rel.rows.map((r) => ({ id: r.id, number: r.number, title: r.title, status: r.status, publishAt: r.publish_at as Date | null, pageCount: Number(r.page_count), hasVideo: !!r.video_url })),
  };
}

// ---------- Releases (issues / episodes) ----------

const releaseSchema = z.object({
  number: z.coerce.number().int("Use a whole number.").min(1, "Numbers start at 1.").max(100000),
  title: z.string().trim().min(1, "Enter a title.").max(160),
  synopsis: z.string().trim().max(4000).default(""),
  coverUrl: optionalMedia,
});

function dupNumber(e: unknown): never {
  if ((e as { code?: string }).code === "23505") throw new AppError("conflict", "That number is already used in this run.", { number: "Already used." });
  throw e;
}

export async function createRelease(q: Queryable, actorIn: Actor | null, volumeId: string, input: unknown) {
  const actor = requireEditor(actorIn);
  const d = parseOrThrow(releaseSchema, input);
  const v = await q.query("select format from volumes where id = $1", [volumeId]);
  if (!v.rowCount) throw new AppError("not_found", "Not found.");
  try {
    const { rows } = await q.query(
      "insert into releases (volume_id, number, title, synopsis, cover_url) values ($1,$2,$3,$4,$5) returning id",
      [volumeId, d.number, d.title, d.synopsis, d.coverUrl ?? null],
    );
    await audit(q, actor.id, v.rows[0].format === "comic" ? "issue.created" : "episode.created", "release", rows[0].id, { number: d.number, title: d.title });
    return rows[0].id as string;
  } catch (e) {
    dupNumber(e);
  }
}

export async function getStudioRelease(q: Queryable, actor: Actor | null, id: string) {
  requireEditor(actor);
  const { rows } = await q.query(
    `select r.*, v.format, v.title as volume_title, v.series_id, s.title as series_title, s.status as series_status
     from releases r join volumes v on v.id = r.volume_id join series s on s.id = v.series_id where r.id = $1`,
    [id],
  );
  if (!rows[0]) throw new AppError("not_found", "Not found.");
  const pages = await q.query("select id, position, image_url, width, height, alt from pages where release_id = $1 order by position", [id]);
  const r = rows[0];
  return {
    id: r.id, volumeId: r.volume_id, volumeTitle: r.volume_title, seriesId: r.series_id, seriesTitle: r.series_title, seriesStatus: r.series_status,
    format: r.format as "comic" | "show", number: r.number, title: r.title, synopsis: r.synopsis, coverUrl: r.cover_url as string | null,
    videoUrl: r.video_url as string | null, durationSeconds: r.duration_seconds as number | null, status: r.status as "draft" | "published",
    publishAt: r.publish_at as Date | null, publishedAt: r.published_at as Date | null, version: r.version as number,
    pages: pages.rows.map((p) => ({ id: p.id, position: p.position, imageUrl: p.image_url, width: p.width, height: p.height, alt: p.alt })),
  };
}

export async function updateRelease(q: Queryable, actorIn: Actor | null, id: string, expectedVersion: number, input: unknown) {
  const actor = requireEditor(actorIn);
  const d = parseOrThrow(releaseSchema, input);
  try {
    const { rowCount } = await q.query(
      `update releases set number=$3, title=$4, synopsis=$5, cover_url=$6, version = version + 1, updated_at = now() where id=$1 and version=$2`,
      [id, expectedVersion, d.number, d.title, d.synopsis, d.coverUrl ?? null],
    );
    if (!rowCount) await existsOrNotFound(q, "releases", id).then(staleWrite);
  } catch (e) {
    dupNumber(e);
  }
  await audit(q, actor.id, "release.updated", "release", id, { title: d.title });
}

const videoSchema = z.object({
  videoUrl: z.string().trim().refine((s) => s === "" || videoSource(s) !== null, "Upload a video file, or paste a YouTube or Vimeo link."),
  durationSeconds: z.union([z.literal(""), z.coerce.number().int().min(0).max(86400)]).optional(),
});

export async function setVideo(q: Queryable, actorIn: Actor | null, id: string, expectedVersion: number, input: unknown) {
  const actor = requireEditor(actorIn);
  const d = parseOrThrow(videoSchema, input);
  const r = await q.query("select v.format from releases r join volumes v on v.id = r.volume_id where r.id = $1", [id]);
  if (!r.rowCount) throw new AppError("not_found", "Not found.");
  if (r.rows[0].format !== "show") throw new AppError("invalid", "Only episodes have video.");
  const { rowCount } = await q.query(
    "update releases set video_url = $3, duration_seconds = $4, version = version + 1, updated_at = now() where id = $1 and version = $2",
    [id, expectedVersion, d.videoUrl || null, d.durationSeconds === "" || d.durationSeconds == null ? null : d.durationSeconds],
  );
  if (!rowCount) staleWrite();
  await audit(q, actor.id, "episode.video_set", "release", id, { hasVideo: !!d.videoUrl });
}

/** Publish now, or schedule for a future time. Checks the release has content first. */
export async function publishRelease(q: Queryable, actorIn: Actor | null, id: string, publishAtRaw?: string | null) {
  const actor = requireEditor(actorIn);
  const rel = await getStudioRelease(q, actor, id);
  if (rel.format === "comic" && rel.pages.length === 0) throw new AppError("invalid", "Add at least one page before publishing.");
  if (rel.format === "show" && !rel.videoUrl) throw new AppError("invalid", "Add the episode video before publishing.");
  let publishAt: Date | null = null;
  if (publishAtRaw) {
    publishAt = new Date(publishAtRaw);
    if (Number.isNaN(publishAt.getTime())) throw new AppError("invalid", "Pick a valid date and time.");
    if (publishAt.getTime() < Date.now() - 60_000) throw new AppError("invalid", "Pick a time in the future, or publish now.");
  }
  await q.query(
    `update releases set status = 'published', publish_at = $2, published_at = coalesce(published_at, now()), version = version + 1, updated_at = now() where id = $1`,
    [id, publishAt],
  );
  await audit(q, actor.id, publishAt ? "release.scheduled" : "release.published", "release", id, publishAt ? { publishAt: publishAt.toISOString() } : {});
  return { seriesPublished: rel.seriesStatus === "published" };
}

export async function unpublishRelease(q: Queryable, actorIn: Actor | null, id: string) {
  const actor = requireEditor(actorIn);
  const { rowCount } = await q.query(
    "update releases set status = 'draft', publish_at = null, version = version + 1, updated_at = now() where id = $1",
    [id],
  );
  if (!rowCount) throw new AppError("not_found", "Not found.");
  await audit(q, actor.id, "release.unpublished", "release", id);
}

export async function deleteRelease(q: Queryable, actorIn: Actor | null, id: string) {
  const actor = requireEditor(actorIn);
  const { rows } = await q.query("select status, volume_id, title from releases where id = $1", [id]);
  if (!rows[0]) throw new AppError("not_found", "Not found.");
  if (rows[0].status === "published") throw new AppError("invalid", "Unpublish it before deleting.");
  await q.query("delete from releases where id = $1", [id]);
  await audit(q, actor.id, "release.deleted", "release", id, { title: rows[0].title });
  return rows[0].volume_id as string;
}

// ---------- Comic pages ----------

const pagesSchema = z
  .array(
    z.object({
      url: z.string().refine(isStoredMediaUrl, "Pages must be uploaded here."),
      width: z.number().int().positive().max(20000).nullable().optional(),
      height: z.number().int().positive().max(40000).nullable().optional(),
    }),
  )
  .min(1)
  .max(200);

export async function addPages(q: Queryable, actorIn: Actor | null, releaseId: string, input: unknown) {
  const actor = requireEditor(actorIn);
  const pages = parseOrThrow(pagesSchema, input);
  const r = await q.query("select v.format from releases r join volumes v on v.id = r.volume_id where r.id = $1 for update of r", [releaseId]);
  if (!r.rowCount) throw new AppError("not_found", "Not found.");
  if (r.rows[0].format !== "comic") throw new AppError("invalid", "Only comic issues have pages.");
  // Skip URLs already attached, so a retried upload doesn't add duplicates.
  const existing = await q.query("select image_url, coalesce(max(position) over (), -1) as maxpos from pages where release_id = $1", [releaseId]);
  const have = new Set(existing.rows.map((x) => x.image_url));
  let pos = existing.rows.length ? Number(existing.rows[0].maxpos) : -1;
  let added = 0;
  for (const p of pages) {
    if (have.has(p.url)) continue;
    pos += 1;
    await q.query("insert into pages (release_id, position, image_url, width, height) values ($1,$2,$3,$4,$5)", [releaseId, pos, p.url, p.width ?? null, p.height ?? null]);
    have.add(p.url);
    added++;
  }
  await q.query("update releases set version = version + 1, updated_at = now() where id = $1", [releaseId]);
  await audit(q, actor.id, "issue.pages_added", "release", releaseId, { count: added });
  return added;
}

/** Sets page order. Must be run inside a transaction (positions are deferrable-unique). */
export async function reorderPages(q: Queryable, actorIn: Actor | null, releaseId: string, orderedIds: string[]) {
  const actor = requireEditor(actorIn);
  const { rows } = await q.query("select id from pages where release_id = $1", [releaseId]);
  const current = new Set(rows.map((r) => r.id));
  if (orderedIds.length !== current.size || !orderedIds.every((id) => current.has(id)) || new Set(orderedIds).size !== orderedIds.length) {
    throw new AppError("conflict", "The page list changed while you were editing. Reload and try again.");
  }
  for (let i = 0; i < orderedIds.length; i++) await q.query("update pages set position = $2 where id = $1", [orderedIds[i], i]);
  await q.query("update releases set version = version + 1, updated_at = now() where id = $1", [releaseId]);
  await audit(q, actor.id, "issue.pages_reordered", "release", releaseId);
}

export async function deletePage(q: Queryable, actorIn: Actor | null, pageId: string) {
  const actor = requireEditor(actorIn);
  const { rows } = await q.query("select release_id, position from pages where id = $1", [pageId]);
  if (!rows[0]) throw new AppError("not_found", "Page not found.");
  const { release_id, position } = rows[0];
  const rel = await q.query("select status from releases where id = $1", [release_id]);
  const count = await q.query("select count(*) n from pages where release_id = $1", [release_id]);
  if (rel.rows[0].status === "published" && Number(count.rows[0].n) <= 1) throw new AppError("invalid", "A published issue needs at least one page. Unpublish it first.");
  await q.query("delete from pages where id = $1", [pageId]);
  await q.query("update pages set position = position - 1 where release_id = $1 and position > $2", [release_id, position]);
  await q.query("update releases set version = version + 1, updated_at = now() where id = $1", [release_id]);
  await audit(q, actor.id, "issue.page_deleted", "release", release_id, { position });
  return release_id as string;
}

export async function setPageAlt(q: Queryable, actorIn: Actor | null, pageId: string, alt: string) {
  requireEditor(actorIn);
  const text = String(alt ?? "").trim().slice(0, 1000);
  const { rows } = await q.query("update pages set alt = $2 where id = $1 returning release_id", [pageId, text]);
  if (!rows[0]) throw new AppError("not_found", "Page not found.");
  return rows[0].release_id as string;
}

// ---------- Activity ----------

export async function activity(q: Queryable, actor: Actor | null, limit = 100) {
  if (!permissions.viewActivity(actor)) throw new AppError("forbidden", "Only admins can view activity.");
  const { rows } = await q.query(
    `select a.*, u.display_name, u.email from audit_log a left join users u on u.id = a.actor_id order by a.created_at desc limit $1`,
    [limit],
  );
  return rows.map((r) => ({ id: String(r.id), action: r.action, entityType: r.entity_type, entityId: r.entity_id, detail: r.detail, at: r.created_at as Date, actor: r.display_name ? `${r.display_name} (${r.email})` : "system" }));
}
