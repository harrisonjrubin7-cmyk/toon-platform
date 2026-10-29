import { afterAll, describe, expect, it } from "vitest";
import { getRelease, getSeries, latestReleases, listPublishedSeries, saveProgress, continueList, search, setFollow, newForYou } from "@/lib/domain/catalog";
import {
  addPages, createRelease, createSeries, createVolume, deletePage, deleteRelease, deleteSeries, publishRelease, reorderPages,
  setSeriesStatus, setVideo, unpublishRelease, updateRelease, updateSeries, getStudioRelease, studioOverview, activity, deleteVolume,
} from "@/lib/domain/studio";
import { withTx } from "@/lib/db";
import { makeUser, pool, q, uniq } from "./helpers";

afterAll(() => pool.end());

const img = (n: number) => `/media/test/page-${n}-${Math.random().toString(36).slice(2)}.png`;

async function setup() {
  const editor = await makeUser("editor");
  const slug = uniq("vr");
  const seriesId = (await createSeries(q, editor, { title: "Volcano Racers " + slug, slug, rating: "TV-MA" }))!;
  const comicVol = await createVolume(q, editor, seriesId, { format: "comic", title: "Saga One" });
  const showVol = await createVolume(q, editor, seriesId, { format: "show", title: "Season 1" });
  return { editor, slug, seriesId, comicVol, showVol };
}

describe("studio permissions", () => {
  it("readers and anonymous visitors cannot write", async () => {
    const reader = await makeUser("reader");
    await expect(createSeries(q, reader, { title: "X", slug: uniq("x") })).rejects.toMatchObject({ code: "forbidden" });
    await expect(createSeries(q, null, { title: "X", slug: uniq("x") })).rejects.toMatchObject({ code: "unauthenticated" });
    await expect(studioOverview(q, reader)).rejects.toMatchObject({ code: "forbidden" });
    const { editor } = await setup();
    await expect(activity(q, editor)).rejects.toMatchObject({ code: "forbidden" });
  });

  it("validates series input and unique slugs", async () => {
    const { editor, slug } = await setup();
    await expect(createSeries(q, editor, { title: "", slug: "Bad Slug!" })).rejects.toMatchObject({ code: "invalid", fields: { title: expect.any(String), slug: expect.any(String) } });
    await expect(createSeries(q, editor, { title: "Dup", slug })).rejects.toMatchObject({ code: "conflict" });
    await expect(createSeries(q, editor, { title: "Ext", slug: uniq("e"), coverUrl: "https://evil.example.com/x.png" })).rejects.toMatchObject({ code: "invalid" });
  });
});

describe("publishing a comic issue", () => {
  it("draft is hidden; publishing requires pages; then it appears everywhere", async () => {
    const { editor, slug, seriesId, comicVol } = await setup();
    const issue = (await createRelease(q, editor, comicVol, { number: 1, title: "Ember Heart" }))!;
    await expect(createRelease(q, editor, comicVol, { number: 1, title: "dup" })).rejects.toMatchObject({ code: "conflict" });

    await expect(getSeries(q, slug, null)).rejects.toMatchObject({ code: "not_found" }); // series still draft
    await expect(publishRelease(q, editor, issue)).rejects.toMatchObject({ code: "invalid" });

    await addPages(q, editor, issue, [{ url: img(1), width: 800, height: 1200 }, { url: img(2) }]);
    await expect(addPages(q, editor, issue, [{ url: "https://elsewhere.com/a.png" }])).rejects.toMatchObject({ code: "invalid" });
    await publishRelease(q, editor, issue);
    // Still hidden because the IP itself is a draft.
    await expect(getRelease(q, issue, null)).rejects.toMatchObject({ code: "not_found" });
    // Editors can preview.
    expect((await getRelease(q, issue, editor, true)).pages).toHaveLength(2);

    await setSeriesStatus(q, editor, seriesId, "published");
    const detail = await getRelease(q, issue, null);
    expect(detail.pages.map((p) => p.position)).toEqual([0, 1]);
    expect((await getSeries(q, slug, null)).volumes[0].releases).toHaveLength(1);
    expect((await listPublishedSeries(q)).find((s) => s.id === seriesId)?.issueCount).toBe(1);
    expect((await latestReleases(q, 50)).some((r) => r.id === issue)).toBe(true);
    expect((await search(q, "Ember Heart")).releases.some((r) => r.id === issue)).toBe(true);

    await unpublishRelease(q, editor, issue);
    await expect(getRelease(q, issue, null)).rejects.toMatchObject({ code: "not_found" });
  });

  it("re-adding the same page URL is ignored (retry safe); reorder and delete keep positions dense", async () => {
    const { editor, comicVol } = await setup();
    const issue = (await createRelease(q, editor, comicVol, { number: 2, title: "Two" }))!;
    const a = img(1), b = img(2), c = img(3);
    expect(await addPages(q, editor, issue, [{ url: a }, { url: b }, { url: c }])).toBe(3);
    expect(await addPages(q, editor, issue, [{ url: a }])).toBe(0);
    let rel = await getStudioRelease(q, editor, issue);
    const ids = rel.pages.map((p) => p.id);
    await withTx((tx) => reorderPages(tx, editor, issue, [ids[2], ids[0], ids[1]]), pool);
    rel = await getStudioRelease(q, editor, issue);
    expect(rel.pages.map((p) => p.imageUrl)).toEqual([c, a, b]);
    await expect(withTx((tx) => reorderPages(tx, editor, issue, [ids[0]]), pool)).rejects.toMatchObject({ code: "conflict" });
    await deletePage(q, editor, rel.pages[0].id);
    rel = await getStudioRelease(q, editor, issue);
    expect(rel.pages.map((p) => [p.position, p.imageUrl])).toEqual([[0, a], [1, b]]);
  });

  it("scheduled releases stay hidden until their time", async () => {
    const { editor, seriesId, comicVol } = await setup();
    await setSeriesStatus(q, editor, seriesId, "published");
    const issue = (await createRelease(q, editor, comicVol, { number: 3, title: "Later" }))!;
    await addPages(q, editor, issue, [{ url: img(1) }]);
    await expect(publishRelease(q, editor, issue, "2001-01-01T00:00:00Z")).rejects.toMatchObject({ code: "invalid" });
    await publishRelease(q, editor, issue, new Date(Date.now() + 3600_000).toISOString());
    await expect(getRelease(q, issue, null)).rejects.toMatchObject({ code: "not_found" });
    await q.query("update releases set publish_at = now() - interval '1 second' where id = $1", [issue]);
    await expect(getRelease(q, issue, null)).resolves.toMatchObject({ id: issue });
  });
});

describe("publishing an episode", () => {
  it("requires a valid video and plays it", async () => {
    const { editor, seriesId, showVol } = await setup();
    await setSeriesStatus(q, editor, seriesId, "published");
    const ep = (await createRelease(q, editor, showVol, { number: 1, title: "Pilot" }))!;
    await expect(publishRelease(q, editor, ep)).rejects.toMatchObject({ code: "invalid" });
    let v = (await getStudioRelease(q, editor, ep)).version;
    await expect(setVideo(q, editor, ep, v, { videoUrl: "https://example.com/x.mp4" })).rejects.toMatchObject({ code: "invalid" });
    await setVideo(q, editor, ep, v, { videoUrl: "https://youtu.be/dQw4w9WgXcQ", durationSeconds: "1320" });
    await expect(setVideo(q, editor, ep, v, { videoUrl: "" })).rejects.toMatchObject({ code: "conflict" }); // stale version
    v = (await getStudioRelease(q, editor, ep)).version;
    await publishRelease(q, editor, ep);
    const r = await getRelease(q, ep, null);
    expect(r.format).toBe("show");
    expect(r.videoUrl).toContain("youtu.be");
    expect(v).toBeGreaterThan(1);
  });

  it("pages cannot be added to an episode", async () => {
    const { editor, showVol } = await setup();
    const ep = (await createRelease(q, editor, showVol, { number: 2, title: "Two" }))!;
    await expect(addPages(q, editor, ep, [{ url: img(1) }])).rejects.toMatchObject({ code: "invalid" });
  });
});

describe("concurrent edits", () => {
  it("rejects a save based on an old version", async () => {
    const { editor, seriesId, comicVol, slug } = await setup();
    await updateSeries(q, editor, seriesId, 1, { title: "New title", slug });
    await expect(updateSeries(q, editor, seriesId, 1, { title: "Older edit", slug })).rejects.toMatchObject({ code: "conflict" });
    const rel = (await createRelease(q, editor, comicVol, { number: 9, title: "Nine" }))!;
    await updateRelease(q, editor, rel, 1, { number: 9, title: "Nine!" });
    await expect(updateRelease(q, editor, rel, 1, { number: 9, title: "stale" })).rejects.toMatchObject({ code: "conflict" });
  });
});

describe("deletes are guarded", () => {
  it("published things must be unpublished first; series delete needs the exact title", async () => {
    const { editor, seriesId, comicVol, showVol } = await setup();
    const issue = (await createRelease(q, editor, comicVol, { number: 1, title: "One" }))!;
    await addPages(q, editor, issue, [{ url: img(1) }]);
    await publishRelease(q, editor, issue);
    await expect(deleteRelease(q, editor, issue)).rejects.toMatchObject({ code: "invalid" });
    await expect(deleteVolume(q, editor, comicVol)).rejects.toMatchObject({ code: "invalid" });
    const only = (await getStudioRelease(q, editor, issue)).pages[0].id;
    await expect(deletePage(q, editor, only)).rejects.toMatchObject({ code: "invalid" });
    await unpublishRelease(q, editor, issue);
    await deleteRelease(q, editor, issue);
    await deleteVolume(q, editor, showVol);
    await setSeriesStatus(q, editor, seriesId, "published");
    await expect(deleteSeries(q, editor, seriesId, "whatever")).rejects.toMatchObject({ code: "invalid" });
    await setSeriesStatus(q, editor, seriesId, "draft");
    await expect(deleteSeries(q, editor, seriesId, "wrong")).rejects.toMatchObject({ code: "invalid" });
  });
});

describe("reader features", () => {
  it("progress, continue list, follows and new-for-you", async () => {
    const { editor, seriesId, comicVol } = await setup();
    await setSeriesStatus(q, editor, seriesId, "published");
    const i1 = (await createRelease(q, editor, comicVol, { number: 1, title: "One" }))!;
    const i2 = (await createRelease(q, editor, comicVol, { number: 2, title: "Two" }))!;
    for (const i of [i1, i2]) { await addPages(q, editor, i, [{ url: img(1) }, { url: img(2) }]); await publishRelease(q, editor, i); }
    const reader = await makeUser();
    await expect(saveProgress(q, null, i1, 1, false)).rejects.toMatchObject({ code: "unauthenticated" });
    await setFollow(q, reader, seriesId, true);
    expect((await newForYou(q, reader)).map((r) => r.id).sort()).toEqual([i1, i2].sort());
    await saveProgress(q, reader, i1, 1, false);
    await saveProgress(q, reader, i1, 1, true);
    await saveProgress(q, reader, i1, 0, false); // completed stays true
    const list = await continueList(q, reader);
    expect(list[0]).toMatchObject({ id: i1, position: 0, completed: true });
    expect((await newForYou(q, reader)).map((r) => r.id)).toEqual([i2]);
    const d = await getRelease(q, i1, reader);
    expect(d.nextId).toBe(i2);
    expect(d.prevId).toBeNull();
    await unpublishRelease(q, editor, i2);
    await expect(saveProgress(q, reader, i2, 0, false)).rejects.toMatchObject({ code: "not_found" });
  });

  it("records an audit trail admins can read", async () => {
    const admin = await makeUser("admin");
    const { seriesId } = await setup();
    const log = await activity(q, admin, 500);
    expect(log.some((e) => e.entityId === seriesId && e.action === "series.created")).toBe(true);
  });
});
