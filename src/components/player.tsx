"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { sendProgress } from "./progress";
import type { VideoSource } from "@/lib/media";

export function EpisodePlayer({ releaseId, title, source, startAt, signedIn, nextId }: {
  releaseId: string; title: string; source: VideoSource; startAt: number; signedIn: boolean; nextId: string | null;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const lastSaved = useRef(0);

  useEffect(() => {
    if (source.kind === "embed") sendProgress(releaseId, 0, false, signedIn); // we can't see inside embeds; mark started
  }, [source.kind, releaseId, signedIn]);

  const save = (completed = false) => {
    const v = ref.current;
    if (!v) return;
    const pos = Math.floor(v.currentTime);
    const done = completed || (v.duration > 0 && v.currentTime / v.duration > 0.92);
    sendProgress(releaseId, pos, done, signedIn);
    lastSaved.current = pos;
  };

  return (
    <div className="stack">
      <div className="player">
        {source.kind === "file" ? (
          <video
            ref={ref}
            src={source.src}
            controls
            playsInline
            preload="metadata"
            aria-label={title}
            onLoadedMetadata={(e) => { if (startAt > 5 && startAt < e.currentTarget.duration - 10) e.currentTarget.currentTime = startAt; }}
            onTimeUpdate={(e) => { if (Math.abs(e.currentTarget.currentTime - lastSaved.current) >= 10) save(); }}
            onPause={() => save()}
            onEnded={() => save(true)}
          />
        ) : (
          <iframe src={source.src} title={title} allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
        )}
      </div>
      {nextId && <div className="row"><Link className="tn-btn tn-btn--primary" href={`/watch/${nextId}`}>Next episode →</Link></div>}
    </div>
  );
}
