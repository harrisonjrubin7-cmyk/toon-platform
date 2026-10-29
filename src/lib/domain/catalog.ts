import type { Queryable } from "../db";
import { AppError } from "../errors";
import { permissions, type Actor } from "../roles";

/** A release is public when it and its IP are published and its publish time has passed. */
export const VISIBLE = `r.status = 'published' and (r.publish_at is null or r.publish_at <= now()) and s.status = 'published'`;

export type SeriesCard = {
  id: string; slug: string; title: string; tagline: string; rating: string; coverUrl: string | null;
  issueCount: number; episodeCount: number; theme: string; logoUrl: string | null;
};

export async function listPublishedSeries(q: Queryable): Promise<SeriesCard[]> {
  const { rows } = await q.query(
    `select s.id, s.slug, s.title, s.tagline, s.rating, s.cover_url, s.theme, s.logo_url,
        count(r.id) filter (where v.format = 'comic') as issues,
        count(r.id) filter (where v.format = 'show') as episodes
     from series s
     left join volumes v on v.series_id = s.id
     left join releases r on r.volume_id = v.id and r.status = 'published' and (r.publish_at is null or r.publish_at <= now())
     where s.status = 'published'
     group by s.id order by s.position, s.created_at`,
  );
  return rows.map((r) => ({
    id: r.id, slug: r.slug, title: r.title, tagline: r.tagline, rating: r.rating, coverUrl: r.cover_url,
    issueCount: Number(r.issues), episodeCount: Number(r.episodes), theme: r.theme, logoUrl: r.logo_url,
  }));
}

export type ReleaseCard = {
  id: string; number: number; title: string; synopsis: string; coverUrl: string | null; format: "comic" | "show";
  publishedAt: Date | null; seriesSlug: string; seriesTitle: string; volumeTitle: string; durationSeconds: number | null;
  theme: string; rating: string; seriesLogoUrl: string | null;
};

const releaseCard = (r: Record<string, unknown>): ReleaseCard => ({
  id: r.id as string, number: r.number as number, title: r.title as string, synopsis: r.synopsis as string,
  coverUrl: (r.cover_url as string) ?? null, format: r.format as "comic" | "show",
  publishedAt: (r.effective_at as Date) ?? null, seriesSlug: r.series_slug as string, seriesTitle: r.series_title as string,
  volumeTitle: r.volume_title as string, durationSeconds: (r.duration_seconds as number) ?? null,
  theme: r.theme as string, rating: r.rating as string, seriesLogoUrl: (r.series_logo_url as string) ?? null,
});

const RELEASE_COLS = `r.id, r.number, r.title, r.synopsis, coalesce(r.cover_url, s.cover_url) as cover_url, r.duration_seconds,
  v.format, coalesce(r.publish_at, r.published_at) as effective_at, s.slug as series_slug, s.title as series_title, v.title as volume_title, s.theme, s.rating, s.logo_url as series_logo_url`;

export async function latestReleases(q: Queryable, limit = 12, format?: "comic" | "show"): Promise<ReleaseCard[]> {
  const { rows } = await q.query(
    `select ${RELEASE_COLS} from releases r join volumes v on v.id = r.volume_id join series s on s.id = v.series_id
     where ${VISIBLE} and ($2::text is null or v.format = $2)
     order by coalesce(r.publish_at, r.published_at) desc nulls last, r.number desc limit $1`,
    [limit, format ?? null],
  );
  return rows.map(releaseCard);
}

export type SeriesDetail = {
  id: string; slug: string; title: string; tagline: string; synopsis: string; rating: string; coverUrl: string | null;
  theme: string; logoUrl: string | null;
  volumes: { id: string; format: "comic" | "show"; title: string; description: string; releases: ReleaseCard[] }[];
  following: boolean;
};

export async function getSeries(q: Queryable, slug: string, actor: Actor | null): Promise<SeriesDetail> {
  const { rows } = await q.query("select * from series where slug = $1", [slug]);
  const s = rows[0];
  if (!s || s.status !== "published") throw new AppError("not_found", "Series not found.");
  const vols = await q.query("select * from volumes where series_id = $1 order by position, created_at", [s.id]);
  const rels = await q.query(
    `select ${RELEASE_COLS}, r.volume_id from releases r join volumes v on v.id = r.volume_id join series s on s.id = v.series_id
     where s.id = $1 and ${VISIBLE} order by r.number`,
    [s.id],
  );
  let following = false;
  if (actor) {
    const f = await q.query("select 1 from follows where user_id = $1 and series_id = $2", [actor.id, s.id]);
    following = f.rowCount! > 0;
  }
  return {
    id: s.id, slug: s.slug, title: s.title, tagline: s.tagline, synopsis: s.synopsis, rating: s.rating, coverUrl: s.cover_url, theme: s.theme, logoUrl: s.logo_url, following,
    volumes: vols.rows
      .map((v) => ({
        id: v.id, format: v.format, title: v.title, description: v.description,
        releases: rels.rows.filter((r) => r.volume_id === v.id).map(releaseCard),
      }))
      .filter((v) => v.releases.length > 0),
  };
}

export type ReleaseDetail = ReleaseCard & {
  seriesId: string; videoUrl: string | null;
  pages: { id: string; position: number; imageUrl: string; width: number | null; height: number | null; alt: string }[];
  prevId: string | null; nextId: string | null; progress: { position: number; completed: boolean } | null;
};

/** Public read of one issue or episode. Editors may preview unpublished work with preview=true. */
export async function getRelease(q: Queryable, id: string, actor: Actor | null, preview = false): Promise<ReleaseDetail> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new AppError("not_found", "Not found.");
  const canPreview = preview && permissions.manageContent(actor);
  const { rows } = await q.query(
    `select ${RELEASE_COLS}, r.volume_id, r.video_url, s.id as series_id, (${VISIBLE}) as visible
     from releases r join volumes v on v.id = r.volume_id join series s on s.id = v.series_id where r.id = $1`,
    [id],
  );
  const r = rows[0];
  if (!r || (!r.visible && !canPreview)) throw new AppError("not_found", "Not found.");
  const pages = r.format === "comic"
    ? (await q.query("select id, position, image_url, width, height, alt from pages where release_id = $1 order by position", [id])).rows
    : [];
  const sib = await q.query(
    `select r.id, r.number from releases r join volumes v on v.id = r.volume_id join series s on s.id = v.series_id
     where r.volume_id = $1 and ${VISIBLE} order by r.number`,
    [r.volume_id],
  );
  const idx = sib.rows.findIndex((x) => x.id === id);
  let progress = null;
  if (actor) {
    const p = await q.query("select position, completed from progress where user_id = $1 and release_id = $2", [actor.id, id]);
    progress = p.rows[0] ? { position: p.rows[0].position as number, completed: p.rows[0].completed as boolean } : null;
  }
  return {
    ...releaseCard(r), seriesId: r.series_id, videoUrl: r.video_url,
    pages: pages.map((p) => ({ id: p.id, position: p.position, imageUrl: p.image_url, width: p.width, height: p.height, alt: p.alt })),
    prevId: idx > 0 ? sib.rows[idx - 1].id : null,
    nextId: idx >= 0 && idx < sib.rows.length - 1 ? sib.rows[idx + 1].id : null,
    progress,
  };
}

export async function search(q: Queryable, termRaw: string): Promise<{ series: SeriesCard[]; releases: ReleaseCard[] }> {
  const term = termRaw.trim().slice(0, 100);
  if (term.length < 2) return { series: [], releases: [] };
  const like = `%${term.replace(/[\\%_]/g, (c) => "\\" + c)}%`;
  const all = await listPublishedSeries(q);
  const sIds = await q.query(
    "select id from series where status = 'published' and (title ilike $1 or tagline ilike $1 or synopsis ilike $1)",
    [like],
  );
  const ids = new Set(sIds.rows.map((r) => r.id));
  const rels = await q.query(
    `select ${RELEASE_COLS} from releases r join volumes v on v.id = r.volume_id join series s on s.id = v.series_id
     where ${VISIBLE} and (r.title ilike $1 or r.synopsis ilike $1) order by s.title, r.number limit 50`,
    [like],
  );
  return { series: all.filter((s) => ids.has(s.id)), releases: rels.rows.map(releaseCard) };
}

// ---- Reader state ----

export async function saveProgress(q: Queryable, actor: Actor | null, releaseId: string, position: number, completed: boolean) {
  if (!permissions.saveProgress(actor)) throw new AppError("unauthenticated", "Sign in to save your place.");
  await getRelease(q, releaseId, actor); // must be visible
  const pos = Math.max(0, Math.min(1_000_000, Math.floor(Number(position) || 0)));
  await q.query(
    `insert into progress (user_id, release_id, position, completed, updated_at) values ($1,$2,$3,$4, now())
     on conflict (user_id, release_id) do update set position = excluded.position,
       completed = progress.completed or excluded.completed, updated_at = now()`,
    [actor!.id, releaseId, pos, !!completed],
  );
}

export async function continueList(q: Queryable, actor: Actor): Promise<(ReleaseCard & { position: number; completed: boolean })[]> {
  const { rows } = await q.query(
    `select ${RELEASE_COLS}, p.position, p.completed from progress p
     join releases r on r.id = p.release_id join volumes v on v.id = r.volume_id join series s on s.id = v.series_id
     where p.user_id = $1 and ${VISIBLE} order by p.updated_at desc limit 24`,
    [actor.id],
  );
  return rows.map((r) => ({ ...releaseCard(r), position: r.position, completed: r.completed }));
}

export async function setFollow(q: Queryable, actor: Actor | null, seriesId: string, follow: boolean) {
  if (!actor) throw new AppError("unauthenticated", "Sign in to follow a series.");
  const s = await q.query("select 1 from series where id = $1 and status = 'published'", [seriesId]);
  if (!s.rowCount) throw new AppError("not_found", "Series not found.");
  if (follow) await q.query("insert into follows (user_id, series_id) values ($1,$2) on conflict do nothing", [actor.id, seriesId]);
  else await q.query("delete from follows where user_id = $1 and series_id = $2", [actor.id, seriesId]);
}

export async function followedSeries(q: Queryable, actor: Actor): Promise<SeriesCard[]> {
  const all = await listPublishedSeries(q);
  const { rows } = await q.query("select series_id from follows where user_id = $1", [actor.id]);
  const ids = new Set(rows.map((r) => r.series_id));
  return all.filter((s) => ids.has(s.id));
}

/** New releases from followed series that the reader has not opened yet. */
export async function newForYou(q: Queryable, actor: Actor): Promise<ReleaseCard[]> {
  const { rows } = await q.query(
    `select ${RELEASE_COLS} from follows f join series s on s.id = f.series_id join volumes v on v.series_id = s.id
     join releases r on r.volume_id = v.id
     where f.user_id = $1 and ${VISIBLE} and not exists (select 1 from progress p where p.user_id = $1 and p.release_id = r.id)
     order by coalesce(r.publish_at, r.published_at) desc limit 12`,
    [actor.id],
  );
  return rows.map(releaseCard);
}
