"use client";
import { upload } from "@vercel/blob/client";

export type UploadKind = "image" | "video";
export type StorageMode = "blob" | "local";

const safeName = (n: string) => n.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-+|-+$/g, "").slice(-80) || "file";

/** Uploads one file to studio storage and returns its public URL. */
export async function uploadFile(file: File, kind: UploadKind, mode: StorageMode, onProgress?: (pct: number) => void): Promise<string> {
  if (mode === "blob") {
    const res = await upload(`studio/${kind}s/${safeName(file.name)}`, file, {
      access: "public",
      handleUploadUrl: "/api/upload",
      clientPayload: kind,
      multipart: file.size > 50 * 1024 * 1024,
      onUploadProgress: (p) => onProgress?.(p.percentage),
    });
    return res.url;
  }
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const fd = new FormData();
    fd.append("file", file);
    fd.append("kind", kind);
    xhr.open("POST", "/api/upload");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      try {
        const body = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && body.url) resolve(body.url);
        else reject(new Error(body.error ?? `Upload failed (${xhr.status}).`));
      } catch {
        reject(new Error(`Upload failed (${xhr.status}).`));
      }
    };
    xhr.onerror = () => reject(new Error("Network error. Check your connection and try again."));
    xhr.send(fd);
  });
}

export async function imageSize(file: File): Promise<{ width: number | null; height: number | null }> {
  try {
    const bmp = await createImageBitmap(file);
    const s = { width: bmp.width, height: bmp.height };
    bmp.close();
    return s;
  } catch {
    return { width: null, height: null };
  }
}
