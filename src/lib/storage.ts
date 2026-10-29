import "server-only";
/** Where uploads go: Vercel Blob when BLOB_READ_WRITE_TOKEN is set, otherwise local disk (development only). */
export type StorageMode = "blob" | "local";

export function storageMode(): StorageMode {
  if (process.env.BLOB_READ_WRITE_TOKEN) return "blob";
  return "local";
}

export const LOCAL_MEDIA_DIR = process.env.LOCAL_MEDIA_DIR ?? ".data/media";

export const ALLOWED_UPLOAD_TYPES = {
  image: ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"],
  video: ["video/mp4", "video/webm", "video/quicktime"],
};
export const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 2 * 1024 * 1024 * 1024;
