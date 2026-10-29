"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useActionState, useState } from "react";
import { Field, FormAlert, SubmitButton } from "../forms";
import type { StorageMode } from "../upload";
import { uploadCommunityImage } from "./upload";
import * as A from "@/app/actions/community";

const val = (s: A.FormState, k: string) => s?.values?.[k];

type SeriesOption = { id: string; title: string };

export function ProfileForm({ userId, mode, initial, next }: { userId: string; mode: StorageMode; initial: { handle: string; bio: string; avatarUrl: string | null } | null; next: string }) {
  const [state, act] = useActionState(A.saveProfileAction, undefined);
  const [avatar, setAvatar] = useState(initial?.avatarUrl ?? "");
  const [err, setErr] = useState<string | null>(null);
  return (
    <form action={act} className="form-grid card" noValidate>
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="avatarUrl" value={avatar} />
      <Field name="handle" label="Handle" state={state} required defaultValue={val(state, "handle") ?? initial?.handle} hint="Your @name, 3 to 30 lowercase letters, numbers or underscores. People find and share your work by it." autoComplete="username" />
      <Field name="bio" label="About you" state={state} textarea defaultValue={val(state, "bio") ?? initial?.bio} hint="Optional, up to 500 characters." />
      <div className="tn-field">
        <span className="tn-field__label">Profile picture (optional)</span>
        <div className="row">
          {avatar && <img src={avatar} alt="" className="avatar" />}
          <input type="file" aria-label="Upload a profile picture" accept="image/png,image/jpeg,image/webp,image/gif" onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setErr(null);
            try { setAvatar(await uploadCommunityImage(f, userId, mode, "avatar")); } catch (x) { setErr((x as Error).message); }
          }} />
          {avatar && <button type="button" className="tn-btn sm" onClick={() => setAvatar("")}>Remove</button>}
        </div>
        {err && <span className="tn-field__error" role="alert">{err}</span>}
      </div>
      <div className={`tn-field ${state?.fields?.acceptTerms ? "tn-field--error" : ""}`}>
        <label className="checkbox">
          <input type="checkbox" name="acceptTerms" defaultChecked={val(state, "acceptTerms") === "on"} aria-invalid={!!state?.fields?.acceptTerms} />
          <span>I&apos;ve read and accept the <Link href="/community/guidelines" target="_blank">community guidelines and creator terms</Link>. I own or have the right to post what I upload.</span>
        </label>
        {state?.fields?.acceptTerms && <span className="tn-field__error">{state.fields.acceptTerms}</span>}
      </div>
      <FormAlert state={state} />
      <div><SubmitButton>{initial ? "Save profile" : "Create profile"}</SubmitButton></div>
    </form>
  );
}

export function NewComicForm({ series, allowFanWorks, defaultSpinoff }: { series: SeriesOption[]; allowFanWorks: boolean; defaultSpinoff?: string }) {
  const [state, act] = useActionState(A.createComicAction, undefined);
  return (
    <form action={act} className="form-grid card" noValidate>
      <Field name="title" label="Title" state={state} required defaultValue={val(state, "title")} />
      <Field name="rating" label="Rating" state={state} required>
        {(id) => (
          <select id={id} name="rating" className="tn-field__input" defaultValue={val(state, "rating") ?? "Mature"}>
            <option value="Mature">Mature (18+)</option>
            <option value="Teen">Teen (13+, no sex, no graphic gore)</option>
          </select>
        )}
      </Field>
      <Field name="spinoffOf" label="Spinoff of" state={state} hint={allowFanWorks ? "Pick a studio series to make a fan spinoff, or leave it as an original." : "The studio isn't accepting spinoffs right now."}>
        {(id) => (
          <select id={id} name="spinoffOf" className="tn-field__input" defaultValue={allowFanWorks ? val(state, "spinoffOf") ?? defaultSpinoff ?? "" : ""} disabled={!allowFanWorks}>
            <option value="">An original story</option>
            {series.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
        )}
      </Field>
      <FormAlert state={state} />
      <div><SubmitButton pendingText="Creating…">Start comic</SubmitButton></div>
    </form>
  );
}

export function IdeaForm({ series, allowFanWorks, defaultSpinoff }: { series: SeriesOption[]; allowFanWorks: boolean; defaultSpinoff?: string }) {
  const [state, act] = useActionState(A.createIdeaAction, undefined);
  return (
    <form action={act} className="form-grid card" noValidate>
      <Field name="title" label="Title" state={state} required defaultValue={val(state, "title")} />
      <Field name="body" label="Your idea" state={state} required textarea defaultValue={val(state, "body")} hint="The premise, who it's about, and what happens. Up to 5,000 characters." />
      <Field name="spinoffOf" label="Spinoff of" state={state}>
        {(id) => (
          <select id={id} name="spinoffOf" className="tn-field__input" defaultValue={allowFanWorks ? val(state, "spinoffOf") ?? defaultSpinoff ?? "" : ""} disabled={!allowFanWorks}>
            <option value="">A brand-new world</option>
            {series.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
        )}
      </Field>
      <Field name="rating" label="Rating" state={state} required>
        {(id) => (
          <select id={id} name="rating" className="tn-field__input" defaultValue={val(state, "rating") ?? "Mature"}>
            <option value="Mature">Mature (18+)</option>
            <option value="Teen">Teen (13+)</option>
          </select>
        )}
      </Field>
      <p className="tn-supporting muted">Posting an idea doesn&apos;t give the studio any rights to it, and the studio doesn&apos;t take unsolicited pitches for its own slate through the community.</p>
      <FormAlert state={state} />
      <div><SubmitButton pendingText="Posting…">Post idea</SubmitButton></div>
    </form>
  );
}

export function CommentForm({ type, id, path }: { type: "comic" | "idea"; id: string; path: string }) {
  const [state, act] = useActionState(A.commentAction, undefined);
  return (
    <form action={act} className="form-grid" noValidate>
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="path" value={path} />
      <Field name="body" label="Add a comment" state={state} textarea required defaultValue={state?.ok ? "" : val(state, "body")} />
      <FormAlert state={state} />
      <div><SubmitButton pendingText="Posting…">Post comment</SubmitButton></div>
    </form>
  );
}

const REASONS: [string, string][] = [
  ["minor_safety", "Involves a minor in sexual or abusive content"],
  ["sexual", "Sexually explicit, or sexual content of a real person"],
  ["harassment", "Harassment or bullying"],
  ["hate", "Hate speech"],
  ["violence", "Threats or real-world violence"],
  ["copyright", "Copies someone else's work"],
  ["wrong_rating", "Wrong rating (should be Mature)"],
  ["spam", "Spam or scams"],
  ["other", "Something else"],
];

export function ReportButton({ targetType, targetId, path, label = "Report" }: { targetType: "comic" | "idea" | "comment" | "profile"; targetId: string; path: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const [state, act] = useActionState(A.reportAction, undefined);
  if (!open) return <button type="button" className="tn-btn tn-btn--ghost sm" onClick={() => setOpen(true)}>{label}</button>;
  return (
    <form action={act} className="form-grid card" style={{ maxWidth: 520 }}>
      <input type="hidden" name="targetType" value={targetType} />
      <input type="hidden" name="targetId" value={targetId} />
      <input type="hidden" name="path" value={path} />
      <fieldset style={{ border: 0, padding: 0, margin: 0 }} className="stack">
        <legend className="tn-body-strong">What&apos;s wrong?</legend>
        {REASONS.map(([v, l]) => (
          <label key={v} className="checkbox"><input type="radio" name="reason" value={v} required /> <span>{l}</span></label>
        ))}
      </fieldset>
      <Field name="details" label="Anything the studio should know" state={state} textarea defaultValue={val(state, "details")} />
      <FormAlert state={state} />
      {!state?.ok && (
        <div className="row">
          <SubmitButton className="tn-btn tn-btn--danger" pendingText="Sending…">Send report</SubmitButton>
          <button type="button" className="tn-btn" onClick={() => setOpen(false)}>Cancel</button>
        </div>
      )}
    </form>
  );
}

export function ShareButton({ path, title }: { path: string; title: string }) {
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <span className="row" style={{ gap: 6 }}>
      <button type="button" className="tn-btn sm" onClick={async () => {
        const url = new URL(path, location.origin).toString();
        try {
          if (navigator.share) { await navigator.share({ title, url }); return; }
          await navigator.clipboard.writeText(url);
          setMsg("Link copied.");
        } catch (e) {
          if ((e as Error).name !== "AbortError") setMsg(`Copy this link: ${url}`);
        }
      }}>Share</button>
      <span role="status" className="tn-supporting muted">{msg}</span>
    </span>
  );
}

export function PublishControls({ id, status, moderation, title, dirtyHint }: { id: string; status: "draft" | "published"; moderation: string; title: string; dirtyHint?: boolean }) {
  const [ps, pub] = useActionState(A.publishComicAction, undefined);
  const [us, unpub] = useActionState(A.unpublishComicAction, undefined);
  const [ds, del] = useActionState(A.deleteComicAction, undefined);
  const removed = moderation === "removed";
  return (
    <div className="stack">
      <div className="row">
        {status === "draft" && !removed && (
          <form action={pub}><input type="hidden" name="id" value={id} /><SubmitButton pendingText="Publishing…">Publish</SubmitButton></form>
        )}
        {status === "published" && (
          <form action={unpub}><input type="hidden" name="id" value={id} /><SubmitButton className="tn-btn" pendingText="Saving…">Move back to draft</SubmitButton></form>
        )}
        {status === "published" && moderation === "visible" && <Link className="tn-btn tn-btn--ghost" href={`/c/${id}`}>View live comic</Link>}
      </div>
      {dirtyHint && <p className="tn-supporting muted">Publishing uses your last saved version. Save first.</p>}
      <FormAlert state={ps} />
      <FormAlert state={us} />
      <details>
        <summary className="tn-supporting">Delete this comic</summary>
        <form action={del} className="form-grid" style={{ marginTop: 8 }}>
          <input type="hidden" name="id" value={id} />
          <Field name="confirmTitle" label={`Type “${title}” to confirm`} state={ds} required />
          <FormAlert state={ds} />
          <div><SubmitButton className="tn-btn tn-btn--danger" pendingText="Deleting…">Delete for good</SubmitButton></div>
        </form>
      </details>
    </div>
  );
}

// ---------- Studio moderation ----------

export function DecisionButtons({ targetType, targetId, options }: { targetType: string; targetId: string; options: ("dismiss" | "hide" | "remove" | "restore" | "approve")[] }) {
  const [state, act] = useActionState(A.decideAction, undefined);
  const label = { dismiss: "Dismiss reports", hide: "Hide", remove: "Remove", restore: "Restore", approve: "Approve" } as const;
  return (
    <form action={act} className="stack">
      <input type="hidden" name="targetType" value={targetType} />
      <input type="hidden" name="targetId" value={targetId} />
      <label className="visually-hidden" htmlFor={`note-${targetId}`}>Note to the author</label>
      <input id={`note-${targetId}`} name="note" className="tn-field__input" placeholder="Note to the author (optional)" maxLength={500} />
      <div className="row">
        {options.map((o) => (
          <button key={o} className={`tn-btn sm ${o === "remove" ? "tn-btn--danger" : o === "approve" || o === "restore" ? "tn-btn--primary" : ""}`} type="submit" name="decision" value={o}>{label[o]}</button>
        ))}
      </div>
      <FormAlert state={state} />
    </form>
  );
}

export function SuspendForm({ userId, handle, suspended }: { userId: string; handle: string; suspended?: boolean }) {
  const [state, act] = useActionState(A.suspendAction, undefined);
  if (suspended) {
    return (
      <form action={act} className="row">
        <input type="hidden" name="userId" value={userId} /><input type="hidden" name="days" value="0" />
        <SubmitButton className="tn-btn sm" pendingText="Saving…">Restore posting for @{handle}</SubmitButton>
        <FormAlert state={state} />
      </form>
    );
  }
  return (
    <form action={act} className="row">
      <input type="hidden" name="userId" value={userId} />
      <label className="visually-hidden" htmlFor={`days-${userId}`}>Pause posting for</label>
      <select id={`days-${userId}`} name="days" className="tn-field__input" style={{ width: "auto" }} defaultValue="7">
        <option value="1">1 day</option><option value="7">7 days</option><option value="30">30 days</option><option value="3650">Indefinitely</option>
      </select>
      <label className="visually-hidden" htmlFor={`why-${userId}`}>Reason</label>
      <input id={`why-${userId}`} name="reason" className="tn-field__input" placeholder="Reason (shown to them)" style={{ maxWidth: 240 }} />
      <SubmitButton className="tn-btn sm tn-btn--danger" pendingText="Saving…">Pause posting for @{handle}</SubmitButton>
      <FormAlert state={state} />
    </form>
  );
}

export function SettingsForm({ settings }: { settings: { preModeration: boolean; allowFanWorks: boolean; autoHideReports: number; version: number } }) {
  const [state, act] = useActionState(A.updateSettingsAction, undefined);
  return (
    <form action={act} className="form-grid card">
      <input type="hidden" name="version" value={settings.version} />
      <label className="checkbox"><input type="checkbox" name="preModeration" defaultChecked={settings.preModeration} /> <span><strong>Approve posts before they go live.</strong> New comics, edits to live comics, and new ideas wait in the approval queue.</span></label>
      <label className="checkbox"><input type="checkbox" name="allowFanWorks" defaultChecked={settings.allowFanWorks} /> <span><strong>Accept fan spinoffs of studio series.</strong> When off, members can only post original stories.</span></label>
      <Field name="autoHideReports" label="Hide a post automatically after this many reports" type="number" min={1} max={100} state={state} defaultValue={settings.autoHideReports} hint="Child-safety reports hide a post after one report, whatever this says." />
      <FormAlert state={state} />
      <div><SubmitButton>Save rules</SubmitButton></div>
    </form>
  );
}
