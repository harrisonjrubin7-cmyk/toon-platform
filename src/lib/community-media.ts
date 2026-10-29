/** Rules for images community members upload. Kept apart from the studio's upload rules. */

const BLOB_HOST = /^[a-z0-9-]+\.public\.blob\.vercel-storage\.com$/i;

export const COMMUNITY_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const COMMUNITY_MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const COMMUNITY_DAILY_UPLOADS = 300;

/** Storage folder for one member's uploads. */
export const communityPrefix = (userId: string) => `community/${userId}/`;

/**
 * True when the URL is an image this member uploaded to community storage. Panels and
 * avatars may only use these, so nobody can hot-link other sites or someone else's art.
 */
export function isOwnCommunityImage(raw: string, userId: string): boolean {
  if (!/^[0-9a-f-]{36}$/.test(userId)) return false;
  const prefix = communityPrefix(userId);
  if (raw.startsWith("/media/")) return !raw.includes("..") && raw.startsWith(`/media/${prefix}`);
  try {
    const u = new URL(raw);
    return u.protocol === "https:" && BLOB_HOST.test(u.hostname) && u.pathname.startsWith(`/${prefix}`) && !u.pathname.includes("..");
  } catch {
    return false;
  }
}

/** Checks the file's first bytes really are a supported image, whatever its name or stated type says. */
export function sniffImage(head: Uint8Array): string | null {
  const b = head;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return "image/gif";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  return null;
}
