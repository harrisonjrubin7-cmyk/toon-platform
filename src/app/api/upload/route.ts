import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { currentActor } from "@/lib/auth/session";
import { permissions } from "@/lib/roles";
import { ALLOWED_UPLOAD_TYPES, LOCAL_MEDIA_DIR, MAX_IMAGE_BYTES, MAX_VIDEO_BYTES, storageMode } from "@/lib/storage";

const json = (body: unknown, status = 200) => Response.json(body, { status });

export async function POST(request: Request) {
  const actor = await currentActor();
  if (!permissions.manageContent(actor)) return json({ error: "Only studio editors can upload." }, 403);

  if (storageMode() === "blob") {
    try {
      const body = (await request.json()) as HandleUploadBody;
      const result = await handleUpload({
        request,
        body,
        onBeforeGenerateToken: async (pathname, clientPayload) => {
          if (!permissions.manageContent(actor)) throw new Error("Not allowed");
          const kind = clientPayload === "video" ? "video" : "image";
          if (!pathname.startsWith("studio/")) throw new Error("Bad path");
          return {
            allowedContentTypes: ALLOWED_UPLOAD_TYPES[kind],
            maximumSizeInBytes: kind === "video" ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES,
            addRandomSuffix: true,
          };
        },
      });
      return json(result);
    } catch (e) {
      return json({ error: (e as Error).message }, 400);
    }
  }

  // Local disk storage, for development and tests only.
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_LOCAL_MEDIA !== "1") {
    return json({ error: "File storage is not configured. Set BLOB_READ_WRITE_TOKEN." }, 503);
  }
  const form = await request.formData();
  const file = form.get("file");
  const kind = form.get("kind") === "video" ? "video" : "image";
  if (!(file instanceof File)) return json({ error: "No file received." }, 400);
  if (!ALLOWED_UPLOAD_TYPES[kind].includes(file.type)) return json({ error: `That file type (${file.type || "unknown"}) isn't supported.` }, 415);
  if (file.size > (kind === "video" ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES)) return json({ error: "That file is too large." }, 413);
  const ext = (file.name.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "bin";
  const rel = `studio/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${ext}`;
  const full = path.join(/*turbopackIgnore: true*/ process.cwd(), LOCAL_MEDIA_DIR, rel);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, Buffer.from(await file.arrayBuffer()));
  return json({ url: `/media/${rel}` });
}
