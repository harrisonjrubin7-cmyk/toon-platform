"use client";
/* eslint-disable @next/next/no-img-element */
import { useActionState, useRef, useState } from "react";
import type { ActionState } from "@/lib/errors";
import { Field, FormAlert, SubmitButton } from "./forms";
import { uploadFile, type StorageMode } from "./upload";
import * as A from "@/app/actions/studio";

type Action = (s: ActionState, f: FormData) => Promise<ActionState>;

function useForm(action: Action) {
  return useActionState(action, undefined);
}

const RATINGS = ["TV-MA", "R", "Mature", "TV-14", "PG-13", "Teen", "TV-PG", "Unrated"];
const THEMES = [
  { value: "studio", label: "Studio default" },
  { value: "volcano-racers", label: "Volcano Racers (magma and basalt)" },
  { value: "starfall", label: "Starfall (reserved, look not chosen yet)" },
];
const BRAND_LOGOS = [
  { value: "", label: "None" },
  { value: "/brand/logos/volcano-racers-wordmark.svg", label: "Volcano Racers wordmark" },
  { value: "/brand/logos/volcano-racers-roundel.svg", label: "Volcano Racers roundel" },
];

/** Image picker that uploads to studio storage and keeps the URL in a hidden input. */
export function ImageField({ name, label, value, mode, hint, presets }: { name: string; label: string; value: string | null; mode: StorageMode; hint?: string; presets?: { value: string; label: string }[] }) {
  const [url, setUrl] = useState(value ?? "");
  const [pct, setPct] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const id = `img-${name}`;
  return (
    <div className="tn-field">
      <span className="tn-field__label" id={`${id}-l`}>{label}</span>
      <input type="hidden" name={name} value={url} />
      <div className="row" style={{ alignItems: "flex-start" }}>
        {url ? <img src={url} alt="" style={{ width: 96, height: 96, objectFit: "contain", border: "2px solid var(--line)", borderRadius: 6, background: "var(--surface-sunk)" }} /> : <div className="empty small" style={{ width: 96, height: 96, padding: 8 }}>No image</div>}
        <div className="stack" style={{ flex: 1 }}>
          <input id={id} aria-labelledby={`${id}-l`} type="file" accept="image/png,image/jpeg,image/webp,image/avif,image/gif" onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setErr(null); setPct(0);
            try { setUrl(await uploadFile(f, "image", mode, setPct)); } catch (x) { setErr((x as Error).message); } finally { setPct(null); }
          }} />
          {presets && (
            <select aria-label={`${label}: brand artwork`} value={presets.some((p) => p.value === url) ? url : ""} onChange={(e) => setUrl(e.target.value)} className="tn-field__input">
              {presets.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          )}
          {url && <button type="button" className="tn-btn tn-btn--ghost sm" onClick={() => setUrl("")}>Remove image</button>}
          {pct !== null && <progress max={100} value={pct} aria-label="Upload progress" />}
          {err && <span className="tn-field__hint" role="alert" style={{ color: "var(--scar)" }}>{err}</span>}
          {hint && <span className="tn-field__hint">{hint}</span>}
        </div>
      </div>
    </div>
  );
}

type SeriesValues = { id?: string; version?: number; title?: string; slug?: string; tagline?: string; synopsis?: string; rating?: string; coverUrl?: string | null; logoUrl?: string | null; theme?: string; position?: number };

export function SeriesForm({ values = {}, mode }: { values?: SeriesValues; mode: StorageMode }) {
  const editing = !!values.id;
  const [state, action] = useForm(editing ? A.updateSeriesAction : A.createSeriesAction);
  const slugRef = useRef<HTMLInputElement>(null);
  return (
    <form action={action} className="form-grid two card" noValidate>
      <div className="full"><FormAlert state={state} /></div>
      {editing && <><input type="hidden" name="id" value={values.id} /><input type="hidden" name="version" value={values.version} /></>}
      <Field name="title" label="Title" required defaultValue={values.title} state={state} onChange={(e) => {
        if (!editing && slugRef.current && !slugRef.current.dataset.touched) slugRef.current.value = e.currentTarget.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      }} />
      <Field name="slug" label="Web address" required defaultValue={values.slug} state={state} hint="Appears as /series/your-address." ref={slugRef} onInput={(e) => { e.currentTarget.dataset.touched = "1"; }} />
      <Field name="tagline" label="Tagline" defaultValue={values.tagline} state={state} className="full" />
      <Field name="synopsis" label="Synopsis" textarea defaultValue={values.synopsis} state={state} className="full" />
      <Field name="rating" label="Rating" state={state}>
        {(id) => <select id={id} name="rating" className="tn-field__input" defaultValue={values.rating ?? "TV-MA"}>{RATINGS.map((r) => <option key={r}>{r}</option>)}</select>}
      </Field>
      <Field name="theme" label="Look" state={state} hint="Brand colors used on this series' pages.">
        {(id) => <select id={id} name="theme" className="tn-field__input" defaultValue={values.theme ?? "studio"}>{THEMES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select>}
      </Field>
      <ImageField name="logoUrl" label="Series logo" value={values.logoUrl ?? null} mode={mode} presets={BRAND_LOGOS} hint="Shown at the top of the series page." />
      <ImageField name="coverUrl" label="Cover art" value={values.coverUrl ?? null} mode={mode} hint="Portrait, 2:3. Used when an issue has no cover of its own." />
      <Field name="position" label="Sort order" type="number" min={0} defaultValue={values.position ?? 0} state={state} hint="Lower numbers show first." />
      <div className="full row"><SubmitButton pendingText="Saving…">{editing ? "Save changes" : "Create series"}</SubmitButton></div>
    </form>
  );
}

export function StatusToggle({ id, status, noun }: { id: string; status: "draft" | "published"; noun: string }) {
  const [state, action] = useForm(A.setSeriesStatusAction);
  const next = status === "published" ? "draft" : "published";
  return (
    <form action={action} className="stack">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={next} />
      <FormAlert state={state} />
      <SubmitButton className={`tn-btn ${next === "published" ? "tn-btn--primary" : ""}`} pendingText="Saving…">
        {next === "published" ? `Publish ${noun}` : `Unpublish ${noun}`}
      </SubmitButton>
    </form>
  );
}

export function DeleteSeriesForm({ id, title }: { id: string; title: string }) {
  const [state, action] = useForm(A.deleteSeriesAction);
  return (
    <details className="card">
      <summary className="tn-body-strong">Delete this series</summary>
      <form action={action} className="form-grid" style={{ marginTop: 12 }}>
        <p className="tn-supporting">This removes the series and every saga, season, issue, episode and page in it. It can&apos;t be undone. Type <strong>{title}</strong> to confirm.</p>
        <FormAlert state={state} />
        <input type="hidden" name="id" value={id} />
        <Field name="confirmTitle" label="Series title" state={state} autoComplete="off" />
        <SubmitButton className="tn-btn tn-btn--danger" pendingText="Deleting…">Delete forever</SubmitButton>
      </form>
    </details>
  );
}

export function VolumeForm({ seriesId, values }: { seriesId?: string; values?: { id: string; title: string; description: string; position: number } }) {
  const editing = !!values;
  const [state, action] = useForm(editing ? A.updateVolumeAction : A.createVolumeAction);
  return (
    <form action={action} className="form-grid two card" noValidate>
      <div className="full"><FormAlert state={state} /></div>
      {seriesId && <input type="hidden" name="seriesId" value={seriesId} />}
      {values && <input type="hidden" name="id" value={values.id} />}
      {!editing && (
        <Field name="format" label="Format" state={state}>
          {(id) => (
            <select id={id} name="format" className="tn-field__input" defaultValue="comic">
              <option value="comic">Comic (a saga or arc of issues)</option>
              <option value="show">Show (a season of episodes)</option>
            </select>
          )}
        </Field>
      )}
      <Field name="title" label="Title" required defaultValue={values?.title} state={state} placeholder={editing ? undefined : "Saga One: The Ember Heart Saga"} />
      <Field name="description" label="Description" textarea defaultValue={values?.description} state={state} className="full" />
      <Field name="position" label="Sort order" type="number" min={0} defaultValue={values?.position ?? 0} state={state} />
      <div className="full"><SubmitButton pendingText="Saving…">{editing ? "Save changes" : "Add"}</SubmitButton></div>
    </form>
  );
}

export function DeleteButtonForm({ action: act, id, label, confirmText }: { action: Action; id: string; label: string; confirmText: string }) {
  const [state, action] = useForm(act);
  return (
    <form action={action} onSubmit={(e) => { if (!confirm(confirmText)) e.preventDefault(); }} className="stack">
      <input type="hidden" name="id" value={id} />
      <FormAlert state={state} />
      <SubmitButton className="tn-btn tn-btn--danger sm" pendingText="Deleting…">{label}</SubmitButton>
    </form>
  );
}

export function ReleaseForm({ volumeId, format, values, mode, nextNumber }: { volumeId?: string; format: "comic" | "show"; values?: { id: string; version: number; number: number; title: string; synopsis: string; coverUrl: string | null }; mode: StorageMode; nextNumber?: number }) {
  const editing = !!values;
  const [state, action] = useForm(editing ? A.updateReleaseAction : A.createReleaseAction);
  const noun = format === "comic" ? "issue" : "episode";
  return (
    <form action={action} className="form-grid two card" noValidate>
      <div className="full"><FormAlert state={state} /></div>
      {volumeId && <input type="hidden" name="volumeId" value={volumeId} />}
      {values && <><input type="hidden" name="id" value={values.id} /><input type="hidden" name="version" value={values.version} /></>}
      <Field name="number" label={`${noun[0].toUpperCase() + noun.slice(1)} number`} type="number" min={1} required defaultValue={values?.number ?? nextNumber ?? 1} state={state} />
      <Field name="title" label="Title" required defaultValue={values?.title} state={state} />
      <Field name="synopsis" label="Synopsis" textarea defaultValue={values?.synopsis} state={state} className="full" />
      {editing && <ImageField name="coverUrl" label={format === "comic" ? "Cover (2:3)" : "Thumbnail (16:9)"} value={values?.coverUrl ?? null} mode={mode} />}
      <div className="full"><SubmitButton pendingText="Saving…">{editing ? "Save changes" : `Create ${noun}`}</SubmitButton></div>
    </form>
  );
}

export function PublishPanel({ id, status, publishAt, ready, readyHint, previewHref }: { id: string; status: "draft" | "published"; publishAt: string | null; ready: boolean; readyHint: string; previewHref: string }) {
  const [pubState, pub] = useForm(A.publishReleaseAction);
  const [unState, unpub] = useForm(A.unpublishReleaseAction);
  const [mode, setMode] = useState<"now" | "schedule">("now");
  const scheduled = status === "published" && publishAt && new Date(publishAt) > new Date();
  const tz = (() => {
    const m = -new Date().getTimezoneOffset();
    const s = m >= 0 ? "+" : "-";
    const a = Math.abs(m);
    return `${s}${String(Math.floor(a / 60)).padStart(2, "0")}:${String(a % 60).padStart(2, "0")}`;
  })();
  return (
    <div className="card stack">
      <div className="spread">
        <h2 className="tn-h3" style={{ margin: 0 }}>Publishing</h2>
        {status === "draft" ? <span className="tn-badge">Draft</span> : scheduled ? <span className="tn-badge tn-badge--info">Scheduled</span> : <span className="tn-badge tn-badge--live">Live</span>}
      </div>
      {scheduled && <p className="tn-supporting">Goes live {new Date(publishAt!).toLocaleString()}.</p>}
      <FormAlert state={pubState} />
      <FormAlert state={unState} />
      {status === "draft" || scheduled ? (
        <form action={pub} className="stack">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="tz" value={tz} />
          <fieldset className="row" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="visually-hidden">When</legend>
            <label className="checkbox"><input type="radio" name="mode" value="now" checked={mode === "now"} onChange={() => setMode("now")} /> Publish now</label>
            <label className="checkbox"><input type="radio" name="mode" value="schedule" checked={mode === "schedule"} onChange={() => setMode("schedule")} /> Schedule</label>
          </fieldset>
          {mode === "schedule" && (
            <div className="tn-field"><label htmlFor="publishAt" className="tn-field__label">Go live at (your local time)</label><input id="publishAt" type="datetime-local" name="publishAt" className="tn-field__input" required /></div>
          )}
          {!ready && <p className="tn-supporting" style={{ color: "var(--scar)" }}>{readyHint}</p>}
          <SubmitButton disabled={!ready} pendingText="Publishing…">{mode === "now" ? "Publish now" : "Schedule"}</SubmitButton>
        </form>
      ) : null}
      {status === "published" && (
        <form action={unpub}>
          <input type="hidden" name="id" value={id} />
          <SubmitButton className="tn-btn sm" pendingText="Unpublishing…">Unpublish (back to draft)</SubmitButton>
        </form>
      )}
      <a className="tn-btn tn-btn--ghost sm" href={previewHref} target="_blank" rel="noreferrer">Preview as a reader ↗</a>
    </div>
  );
}

export function VideoForm({ id, version, videoUrl, durationSeconds, mode }: { id: string; version: number; videoUrl: string | null; durationSeconds: number | null; mode: StorageMode }) {
  const [state, action] = useForm(A.setVideoAction);
  const [url, setUrl] = useState(videoUrl ?? "");
  const [dur, setDur] = useState(durationSeconds?.toString() ?? "");
  const [pct, setPct] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  return (
    <form action={action} className="card form-grid" noValidate>
      <h2 className="tn-h3" style={{ margin: 0 }}>Episode video</h2>
      <FormAlert state={state} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="version" value={version} />
      <div className="tn-field">
        <label className="tn-field__label" htmlFor="video-file">Upload a video file (MP4 or WebM)</label>
        <input id="video-file" type="file" accept="video/mp4,video/webm,video/quicktime" onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setErr(null); setPct(0);
          const probe = document.createElement("video");
          probe.preload = "metadata";
          probe.onloadedmetadata = () => { if (isFinite(probe.duration)) setDur(String(Math.round(probe.duration))); URL.revokeObjectURL(probe.src); };
          probe.src = URL.createObjectURL(f);
          try { setUrl(await uploadFile(f, "video", mode, setPct)); } catch (x) { setErr((x as Error).message); } finally { setPct(null); }
        }} />
        {pct !== null && <progress max={100} value={pct} aria-label="Upload progress" />}
        {err && <span className="tn-field__hint" role="alert" style={{ color: "var(--scar)" }}>{err}</span>}
      </div>
      <Field name="videoUrl" label="Or paste a YouTube or Vimeo link" value={url} onChange={(e) => setUrl(e.currentTarget.value)} state={state} hint="The uploaded file's address appears here automatically." />
      <Field name="durationSeconds" label="Length in seconds" type="number" min={0} value={dur} onChange={(e) => setDur(e.currentTarget.value)} state={state} />
      <SubmitButton disabled={pct !== null} pendingText="Saving…">Save video</SubmitButton>
    </form>
  );
}
