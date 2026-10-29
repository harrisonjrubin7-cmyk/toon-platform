"use client";
/* eslint-disable @next/next/no-img-element */
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type { ActionState } from "@/lib/errors";
import { addPagesAction, deletePageAction, reorderPagesAction, setPageAltAction } from "@/app/actions/studio";
import { FormAlert } from "./forms";
import { imageSize, uploadFile, type StorageMode } from "./upload";

type Page = { id: string; position: number; imageUrl: string; alt: string };
type Item = { name: string; pct: number; error?: string };

const byName = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

export function PageManager({ releaseId, pages: initial, mode }: { releaseId: string; pages: Page[]; mode: StorageMode }) {
  const router = useRouter();
  const [pages, setPages] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [queue, setQueue] = useState<Item[]>([]);
  const [state, setState] = useState<ActionState>();
  const [over, setOver] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => { setPages(initial); setDirty(false); }, [initial]);

  async function handleFiles(list: FileList | File[]) {
    const files = Array.from(list).filter((f) => f.type.startsWith("image/")).sort((a, b) => byName.compare(a.name, b.name));
    if (!files.length) return setState({ error: "Choose image files (JPG, PNG, WebP)." });
    setState(undefined);
    setQueue(files.map((f) => ({ name: f.name, pct: 0 })));
    const done: { url: string; width: number | null; height: number | null }[] = [];
    // Upload 3 at a time, keep the original order for the page list.
    const results: ({ url: string; width: number | null; height: number | null } | null)[] = new Array(files.length).fill(null);
    let next = 0;
    async function worker() {
      while (next < files.length) {
        const idx = next++;
        const f = files[idx];
        try {
          const [url, size] = await Promise.all([
            uploadFile(f, "image", mode, (pct) => setQueue((q) => q.map((it, i) => (i === idx ? { ...it, pct } : it)))),
            imageSize(f),
          ]);
          results[idx] = { url, ...size };
          setQueue((q) => q.map((it, i) => (i === idx ? { ...it, pct: 100 } : it)));
        } catch (e) {
          setQueue((q) => q.map((it, i) => (i === idx ? { ...it, error: (e as Error).message } : it)));
        }
      }
    }
    await Promise.all([worker(), worker(), worker()]);
    for (const r of results) if (r) done.push(r);
    if (!done.length) return setState({ error: "No pages were uploaded." });
    const res = await addPagesAction(releaseId, done);
    setState(res);
    if (!res?.error) {
      setQueue((q) => q.filter((it) => it.error));
      router.refresh();
    }
  }

  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= pages.length) return;
    const copy = [...pages];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    setPages(copy);
    setDirty(true);
  };

  return (
    <section className="card stack" aria-labelledby="pages-h">
      <div className="spread">
        <h2 id="pages-h" className="tn-h3" style={{ margin: 0 }}>Pages ({pages.length})</h2>
        {dirty && (
          <div className="row">
            <button className="tn-btn sm" onClick={() => { setPages(initial); setDirty(false); }} disabled={pending}>Undo</button>
            <button className="tn-btn tn-btn--primary sm" disabled={pending} onClick={() => start(async () => {
              const r = await reorderPagesAction(releaseId, pages.map((p) => p.id));
              setState(r);
              if (!r?.error) { setDirty(false); router.refresh(); }
            })}>{pending ? "Saving…" : "Save page order"}</button>
          </div>
        )}
      </div>
      <FormAlert state={state} />

      <div
        className={`dropzone ${over ? "over" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); handleFiles(e.dataTransfer.files); }}
      >
        <p className="tn-body-strong" style={{ margin: 0 }}>Drop page images here</p>
        <p className="tn-supporting muted">They&apos;re added in file-name order (page-01, page-02, …) after the existing pages.</p>
        <label className="tn-btn sm" style={{ marginTop: 8 }}>
          Choose files
          <input type="file" accept="image/png,image/jpeg,image/webp,image/avif,image/gif" multiple className="visually-hidden" onChange={(e) => e.target.files && handleFiles(e.target.files)} />
        </label>
      </div>

      {queue.length > 0 && (
        <ul className="list" aria-label="Uploads">
          {queue.map((q, i) => (
            <li key={i} className="list-item">
              <span className="tn-supporting">{q.name}</span>
              {q.error ? <span className="tn-supporting" style={{ color: "var(--scar)" }} role="alert">{q.error}</span> : <progress max={100} value={q.pct} style={{ maxWidth: 200 }} aria-label={`${q.name} upload`} />}
            </li>
          ))}
        </ul>
      )}

      {pages.length === 0 ? (
        <div className="empty">No pages yet.</div>
      ) : (
        <ol className="page-thumbs">
          {pages.map((p, i) => (
            <li key={p.id} className="page-thumb">
              <img src={p.imageUrl} alt={p.alt || `Page ${i + 1}`} loading="lazy" />
              <span className="tn-eyebrow">Page {i + 1}</span>
              <div className="row">
                <button className="tn-btn sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move page ${i + 1} earlier`}>←</button>
                <button className="tn-btn sm" onClick={() => move(i, 1)} disabled={i === pages.length - 1} aria-label={`Move page ${i + 1} later`}>→</button>
                <button className="tn-btn tn-btn--danger sm" disabled={dirty || pending} aria-label={`Delete page ${i + 1}`} onClick={() => {
                  if (!confirm(`Delete page ${i + 1}?`)) return;
                  start(async () => { const r = await deletePageAction(p.id); setState(r); router.refresh(); });
                }}>✕</button>
              </div>
              <AltEditor pageId={p.id} alt={p.alt} n={i + 1} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function AltEditor({ pageId, alt, n }: { pageId: string; alt: string; n: number }) {
  const [v, setV] = useState(alt);
  const [saved, setSaved] = useState<string | null>(null);
  return (
    <details>
      <summary className="tn-supporting">Description{alt ? " ✓" : ""}</summary>
      <label className="visually-hidden" htmlFor={`alt-${pageId}`}>Text description of page {n}</label>
      <textarea id={`alt-${pageId}`} className="tn-field__input" style={{ minHeight: 70, fontSize: 13 }} value={v} onChange={(e) => setV(e.target.value)} placeholder="What happens on this page, for screen reader users" />
      <button className="tn-btn sm" style={{ marginTop: 4 }} onClick={async () => { const r = await setPageAltAction(pageId, v); setSaved(r?.error ?? "Saved"); }}>Save</button>
      {saved && <span className="tn-supporting" role="status"> {saved}</span>}
    </details>
  );
}
