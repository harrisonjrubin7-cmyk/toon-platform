"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, withTx } from "@/lib/db";
import { currentActor } from "@/lib/auth/session";
import * as studio from "@/lib/domain/studio";
import { toActionState, type ActionState } from "@/lib/errors";

const str = (f: FormData, k: string) => String(f.get(k) ?? "");
const num = (f: FormData, k: string) => Number(f.get(k) ?? 0);

function seriesInput(f: FormData) {
  return { title: str(f, "title"), slug: str(f, "slug"), tagline: str(f, "tagline"), synopsis: str(f, "synopsis"), rating: str(f, "rating"), coverUrl: str(f, "coverUrl"), logoUrl: str(f, "logoUrl"), theme: str(f, "theme") || "studio", position: str(f, "position") || 0 };
}
function releaseInput(f: FormData) {
  return { number: str(f, "number"), title: str(f, "title"), synopsis: str(f, "synopsis"), coverUrl: str(f, "coverUrl") };
}

function refreshPublic() {
  revalidatePath("/", "layout");
}

export async function createSeriesAction(_: ActionState, f: FormData): Promise<ActionState> {
  let id: string;
  try {
    id = (await withTx(async (tx) => studio.createSeries(tx, await currentActor(), seriesInput(f))))!;
  } catch (e) {
    return toActionState(e);
  }
  redirect(`/studio/series/${id}`);
}

export async function updateSeriesAction(_: ActionState, f: FormData): Promise<ActionState> {
  try {
    await withTx(async (tx) => studio.updateSeries(tx, await currentActor(), str(f, "id"), num(f, "version"), seriesInput(f)));
  } catch (e) {
    return toActionState(e);
  }
  refreshPublic();
  return { ok: true, message: "Saved." };
}

export async function setSeriesStatusAction(_: ActionState, f: FormData): Promise<ActionState> {
  try {
    await withTx(async (tx) => studio.setSeriesStatus(tx, await currentActor(), str(f, "id"), str(f, "status") as "draft" | "published"));
  } catch (e) {
    return toActionState(e);
  }
  refreshPublic();
  return { ok: true, message: str(f, "status") === "published" ? "Series is live." : "Series is hidden from readers." };
}

export async function deleteSeriesAction(_: ActionState, f: FormData): Promise<ActionState> {
  try {
    await withTx(async (tx) => studio.deleteSeries(tx, await currentActor(), str(f, "id"), str(f, "confirmTitle")));
  } catch (e) {
    return toActionState(e);
  }
  refreshPublic();
  redirect("/studio");
}

export async function createVolumeAction(_: ActionState, f: FormData): Promise<ActionState> {
  let id: string;
  try {
    id = await withTx(async (tx) => studio.createVolume(tx, await currentActor(), str(f, "seriesId"), { format: str(f, "format"), title: str(f, "title"), description: str(f, "description"), position: str(f, "position") || 0 }));
  } catch (e) {
    return toActionState(e);
  }
  redirect(`/studio/volumes/${id}`);
}

export async function updateVolumeAction(_: ActionState, f: FormData): Promise<ActionState> {
  try {
    await withTx(async (tx) => studio.updateVolume(tx, await currentActor(), str(f, "id"), { title: str(f, "title"), description: str(f, "description"), position: str(f, "position") || 0 }));
  } catch (e) {
    return toActionState(e);
  }
  refreshPublic();
  return { ok: true, message: "Saved." };
}

export async function deleteVolumeAction(_: ActionState, f: FormData): Promise<ActionState> {
  let seriesId: string;
  try {
    seriesId = await withTx(async (tx) => studio.deleteVolume(tx, await currentActor(), str(f, "id")));
  } catch (e) {
    return toActionState(e);
  }
  redirect(`/studio/series/${seriesId}`);
}

export async function createReleaseAction(_: ActionState, f: FormData): Promise<ActionState> {
  let id: string;
  try {
    id = (await withTx(async (tx) => studio.createRelease(tx, await currentActor(), str(f, "volumeId"), releaseInput(f))))!;
  } catch (e) {
    return toActionState(e);
  }
  redirect(`/studio/releases/${id}`);
}

export async function updateReleaseAction(_: ActionState, f: FormData): Promise<ActionState> {
  try {
    await withTx(async (tx) => studio.updateRelease(tx, await currentActor(), str(f, "id"), num(f, "version"), releaseInput(f)));
  } catch (e) {
    return toActionState(e);
  }
  refreshPublic();
  return { ok: true, message: "Saved." };
}

export async function setVideoAction(_: ActionState, f: FormData): Promise<ActionState> {
  try {
    await withTx(async (tx) => studio.setVideo(tx, await currentActor(), str(f, "id"), num(f, "version"), { videoUrl: str(f, "videoUrl"), durationSeconds: str(f, "durationSeconds") }));
  } catch (e) {
    return toActionState(e);
  }
  refreshPublic();
  return { ok: true, message: "Video saved." };
}

export async function publishReleaseAction(_: ActionState, f: FormData): Promise<ActionState> {
  try {
    const when = str(f, "mode") === "schedule" ? str(f, "publishAt") : null;
    if (str(f, "mode") === "schedule" && !when) return { error: "Pick a date and time to schedule." };
    // datetime-local has no zone; the browser sends its offset alongside.
    const iso = when ? new Date(`${when}${str(f, "tz") || "Z"}`).toISOString() : null;
    const r = await withTx(async (tx) => studio.publishRelease(tx, await currentActor(), str(f, "id"), iso));
    refreshPublic();
    const note = r.seriesPublished ? "" : " Readers won't see it until the series itself is published.";
    return { ok: true, message: (iso ? "Scheduled." : "Published.") + note };
  } catch (e) {
    return toActionState(e);
  }
}

export async function unpublishReleaseAction(_: ActionState, f: FormData): Promise<ActionState> {
  try {
    await withTx(async (tx) => studio.unpublishRelease(tx, await currentActor(), str(f, "id")));
  } catch (e) {
    return toActionState(e);
  }
  refreshPublic();
  return { ok: true, message: "Unpublished. It's a draft again." };
}

export async function deleteReleaseAction(_: ActionState, f: FormData): Promise<ActionState> {
  let volumeId: string;
  try {
    volumeId = await withTx(async (tx) => studio.deleteRelease(tx, await currentActor(), str(f, "id")));
  } catch (e) {
    return toActionState(e);
  }
  redirect(`/studio/volumes/${volumeId}`);
}

/** Called by the uploader after files reach storage. */
export async function addPagesAction(releaseId: string, pages: { url: string; width: number | null; height: number | null }[]): Promise<ActionState> {
  try {
    const added = await withTx(async (tx) => studio.addPages(tx, await currentActor(), releaseId, pages));
    revalidatePath(`/studio/releases/${releaseId}`);
    refreshPublic();
    return { ok: true, message: `Added ${added} page${added === 1 ? "" : "s"}.` };
  } catch (e) {
    return toActionState(e);
  }
}

export async function reorderPagesAction(releaseId: string, ids: string[]): Promise<ActionState> {
  try {
    await withTx(async (tx) => studio.reorderPages(tx, await currentActor(), releaseId, ids));
    revalidatePath(`/studio/releases/${releaseId}`);
    refreshPublic();
    return { ok: true, message: "Page order saved." };
  } catch (e) {
    return toActionState(e);
  }
}

export async function deletePageAction(pageId: string): Promise<ActionState> {
  try {
    const rel = await withTx(async (tx) => studio.deletePage(tx, await currentActor(), pageId));
    revalidatePath(`/studio/releases/${rel}`);
    refreshPublic();
    return { ok: true, message: "Page removed." };
  } catch (e) {
    return toActionState(e);
  }
}

export async function setPageAltAction(pageId: string, alt: string): Promise<ActionState> {
  try {
    const rel = await studio.setPageAlt(db, await currentActor(), pageId, alt);
    revalidatePath(`/studio/releases/${rel}`);
    return { ok: true, message: "Description saved." };
  } catch (e) {
    return toActionState(e);
  }
}
