import { open, stat } from "node:fs/promises";
import path from "node:path";
import { LOCAL_MEDIA_DIR } from "@/lib/storage";

const TYPES: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", avif: "image/avif", gif: "image/gif",
  mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime",
};

/** Serves locally stored uploads (development). Supports byte ranges so video can seek. */
export async function GET(request: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const parts = (await ctx.params).path;
  if (parts.some((p) => p === ".." || p.includes("/") || p.includes("\\"))) return new Response("Not found", { status: 404 });
  const root = path.resolve(/*turbopackIgnore: true*/ process.cwd(), LOCAL_MEDIA_DIR);
  const full = path.resolve(/*turbopackIgnore: true*/ root, ...parts);
  if (!full.startsWith(root + path.sep)) return new Response("Not found", { status: 404 });
  let size: number;
  try {
    size = (await stat(full)).size;
  } catch {
    return new Response("Not found", { status: 404 });
  }
  const type = TYPES[full.split(".").pop()!.toLowerCase()] ?? "application/octet-stream";
  const range = request.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/);
  let start = 0, end = size - 1, status = 200;
  if (range && (range[1] || range[2])) {
    start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start > end || start >= size) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    status = 206;
  }
  const fh = await open(full, "r");
  const buf = Buffer.alloc(end - start + 1);
  await fh.read(buf, 0, buf.length, start);
  await fh.close();
  const headers: Record<string, string> = {
    "Content-Type": type, "Content-Length": String(buf.length), "Accept-Ranges": "bytes", "Cache-Control": "public, max-age=31536000, immutable",
  };
  if (status === 206) headers["Content-Range"] = `bytes ${start}-${end}/${size}`;
  return new Response(buf, { status, headers });
}
