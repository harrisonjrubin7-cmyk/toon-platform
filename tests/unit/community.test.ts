import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { makeUser, pool, q, uniq } from "./helpers";
import type { Actor } from "@/lib/roles";
import { getProfileByHandle, saveProfile, setUserFollow } from "@/lib/domain/community/profiles";
import { createComic, getComic, getComicForEdit, listComics, publishComic, saveComic, deleteComic, unpublishComic } from "@/lib/domain/community/comics";
import { createIdea, getIdea, listIdeas } from "@/lib/domain/community/ideas";
import { addComment, deleteComment, listComments, listNotifications, setLike, unreadCount } from "@/lib/domain/community/social";
import { decide, pendingQueue, report, reportQueue, suspend, updateSettings } from "@/lib/domain/community/moderation";
import { getSettings } from "@/lib/domain/community/shared";
import { isOwnCommunityImage, sniffImage } from "@/lib/community-media";
import { relayout } from "@/lib/comic-layouts";

const img = (u: Actor, n = 1) => `/media/community/${u.id}/2026-10-29/p${n}.png`;

async function member(role: Actor["role"] = "reader") {
  const a = await makeUser(role);
  await saveProfile(q, a, { handle: uniq("m").replace(/-/g, "_").slice(0, 30), bio: "", acceptTerms: true });
  return a;
}

async function readyComic(author: Actor, extra: Record<string, unknown> = {}) {
  const id = await createComic(q, author, { title: "Pit Lane", rating: "Mature", ...extra });
  const c = await getComicForEdit(q, author, id);
  const pages = [
    { layout: "two-across", panels: [
      { imageUrl: img(author, 1), alt: "Wren at the wheel", lettering: [{ kind: "dialogue", speaker: "Wren", text: "Hold on." }] },
      { imageUrl: img(author, 2), alt: "", lettering: [{ kind: "sfx", speaker: "", text: "VRRM" }] },
    ] },
  ];
  await saveComic(q, author, id, c.version, { title: "Pit Lane", rating: "Mature", summary: "A race.", pages, spinoffOf: (extra.spinoffOf as string) ?? "" });
  return id;
}

let series: { id: string; slug: string };
beforeAll(async () => {
  const slug = uniq("vr");
  const { rows } = await q.query("insert into series (slug, title, status) values ($1, 'Volcano Racers', 'published') returning id, slug", [slug]);
  series = rows[0] as { id: string; slug: string };
});
afterAll(() => pool.end());

describe("community media rules", () => {
  it("only accepts a member's own community uploads", async () => {
    const a = await makeUser();
    const b = await makeUser();
    expect(isOwnCommunityImage(img(a), a.id)).toBe(true);
    expect(isOwnCommunityImage(img(b), a.id)).toBe(false);
    expect(isOwnCommunityImage(`/media/studio/x.png`, a.id)).toBe(false);
    expect(isOwnCommunityImage(`https://evil.example/community/${a.id}/x.png`, a.id)).toBe(false);
    expect(isOwnCommunityImage(`https://abc.public.blob.vercel-storage.com/community/${a.id}/x-123.png`, a.id)).toBe(true);
    expect(isOwnCommunityImage(`/media/community/${a.id}/../${b.id}/x.png`, a.id)).toBe(false);
  });
  it("sniffs real image bytes", () => {
    expect(sniffImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe("image/png");
    expect(sniffImage(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
  });
  it("relayout keeps panels that fit", () => {
    const p = relayout({ layout: "grid4", panels: [1, 2, 3, 4].map((n) => ({ imageUrl: `u${n}`, alt: "", lettering: [] })) }, "two-stack");
    expect(p.panels.map((x) => x.imageUrl)).toEqual(["u1", "u2"]);
    expect(relayout(p, "three-stack").panels[2].imageUrl).toBeNull();
  });
});

describe("profiles", () => {
  it("requires terms, unique handles, and blocks reserved names", async () => {
    const a = await makeUser();
    await expect(saveProfile(q, a, { handle: "good_name", acceptTerms: false })).rejects.toMatchObject({ code: "invalid" });
    await expect(saveProfile(q, a, { handle: "Studio", acceptTerms: true })).rejects.toMatchObject({ fields: { handle: "That handle is reserved." } });
    const h = uniq("h").replace(/-/g, "_").slice(0, 30);
    await saveProfile(q, a, { handle: h, acceptTerms: true });
    const b = await makeUser();
    await expect(saveProfile(q, b, { handle: h.toUpperCase(), acceptTerms: true })).rejects.toMatchObject({ code: "conflict" });
  });
  it("posting needs a profile", async () => {
    const a = await makeUser();
    await expect(createComic(q, a, { title: "X", rating: "Mature" })).rejects.toMatchObject({ code: "forbidden" });
  });
});

describe("fan comics", () => {
  it("drafts are private, publish needs art in every panel, published is public", async () => {
    const a = await member();
    const other = await member();
    const id = await createComic(q, a, { title: "Draft", rating: "Mature" });
    await expect(getComic(q, id, other)).rejects.toMatchObject({ code: "not_found" });
    await expect(getComic(q, id, null)).rejects.toMatchObject({ code: "not_found" });
    await expect(publishComic(q, a, id)).rejects.toThrow(/needs art/);
    await expect(getComicForEdit(q, other, id)).rejects.toMatchObject({ code: "not_found" });

    const ready = await readyComic(a);
    expect(await publishComic(q, a, ready)).toBe("visible");
    const v = await getComic(q, ready, null);
    expect(v.pages[0].panels[0].lettering[0]).toEqual({ kind: "dialogue", speaker: "Wren", text: "Hold on." });
    expect((await listComics(q, null)).some((c) => c.id === ready)).toBe(true);
    await unpublishComic(q, a, ready);
    await expect(getComic(q, ready, null)).rejects.toMatchObject({ code: "not_found" });
  });

  it("rejects images that aren't the author's uploads, wrong panel counts, and stale saves", async () => {
    const a = await member();
    const b = await member();
    const id = await createComic(q, a, { title: "T", rating: "Teen" });
    const c = await getComicForEdit(q, a, id);
    const base = { title: "T", rating: "Teen" };
    await expect(saveComic(q, a, id, c.version, { ...base, pages: [{ layout: "full", panels: [{ imageUrl: img(b), alt: "", lettering: [] }] }] })).rejects.toThrow(/uploaded here, by you/);
    await expect(saveComic(q, a, id, c.version, { ...base, pages: [{ layout: "grid4", panels: [{ imageUrl: null, alt: "", lettering: [] }] }] })).rejects.toMatchObject({ code: "invalid" });
    const ok = await saveComic(q, a, id, c.version, { ...base, pages: [] });
    await expect(saveComic(q, a, id, c.version, { ...base, pages: [] })).rejects.toMatchObject({ code: "conflict" });
    expect(ok.version).toBe(c.version + 1);
  });

  it("spinoffs link to a published series and show up under it", async () => {
    const a = await member();
    const id = await readyComic(a, { spinoffOf: series.id });
    await publishComic(q, a, id);
    const list = await listComics(q, null, { seriesSlug: series.slug });
    expect(list.find((c) => c.id === id)?.spinoff).toEqual({ slug: series.slug, title: "Volcano Racers" });
    const { rows } = await q.query("insert into series (slug, title) values ($1, 'Secret') returning id", [uniq("draft")]);
    await expect(createComic(q, a, { title: "Y", rating: "Mature", spinoffOf: rows[0].id })).rejects.toMatchObject({ fields: { spinoffOf: "Pick a published series." } });
  });

  it("only the author can delete, with the exact title", async () => {
    const a = await member();
    const b = await member();
    const id = await readyComic(a);
    await expect(deleteComic(q, b, id, "Pit Lane")).rejects.toMatchObject({ code: "not_found" });
    await expect(deleteComic(q, a, id, "pit")).rejects.toMatchObject({ code: "invalid" });
    await deleteComic(q, a, id, "Pit Lane");
    await expect(getComic(q, id, a)).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("social", () => {
  it("likes, comments, follows and notifications", async () => {
    const a = await member();
    const b = await member();
    const id = await readyComic(a);
    await publishComic(q, a, id);
    expect(await setLike(q, b, "comic", id, true)).toBe(1);
    expect(await setLike(q, b, "comic", id, true)).toBe(1); // double tap is idempotent
    const cid = await addComment(q, b, "comic", id, { body: "Love the pit stop." });
    await setUserFollow(q, b, a.id, true);
    expect(await unreadCount(q, a)).toBe(3);
    const kinds = (await listNotifications(q, a)).map((n) => n.kind).sort();
    expect(kinds).toEqual(["comment", "follow", "like"]);
    const profile = await getProfileByHandle(q, (await q.query("select handle from profiles where user_id=$1", [a.id])).rows[0].handle, b);
    expect(profile).toMatchObject({ followers: 1, isFollowing: true });
    expect((await listComics(q, b, { following: true })).some((c) => c.id === id)).toBe(true);
    await expect(deleteComment(q, a, cid)).rejects.toMatchObject({ code: "forbidden" });
    await deleteComment(q, b, cid);
    expect(await listComments(q, null, "comic", id)).toHaveLength(0);
  });

  it("can't like or comment on drafts others can't see", async () => {
    const a = await member();
    const b = await member();
    const id = await createComic(q, a, { title: "Hidden", rating: "Mature" });
    await expect(setLike(q, b, "comic", id, true)).rejects.toMatchObject({ code: "not_found" });
    await expect(addComment(q, b, "comic", id, { body: "hi" })).rejects.toMatchObject({ code: "not_found" });
  });

  it("ideas can pitch spinoffs", async () => {
    const a = await member();
    const { id } = await createIdea(q, a, { title: "Ember before the theft", body: "A one-shot about Ember's last clean race.", spinoffOf: series.id, rating: "Mature" });
    expect((await getIdea(q, id, null)).spinoff?.slug).toBe(series.slug);
    expect((await listIdeas(q, null, { seriesSlug: series.slug })).some((i) => i.id === id)).toBe(true);
    await expect(createIdea(q, a, { title: "x", body: "short", rating: "Mature" })).rejects.toMatchObject({ code: "invalid" });
  });
});

describe("moderation", () => {
  it("reports dedupe, auto-hide at the threshold, and moderators restore or remove", async () => {
    const a = await member();
    const id = await readyComic(a);
    await publishComic(q, a, id);
    const r1 = await member(); const r2 = await member(); const r3 = await member();
    await expect(report(q, a, { targetType: "comic", targetId: id, reason: "spam" })).rejects.toMatchObject({ code: "invalid" });
    expect(await report(q, r1, { targetType: "comic", targetId: id, reason: "spam" })).toEqual({ duplicate: false, autoHidden: false });
    expect(await report(q, r1, { targetType: "comic", targetId: id, reason: "spam" })).toMatchObject({ duplicate: true });
    await report(q, r2, { targetType: "comic", targetId: id, reason: "spam" });
    expect(await report(q, r3, { targetType: "comic", targetId: id, reason: "spam" })).toMatchObject({ autoHidden: true });
    await expect(getComic(q, id, null)).rejects.toMatchObject({ code: "not_found" });

    const mod = await makeUser("editor");
    await expect(reportQueue(q, r1)).rejects.toMatchObject({ code: "forbidden" });
    const item = (await reportQueue(q, mod)).find((i) => i.targetId === id)!;
    expect(item.reports).toHaveLength(3);
    await decide(q, mod, { targetType: "comic", targetId: id, decision: "restore" });
    expect((await getComic(q, id, null)).id).toBe(id);
    expect((await reportQueue(q, mod)).find((i) => i.targetId === id)).toBeUndefined();

    await decide(q, mod, { targetType: "comic", targetId: id, decision: "remove", note: "Copied art." });
    await expect(getComic(q, id, null)).rejects.toMatchObject({ code: "not_found" });
    const c = await getComicForEdit(q, a, id);
    expect(c.moderationNote).toBe("Copied art.");
    await expect(saveComic(q, a, id, c.version, { title: "x", rating: "Mature" })).rejects.toMatchObject({ code: "forbidden" });
    await expect(publishComic(q, a, id)).rejects.toMatchObject({ code: "forbidden" });
    expect((await listNotifications(q, a)).some((n) => n.kind === "moderation" && n.detail === "Copied art.")).toBe(true);
  });

  it("a child-safety report hides the post at once", async () => {
    const a = await member();
    const id = await readyComic(a);
    await publishComic(q, a, id);
    expect(await report(q, await member(), { targetType: "comic", targetId: id, reason: "minor_safety" })).toMatchObject({ autoHidden: true });
  });

  it("suspension blocks posting but not reading; staff can't be suspended", async () => {
    const a = await member();
    const mod = await makeUser("editor");
    await suspend(q, mod, { userId: a.id, days: 7, reason: "Spam" });
    await expect(createComic(q, a, { title: "X", rating: "Mature" })).rejects.toThrow(/paused until/);
    await suspend(q, mod, { userId: a.id, days: 0 });
    await createComic(q, a, { title: "Back", rating: "Mature" });
    const ed = await member("editor");
    await expect(suspend(q, mod, { userId: ed.id, days: 1 })).rejects.toMatchObject({ code: "forbidden" });
  });

  it("approval mode holds new posts until a moderator approves them", async () => {
    const admin = await makeUser("admin");
    const mod = await makeUser("editor");
    await expect(updateSettings(q, mod, 1, { preModeration: true, allowFanWorks: true, autoHideReports: 3 })).rejects.toMatchObject({ code: "forbidden" });
    const s = await getSettings(q);
    await updateSettings(q, admin, s.version, { preModeration: true, allowFanWorks: false, autoHideReports: 3 });
    try {
      const a = await member();
      const id = await readyComic(a);
      expect(await publishComic(q, a, id)).toBe("pending");
      await expect(getComic(q, id, null)).rejects.toMatchObject({ code: "not_found" });
      expect((await pendingQueue(q, mod)).some((p) => p.targetId === id)).toBe(true);
      await decide(q, mod, { targetType: "comic", targetId: id, decision: "approve" });
      expect((await getComic(q, id, null)).id).toBe(id);
      await expect(createIdea(q, a, { title: "Spin", body: "A long enough pitch body here.", spinoffOf: series.id, rating: "Mature" })).rejects.toMatchObject({ fields: { spinoffOf: "Not accepted right now." } });
    } finally {
      const now = await getSettings(q);
      await updateSettings(q, admin, now.version, { preModeration: false, allowFanWorks: true, autoHideReports: 3 });
    }
  });
});
