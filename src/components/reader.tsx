"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { sendProgress } from "./progress";

function readStoredMode(): "page" | "scroll" {
  try {
    return localStorage.getItem("toon-reader-mode") === "scroll" ? "scroll" : "page";
  } catch {
    return "page";
  }
}

type Page = { id: string; imageUrl: string; width: number | null; height: number | null; alt: string };

export function ComicReader({ releaseId, title, pages, startAt, signedIn, nextId, prevId }: {
  releaseId: string; title: string; pages: Page[]; startAt: number; signedIn: boolean; nextId: string | null; prevId: string | null;
}) {
  const stored = useSyncExternalStore(() => () => {}, readStoredMode, () => "page" as const);
  const [override, setMode] = useState<"page" | "scroll" | null>(null);
  const mode = override ?? stored;
  const [i, setI] = useState(Math.min(Math.max(0, startAt), Math.max(0, pages.length - 1)));
  const stageRef = useRef<HTMLDivElement>(null);
  const last = pages.length - 1;

  const go = useCallback((n: number) => setI((cur) => Math.min(last, Math.max(0, n === Infinity ? cur + 1 : n === -Infinity ? cur - 1 : n))), [last]);

  // Save progress (debounced) whenever the page changes.
  useEffect(() => {
    const t = setTimeout(() => sendProgress(releaseId, i, i >= last, signedIn), 600);
    return () => clearTimeout(t);
  }, [i, last, releaseId, signedIn]);

  useEffect(() => {
    if (mode !== "page") return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") { e.preventDefault(); go(Infinity); }
      if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); go(-Infinity); }
      if (e.key === "Home") go(0);
      if (e.key === "End") go(last);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, go, last]);

  // In scroll mode, track the page in view.
  useEffect(() => {
    if (mode !== "scroll" || !stageRef.current) return;
    const imgs = Array.from(stageRef.current.querySelectorAll("img[data-index]"));
    const io = new IntersectionObserver((entries) => {
      for (const en of entries) if (en.isIntersecting) setI(Number((en.target as HTMLElement).dataset.index));
    }, { threshold: 0.5 });
    imgs.forEach((im) => io.observe(im));
    imgs[i]?.scrollIntoView({ block: "start" });
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const switchMode = (m: "page" | "scroll") => {
    setMode(m);
    try { localStorage.setItem("toon-reader-mode", m); } catch {}
  };

  if (pages.length === 0) return <div className="empty">This issue has no pages yet.</div>;
  const p = pages[i];
  const alt = (pg: Page, n: number) => pg.alt || `${title}, page ${n + 1} of ${pages.length}`;

  return (
    <div>
      <div className="reader-bar">
        <div className="spread">
          <div className="row" role="group" aria-label="Reading mode">
            <button className={`tn-btn sm ${mode === "page" ? "tn-btn--primary" : ""}`} aria-pressed={mode === "page"} onClick={() => switchMode("page")}>Page by page</button>
            <button className={`tn-btn sm ${mode === "scroll" ? "tn-btn--primary" : ""}`} aria-pressed={mode === "scroll"} onClick={() => switchMode("scroll")}>Scroll</button>
          </div>
          <span className="tn-supporting" aria-live="polite">Page {i + 1} of {pages.length}</span>
          {mode === "page" && (
            <div className="row">
              <button className="tn-btn sm" onClick={() => go(-Infinity)} disabled={i === 0}>← Back</button>
              <button className="tn-btn sm tn-btn--primary" onClick={() => go(Infinity)} disabled={i === last}>Next →</button>
            </div>
          )}
        </div>
      </div>

      {mode === "page" ? (
        <div className="reader-stage">
          <div className="page-tap">
            <img key={p.id} src={p.imageUrl} alt={alt(p, i)} className="reader-page" width={p.width ?? undefined} height={p.height ?? undefined} />
            <button type="button" className="zone prev" aria-label="Previous page" tabIndex={-1} onClick={() => go(-Infinity)} />
            <button type="button" className="zone next" aria-label="Next page" tabIndex={-1} onClick={() => go(Infinity)} />
          </div>
          {pages[i + 1] && <link rel="preload" as="image" href={pages[i + 1].imageUrl} />}
          <p className="tn-supporting muted" style={{ marginTop: 8 }}>Use the arrow keys, or tap the left or right side of the page.</p>
        </div>
      ) : (
        <div className="reader-scroll" ref={stageRef}>
          {pages.map((pg, n) => (
            <img key={pg.id} data-index={n} src={pg.imageUrl} alt={alt(pg, n)} loading={n < 3 ? "eager" : "lazy"} width={pg.width ?? undefined} height={pg.height ?? undefined} />
          ))}
        </div>
      )}

      {(i === last || mode === "scroll") && (
        <div className="card spread" style={{ marginTop: 24 }}>
          <span className="tn-body-strong">{i === last ? "End of issue." : "Keep going."}</span>
          <div className="row">
            {prevId && <Link className="tn-btn" href={`/read/${prevId}`}>Previous issue</Link>}
            {nextId ? <Link className="tn-btn tn-btn--primary" href={`/read/${nextId}`}>Next issue →</Link> : <span className="muted">You&apos;re caught up.</span>}
          </div>
        </div>
      )}
    </div>
  );
}
