"use client";
import { upload } from "@vercel/blob/client";
import type { StorageMode } from "../upload";

const safeName = (n: string) => n.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-+|-+$/g, "").slice(-60) || "image";

/** Uploads one image to the member's own community folder and returns its URL. */
export async function uploadCommunityImage(file: File, userId: string, mode: StorageMode, purpose: "panel" | "avatar" = "panel", onProgress?: (pct: number) => void): Promise<string> {
  if (file.size > 10 * 1024 * 1024) throw new Error("That image is over 10 MB.");
  const endpoint = `/api/community/upload${purpose === "avatar" ? "?purpose=avatar" : ""}`;
  if (mode === "blob") {
    const res = await upload(`community/${userId}/${safeName(file.name)}`, file, {
      access: "public", handleUploadUrl: endpoint, onUploadProgress: (p) => onProgress?.(p.percentage),
    });
    return res.url;
  }
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(endpoint, { method: "POST", body: fd });
  let body: { url?: string; error?: string } = {};
  try { body = await res.json(); } catch {}
  if (!res.ok || !body.url) throw new Error(body.error ?? `Upload failed (${res.status}).`);
  onProgress?.(100);
  return body.url;
}
