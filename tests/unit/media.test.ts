import { describe, expect, it } from "vitest";
import { isStoredMediaUrl, videoSource } from "@/lib/media";

describe("media rules", () => {
  it("accepts only our own storage for uploads", () => {
    expect(isStoredMediaUrl("/media/a/b.png")).toBe(true);
    expect(isStoredMediaUrl("/media/../etc/passwd")).toBe(false);
    expect(isStoredMediaUrl("https://abc123.public.blob.vercel-storage.com/x.png")).toBe(true);
    expect(isStoredMediaUrl("http://abc123.public.blob.vercel-storage.com/x.png")).toBe(false);
    expect(isStoredMediaUrl("https://evil.com/x.png")).toBe(false);
    expect(isStoredMediaUrl("javascript:alert(1)")).toBe(false);
  });
  it("maps video links to players", () => {
    expect(videoSource("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toMatchObject({ kind: "embed", provider: "youtube" });
    expect(videoSource("https://youtu.be/dQw4w9WgXcQ")?.src).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(videoSource("https://vimeo.com/123456")).toMatchObject({ kind: "embed", provider: "vimeo" });
    expect(videoSource("/media/ep1.mp4")).toMatchObject({ kind: "file" });
    expect(videoSource("https://example.com/x.mp4")).toBeNull();
    expect(videoSource("http://youtu.be/dQw4w9WgXcQ")).toBeNull();
  });
});
