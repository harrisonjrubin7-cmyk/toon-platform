"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, withTx } from "@/lib/db";
import { currentActor, safeNext } from "@/lib/auth/session";
import { toActionState, type ActionState } from "@/lib/errors";
import * as profiles from "@/lib/domain/community/profiles";
import * as comics from "@/lib/domain/community/comics";
import * as ideas from "@/lib/domain/community/ideas";
import * as social from "@/lib/domain/community/social";
import * as mod from "@/lib/domain/community/moderation";

const str = (f: FormData, k: string) => String(f.get(k) ?? "");

/** Failure state that also returns what was typed, so React's post-submit form reset puts it back. */
export type FormState = (NonNullable<ActionState> & { values?: Record<string, string> }) | undefined;
function fail(e: unknown, f: FormData): FormState {
  const values: Record<string, string> = {};
  for (const [k, v] of f.entries()) if (typeof v === "string" && !k.startsWith("$")) values[k] = v;
  return { ...toActionState(e), values };
}

export async function saveProfileAction(_: FormState, f: FormData): Promise<FormState> {
  try {
    await withTx(async (tx) => profiles.saveProfile(tx, await currentActor(), { handle: str(f, "handle"), bio: str(f, "bio"), avatarUrl: str(f, "avatarUrl"), acceptTerms: f.get("acceptTerms") === "on" }));
  } catch (e) {
    return fail(e, f);
  }
  revalidatePath("/", "layout");
  redirect(safeNext(f.get("next"), "/create"));
}

export async function createComicAction(_: FormState, f: FormData): Promise<FormState> {
  let id: string;
  try {
    id = await withTx(async (tx) => comics.createComic(tx, await currentActor(), { title: str(f, "title"), rating: str(f, "rating"), spinoffOf: str(f, "spinoffOf") }));
  } catch (e) {
    return fail(e, f);
  }
  redirect(`/create/${id}`);
}

export type SaveResult = { ok: true; version: number; moderation: string } | { ok: false; error: string; conflict?: boolean };

/** Called by the editor with the whole comic as JSON. */
export async function saveComicAction(id: string, version: number, data: comics.ComicInput): Promise<SaveResult> {
  try {
    const r = await withTx(async (tx) => comics.saveComic(tx, await currentActor(), id, version, data));
    revalidatePath(`/c/${id}`);
    return { ok: true, ...r };
  } catch (e) {
    const s = toActionState(e);
    return { ok: false, error: s?.error ?? "Not saved.", conflict: (e as { code?: string }).code === "conflict" };
  }
}

export async function publishComicAction(_: FormState, f: FormData): Promise<FormState> {
  const id = str(f, "id");
  try {
    const m = await withTx(async (tx) => comics.publishComic(tx, await currentActor(), id));
    revalidatePath("/community");
    revalidatePath(`/create/${id}`);
    return { ok: true, message: m === "pending" ? "Sent to the studio for approval. It goes live once approved." : m === "hidden" ? "Published, but it stays hidden until the studio reviews it." : "Published. It's live in the community." };
  } catch (e) {
    return fail(e, f);
  }
}

export async function unpublishComicAction(_: FormState, f: FormData): Promise<FormState> {
  const id = str(f, "id");
  try {
    await withTx(async (tx) => comics.unpublishComic(tx, await currentActor(), id));
  } catch (e) {
    return fail(e, f);
  }
  revalidatePath("/community");
  revalidatePath(`/create/${id}`);
  return { ok: true, message: "Back to draft. Only you can see it now." };
}

export async function deleteComicAction(_: FormState, f: FormData): Promise<FormState> {
  try {
    await withTx(async (tx) => comics.deleteComic(tx, await currentActor(), str(f, "id"), str(f, "confirmTitle")));
  } catch (e) {
    return fail(e, f);
  }
  revalidatePath("/community");
  redirect("/create");
}

export async function createIdeaAction(_: FormState, f: FormData): Promise<FormState> {
  let id: string;
  try {
    ({ id } = await withTx(async (tx) => ideas.createIdea(tx, await currentActor(), { title: str(f, "title"), body: str(f, "body"), spinoffOf: str(f, "spinoffOf"), rating: str(f, "rating") })));
  } catch (e) {
    return fail(e, f);
  }
  revalidatePath("/community");
  redirect(`/ideas/${id}`);
}

export async function deleteIdeaAction(f: FormData) {
  await withTx(async (tx) => ideas.deleteIdea(tx, await currentActor(), str(f, "id")));
  revalidatePath("/community");
  redirect("/create");
}

function backTo(f: FormData) {
  const p = safeNext(f.get("path"), "/community");
  revalidatePath(p);
  return p;
}

export async function likeAction(f: FormData) {
  const actor = await currentActor();
  const p = backTo(f);
  if (!actor) redirect(`/login?next=${encodeURIComponent(p)}`);
  await withTx(async (tx) => social.setLike(tx, actor, social.parseTarget(str(f, "type")), str(f, "id"), f.get("like") === "1"));
}

export async function commentAction(_: FormState, f: FormData): Promise<FormState> {
  try {
    await withTx(async (tx) => social.addComment(tx, await currentActor(), social.parseTarget(str(f, "type")), str(f, "id"), { body: str(f, "body") }));
  } catch (e) {
    return fail(e, f);
  }
  backTo(f);
  return { ok: true, message: "Comment posted." };
}

export async function deleteCommentAction(f: FormData) {
  await withTx(async (tx) => social.deleteComment(tx, await currentActor(), str(f, "commentId")));
  backTo(f);
}

export async function followUserAction(f: FormData) {
  const actor = await currentActor();
  const p = backTo(f);
  if (!actor) redirect(`/login?next=${encodeURIComponent(p)}`);
  await withTx(async (tx) => profiles.setUserFollow(tx, actor, str(f, "userId"), f.get("follow") === "1"));
}

export async function markReadAction() {
  await social.markAllRead(db, await currentActor());
  revalidatePath("/community/notifications");
  revalidatePath("/", "layout");
}

export async function reportAction(_: FormState, f: FormData): Promise<FormState> {
  try {
    const r = await withTx(async (tx) => mod.report(tx, await currentActor(), { targetType: str(f, "targetType"), targetId: str(f, "targetId"), reason: str(f, "reason"), details: str(f, "details") }));
    if (r.autoHidden) backTo(f);
    return { ok: true, message: r.duplicate ? "You already reported this. The studio will review it." : "Thanks. The studio will review your report." };
  } catch (e) {
    return fail(e, f);
  }
}

// ---------- Studio moderation ----------

export async function decideAction(_: FormState, f: FormData): Promise<FormState> {
  try {
    await withTx(async (tx) => mod.decide(tx, await currentActor(), { targetType: str(f, "targetType"), targetId: str(f, "targetId"), decision: str(f, "decision"), note: str(f, "note") }));
  } catch (e) {
    return fail(e, f);
  }
  revalidatePath("/studio/community");
  revalidatePath("/community");
  const labels: Record<string, string> = { dismiss: "Reports dismissed.", hide: "Hidden.", remove: "Removed.", restore: "Restored.", approve: "Approved. It's live." };
  return { ok: true, message: labels[str(f, "decision")] ?? "Done." };
}

export async function suspendAction(_: FormState, f: FormData): Promise<FormState> {
  try {
    const until = await withTx(async (tx) => mod.suspend(tx, await currentActor(), { userId: str(f, "userId"), days: str(f, "days"), reason: str(f, "reason") }));
    revalidatePath("/studio/community");
    return { ok: true, message: until ? `Posting paused until ${until.toUTCString()}.` : "Posting restored." };
  } catch (e) {
    return fail(e, f);
  }
}

export async function updateSettingsAction(_: FormState, f: FormData): Promise<FormState> {
  try {
    await withTx(async (tx) => mod.updateSettings(tx, await currentActor(), Number(str(f, "version")), {
      preModeration: f.get("preModeration") === "on", allowFanWorks: f.get("allowFanWorks") === "on", autoHideReports: str(f, "autoHideReports"),
    }));
  } catch (e) {
    return fail(e, f);
  }
  revalidatePath("/studio/community");
  return { ok: true, message: "Community rules saved." };
}
