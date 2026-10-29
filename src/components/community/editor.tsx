"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LAYOUT_KEYS, LAYOUTS, LETTER_KINDS, LIMITS, emptyPanel, relayout, spansRow, type FanPage, type LayoutKey, type LetterKind, type Panel } from "@/lib/comic-layouts";
import type { EditableComic } from "@/lib/domain/community/comics";
import { saveComicAction } from "@/app/actions/community";
import type { StorageMode } from "../upload";
import { uploadCommunityImage } from "./upload";
import { FanComicPages } from "./comic-view";
import "./community.css";

type SeriesOption = { id: string; title: string };

export function ComicEditor({ comic, userId, mode, series, allowFanWorks }: { comic: EditableComic; userId: string; mode: StorageMode; series: SeriesOption[]; allowFanWorks: boolean }) {
  const router = useRouter();
  const [meta, setMeta] = useState({ title: comic.title, summary: comic.summary, rating: comic.rating, contentNotes: comic.contentNotes, spinoffOf: comic.spinoffOf ?? "", coverUrl: comic.coverUrl ?? "" });
  const [pages, setPages] = useState<FanPage[]>(comic.pages);
  const [version, setVersion] = useState(comic.version);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string; conflict?: boolean } | null>(null);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(0);
  const [saving, startSave] = useTransition();

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const touch = () => { setDirty(true); setStatus(null); };
  const setMetaField = (k: keyof typeof meta, v: string) => { setMeta((m) => ({ ...m, [k]: v })); touch(); };
  const updatePage = (i: number, fn: (p: FanPage) => FanPage) => { setPages((ps) => ps.map((p, n) => (n === i ? fn(p) : p))); touch(); };
  const updatePanel = (i: number, j: number, fn: (p: Panel) => Panel) => updatePage(i, (p) => ({ ...p, panels: p.panels.map((x, n) => (n === j ? fn(x) : x)) }));
  const movePage = (i: number, d: -1 | 1) => { setPages((ps) => { const c = [...ps]; [c[i], c[i + d]] = [c[i + d], c[i]]; return c; }); touch(); };

  async function uploadInto(file: File, apply: (url: string) => void) {
    setBusy((b) => b + 1);
    try {
      apply(await uploadCommunityImage(file, userId, mode));
      touch();
    } catch (e) {
      setStatus({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy((b) => b - 1);
    }
  }

  function save() {
    startSave(async () => {
      const r = await saveComicAction(comic.id, version, { ...meta, pages });
      if (r.ok) {
        setVersion(r.version);
        setDirty(false);
        setStatus({ kind: "ok", text: r.moderation === "pending" && comic.status === "published" ? "Saved. Your changes go to the studio for approval before they show." : "Saved." });
        router.refresh();
      } else {
        setStatus({ kind: "error", text: r.error, conflict: r.conflict });
      }
    });
  }

  return (
    <div className="editor">
      <div className="editor-bar">
        <div className="spread">
          <div className="row">
            <button type="button" className="tn-btn tn-btn--primary" onClick={save} disabled={saving || busy > 0 || !dirty} aria-busy={saving || undefined}>
              {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
            </button>
            {busy > 0 && <span className="tn-supporting muted" role="status">Uploading…</span>}
          </div>
          <button type="button" className="tn-btn sm preview-toggle" aria-pressed={preview} onClick={() => setPreview((p) => !p)}>{preview ? "Back to editing" : "Preview as a reader"}</button>
        </div>
        <div aria-live="polite">
          {status?.kind === "error" && (
            <div className="tn-notice tn-notice--error alert-error" role="alert" style={{ marginTop: 8 }}>
              <span className="tn-notice__title">Not saved</span><span>{status.text}</span>
              {status.conflict && <button type="button" className="tn-btn sm" onClick={() => location.reload()}>Reload</button>}
            </div>
          )}
          {status?.kind === "ok" && <div className="tn-notice tn-notice--success alert-ok" role="status" style={{ marginTop: 8 }}>{status.text}</div>}
        </div>
      </div>

      {preview ? (
        <FanComicPages pages={pages} title={meta.title} />
      ) : (
        <>
          <section className="card stack" aria-labelledby="details-h">
            <h2 id="details-h" className="tn-h3">Details</h2>
            <div className="tn-field">
              <label className="tn-field__label" htmlFor="ed-title">Title *</label>
              <input id="ed-title" className="tn-field__input" value={meta.title} maxLength={120} onChange={(e) => setMetaField("title", e.target.value)} />
            </div>
            <div className="tn-field">
              <label className="tn-field__label" htmlFor="ed-summary">Summary</label>
              <textarea id="ed-summary" className="tn-field__input" value={meta.summary} maxLength={2000} onChange={(e) => setMetaField("summary", e.target.value)} />
            </div>
            <div className="row" style={{ alignItems: "flex-start" }}>
              <div className="tn-field">
                <label className="tn-field__label" htmlFor="ed-rating">Rating *</label>
                <select id="ed-rating" className="tn-field__input" value={meta.rating} onChange={(e) => setMetaField("rating", e.target.value)}>
                  <option value="Mature">Mature (18+)</option>
                  <option value="Teen">Teen (13+, no sex, no graphic gore)</option>
                </select>
              </div>
              <div className="tn-field" style={{ flex: 1 }}>
                <label className="tn-field__label" htmlFor="ed-notes">Content notes</label>
                <input id="ed-notes" className="tn-field__input" value={meta.contentNotes} maxLength={300} placeholder="e.g. car crashes, blood, strong language" onChange={(e) => setMetaField("contentNotes", e.target.value)} />
              </div>
            </div>
            <div className="tn-field">
              <label className="tn-field__label" htmlFor="ed-spinoff">Spinoff of</label>
              <select id="ed-spinoff" className="tn-field__input" value={meta.spinoffOf} onChange={(e) => setMetaField("spinoffOf", e.target.value)} disabled={!allowFanWorks && !meta.spinoffOf}>
                <option value="">An original story (not a spinoff)</option>
                {series.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
              </select>
              <span className="tn-field__hint">{allowFanWorks ? "Spinoffs are fan works, shown as not official canon." : "The studio isn't accepting spinoffs right now."}</span>
            </div>
            <div className="tn-field">
              <span className="tn-field__label">Cover (optional, otherwise the first panel is used)</span>
              <div className="row">
                {meta.coverUrl && <img src={meta.coverUrl} alt="" style={{ width: 72, height: 96, objectFit: "cover", borderRadius: 4 }} />}
                <input type="file" aria-label="Upload a cover" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadInto(f, (u) => setMeta((m) => ({ ...m, coverUrl: u }))); e.target.value = ""; }} />
                {meta.coverUrl && <button type="button" className="tn-btn sm" onClick={() => setMetaField("coverUrl", "")}>Remove cover</button>}
              </div>
            </div>
          </section>

          {pages.map((p, i) => (
            <section key={i} className="editor-page" aria-labelledby={`pg-${i}`}>
              <div className="spread">
                <h2 id={`pg-${i}`} className="tn-h3">Page {i + 1}</h2>
                <div className="row">
                  <label className="visually-hidden" htmlFor={`lay-${i}`}>Layout for page {i + 1}</label>
                  <select id={`lay-${i}`} className="tn-field__input" value={p.layout} onChange={(e) => {
                    const next = e.target.value as LayoutKey;
                    const lost = p.panels.slice(LAYOUTS[next].panels).some((x) => x.imageUrl || x.lettering.length);
                    if (lost && !confirm(`That layout has fewer panels. Panels after ${LAYOUTS[next].panels} will be removed.`)) return;
                    updatePage(i, (pg) => relayout(pg, next));
                  }}>
                    {LAYOUT_KEYS.map((k) => <option key={k} value={k}>{LAYOUTS[k].label}</option>)}
                  </select>
                  <button type="button" className="tn-btn sm" onClick={() => movePage(i, -1)} disabled={i === 0} aria-label={`Move page ${i + 1} earlier`}>↑</button>
                  <button type="button" className="tn-btn sm" onClick={() => movePage(i, 1)} disabled={i === pages.length - 1} aria-label={`Move page ${i + 1} later`}>↓</button>
                  <button type="button" className="tn-btn sm tn-btn--danger" onClick={() => { if (confirm(`Delete page ${i + 1}?`)) { setPages((ps) => ps.filter((_, n) => n !== i)); touch(); } }} aria-label={`Delete page ${i + 1}`}>Delete</button>
                </div>
              </div>
              <div className="editor-panels" data-cols={LAYOUTS[p.layout].cols}>
                {p.panels.map((panel, j) => {
                  const label = `page ${i + 1}, panel ${j + 1}`;
                  return (
                    <div key={j} className={`editor-panel${spansRow(p.layout, j) ? " span-row" : ""}`} role="group" aria-label={`Panel ${j + 1} of page ${i + 1}`}>
                      <span className="tn-body-strong">Panel {j + 1}</span>
                      {panel.imageUrl ? <img src={panel.imageUrl} alt="" /> : <div className="fan-panel__blank">No art yet</div>}
                      <input type="file" aria-label={`Art for ${label}`} accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadInto(f, (u) => updatePanel(i, j, (x) => ({ ...x, imageUrl: u }))); e.target.value = ""; }} />
                      <input className="tn-field__input" aria-label={`Describe ${label} for screen readers`} placeholder="Describe the art (for screen readers)" value={panel.alt} maxLength={LIMITS.alt} onChange={(e) => updatePanel(i, j, (x) => ({ ...x, alt: e.target.value }))} />
                      <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
                        <legend className="tn-supporting muted">Lettering (shown under the panel, never on the art)</legend>
                        {panel.lettering.map((l, k) => (
                          <div key={k} className="letter-row">
                            <select className="tn-field__input" aria-label={`Line ${k + 1} type, ${label}`} value={l.kind} onChange={(e) => updatePanel(i, j, (x) => ({ ...x, lettering: x.lettering.map((y, n) => (n === k ? { ...y, kind: e.target.value as LetterKind } : y)) }))}>
                              {(Object.keys(LETTER_KINDS) as LetterKind[]).map((kk) => <option key={kk} value={kk}>{LETTER_KINDS[kk]}</option>)}
                            </select>
                            <input className="tn-field__input" aria-label={`Line ${k + 1} speaker, ${label}`} placeholder="Speaker" value={l.speaker} maxLength={LIMITS.speaker} disabled={l.kind === "caption" || l.kind === "sfx"} onChange={(e) => updatePanel(i, j, (x) => ({ ...x, lettering: x.lettering.map((y, n) => (n === k ? { ...y, speaker: e.target.value } : y)) }))} />
                            <textarea className="tn-field__input" aria-label={`Line ${k + 1} text, ${label}`} value={l.text} maxLength={LIMITS.text} onChange={(e) => updatePanel(i, j, (x) => ({ ...x, lettering: x.lettering.map((y, n) => (n === k ? { ...y, text: e.target.value } : y)) }))} />
                            <button type="button" className="tn-btn sm" aria-label={`Remove line ${k + 1}, ${label}`} onClick={() => updatePanel(i, j, (x) => ({ ...x, lettering: x.lettering.filter((_, n) => n !== k) }))}>✕</button>
                          </div>
                        ))}
                        {panel.lettering.length < LIMITS.letters && (
                          <button type="button" className="tn-btn sm" onClick={() => updatePanel(i, j, (x) => ({ ...x, lettering: [...x.lettering, { kind: "dialogue", speaker: "", text: "" }] }))}>Add lettering to {label}</button>
                        )}
                      </fieldset>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}

          {pages.length < LIMITS.pages && (
            <div className="row">
              <button type="button" className="tn-btn" onClick={() => { setPages((ps) => [...ps, { layout: "full", panels: [emptyPanel()] }]); touch(); }}>Add a page</button>
              <span className="tn-supporting muted">Start with a full page and switch its layout to split it into panels. Lettering always goes under the art.</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
