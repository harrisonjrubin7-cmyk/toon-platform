import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { db } from "@/lib/db";
import { currentActor } from "@/lib/auth/session";
import { isAppError } from "@/lib/errors";
import { requireMember } from "@/lib/domain/community/shared";
import { COMMUNITY_DAILY_UPLOADS, COMMUNITY_IMAGE_TYPES, COMMUNITY_MAX_IMAGE_BYTES, communityPrefix, sniffImage } from "@/lib/community-media";
import { LOCAL_MEDIA_DIR, storageMode } from "@/lib/storage";

const json = (body: unknown, status = 200) => Response.json(body, { status });

/**
 * Image uploads for community members (comic panels, covers, avatars). Separate from the
 * studio's editor-only upload: images only, 10 MB, a daily cap, and each member's files
 * live under their own folder so panels can only use art its author uploaded.
 */
export async function POST(request: Request) {
  const actor = await currentActor();
  // Profile setup needs an avatar upload before the profile exists, so only require sign-in there.
  const purpose = new URL(request.url).searchParams.get("purpose");
  try {
    if (!actor) return json({ error: "Sign in to upload." }, 401);
    if (purpose !== "avatar") await requireMember(db, actor, "upload");
  } catch (e) {
    return json({ error: isAppError(e) ? e.message : "Not allowed." }, 403);
  }
  const { rows } = await db.query("select count(*) n from community_uploads where user_id = $1 and created_at > now() - interval '1 day'", [actor.id]);
  if (Number(rows[0].n) >= COMMUNITY_DAILY_UPLOADS) return json({ error: `You've uploaded ${COMMUNITY_DAILY_UPLOADS} images today. Try again tomorrow.` }, 429);
  const prefix = communityPrefix(actor.id);

  if (storageMode() === "blob") {
    try {
      const body = (await request.json()) as HandleUploadBody;
      const result = await handleUpload({
        request,
        body,
        onBeforeGenerateToken: async (pathname) => {
          if (!pathname.startsWith(prefix) || pathname.includes("..")) throw new Error("Bad path");
          await db.query("insert into community_uploads (user_id, pathname) values ($1,$2)", [actor.id, pathname]);
          return { allowedContentTypes: COMMUNITY_IMAGE_TYPES, maximumSizeInBytes: COMMUNITY_MAX_IMAGE_BYTES, addRandomSuffix: true };
        },
      });
      return json(result);
    } catch (e) {
      return json({ error: (e as Error).message }, 400);
    }
  }

  if (process.env.NODE_ENV === "production" && process.env.ALLOW_LOCAL_MEDIA !== "1") {
    return json({ error: "File storage is not configured. Set BLOB_READ_WRITE_TOKEN." }, 503);
  }
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return json({ error: "No file received." }, 400);
  if (file.size > COMMUNITY_MAX_IMAGE_BYTES) return json({ error: "That image is over 10 MB." }, 413);
  const buf = Buffer.from(await file.arrayBuffer());
  const type = sniffImage(buf.subarray(0, 16));
  if (!type) return json({ error: "Use a JPEG, PNG, WebP or GIF image." }, 415);
  const ext = { "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif", "image/webp": "webp" }[type]!;
  const rel = `${prefix}${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${ext}`;
  const full = path.join(/*turbopackIgnore: true*/ process.cwd(), LOCAL_MEDIA_DIR, rel);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, buf);
  await db.query("insert into community_uploads (user_id, pathname) values ($1,$2)", [actor.id, rel]);
  return json({ url: `/media/${rel}` });
}
