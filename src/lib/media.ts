/** Rules for which media URLs the platform will store and how to play them. */

const BLOB_HOST = /^[a-z0-9-]+\.public\.blob\.vercel-storage\.com$/i;

export function isStoredMediaUrl(raw: string): boolean {
  if (raw.startsWith("/media/") && !raw.includes("..")) return true;
  try {
    const u = new URL(raw);
    return u.protocol === "https:" && BLOB_HOST.test(u.hostname);
  } catch {
    return false;
  }
}

/** Images the studio may reference: its own uploads, or the bundled brand logos. */
export function isImageRef(raw: string): boolean {
  return isStoredMediaUrl(raw) || /^\/brand\/logos\/[a-z0-9-]+\.svg$/.test(raw);
}

export type VideoSource = { kind: "file"; src: string } | { kind: "embed"; src: string; provider: "youtube" | "vimeo" };

export function videoSource(raw: string | null | undefined): VideoSource | null {
  if (!raw) return null;
  if (isStoredMediaUrl(raw)) return { kind: "file", src: raw };
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  const host = u.hostname.replace(/^www\./, "");
  if (host === "youtube.com" || host === "m.youtube.com") {
    const id = u.searchParams.get("v");
    if (id && /^[\w-]{6,20}$/.test(id)) return { kind: "embed", provider: "youtube", src: `https://www.youtube-nocookie.com/embed/${id}` };
  }
  if (host === "youtu.be") {
    const id = u.pathname.slice(1);
    if (/^[\w-]{6,20}$/.test(id)) return { kind: "embed", provider: "youtube", src: `https://www.youtube-nocookie.com/embed/${id}` };
  }
  if (host === "vimeo.com") {
    const id = u.pathname.split("/").filter(Boolean)[0];
    if (id && /^\d+$/.test(id)) return { kind: "embed", provider: "vimeo", src: `https://player.vimeo.com/video/${id}` };
  }
  return null;
}
