"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { currentActor } from "@/lib/auth/session";
import { setFollow } from "@/lib/domain/catalog";

export async function followAction(form: FormData) {
  const actor = await currentActor();
  const slug = String(form.get("slug") ?? "");
  if (!actor) redirect(`/login?next=${encodeURIComponent(`/series/${slug}`)}`);
  await setFollow(db, actor, String(form.get("seriesId")), form.get("follow") === "1");
  revalidatePath(`/series/${slug}`);
  revalidatePath("/library");
}
