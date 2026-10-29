"use client";
import { useEffect, useId, useRef } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/lib/errors";

/**
 * Submit button per the brand guide's loading state: the width stays stable (both
 * labels share one grid cell), the busy label reads "Saving…", aria-busy is set and
 * the button is disabled while pending so a second submit can't fire.
 */
export function SubmitButton({ children, pendingText = "Saving…", className = "tn-btn tn-btn--primary", ...rest }: { children: React.ReactNode; pendingText?: string; className?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} {...rest} disabled={pending || rest.disabled} aria-busy={pending || undefined}>
      <span className="stable-label">
        <span className={pending ? "is-hidden" : undefined} aria-hidden={pending || undefined}>{children}</span>
        <span className={pending ? undefined : "is-hidden"} aria-hidden={!pending || undefined}>{pendingText}</span>
      </span>
    </button>
  );
}

/**
 * Outcome of a form action. Errors are a persistent notice and, when fields are
 * invalid, focus moves to the first invalid field. Success sits in a polite live
 * region and only repeats what the server confirmed it saved.
 */
export function FormAlert({ state }: { state: ActionState }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!state?.fields || !Object.keys(state.fields).length) return;
    const form = ref.current?.closest("form");
    const first = form?.querySelector<HTMLElement>('[aria-invalid="true"]');
    first?.focus();
  }, [state]);
  return (
    <div ref={ref} aria-live="polite" className="form-outcome">
      {state?.error && (
        <div className="tn-notice tn-notice--error alert-error" role="alert">
          <span className="tn-notice__title">Not saved</span>
          <span>{state.error}</span>
        </div>
      )}
      {!state?.error && state?.message && (
        <div className="tn-notice tn-notice--success alert-ok" role="status">{state.message}</div>
      )}
    </div>
  );
}

type FieldProps = {
  name: string; label: string; state?: ActionState; hint?: string; type?: string; defaultValue?: string | number | null;
  required?: boolean; textarea?: boolean; autoComplete?: string; placeholder?: string; children?: (id: string) => React.ReactNode; className?: string;
  ref?: React.Ref<HTMLInputElement>;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "defaultValue" | "children">;

export function Field({ name, label, state, hint, type = "text", defaultValue, required, textarea, autoComplete, placeholder, children, className = "", ...rest }: FieldProps) {
  const err = state?.fields?.[name];
  const uid = useId();
  const id = `f-${name}-${uid.replace(/[^a-zA-Z0-9]/g, "")}`;
  const describedBy = [hint ? `${id}-hint` : null, err ? `${id}-err` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={`tn-field ${err ? "tn-field--error" : ""} ${className}`}>
      <label htmlFor={id} className="tn-field__label">{label}{required ? " *" : ""}</label>
      {children ? children(id) :
        (textarea ? (
          <textarea id={id} name={name} className="tn-field__input" defaultValue={defaultValue ?? ""} required={required} aria-invalid={!!err} aria-describedby={describedBy} placeholder={placeholder} />
        ) : (
          <input id={id} name={name} type={type} className="tn-field__input" {...(rest.value === undefined ? { defaultValue: defaultValue ?? "" } : {})} required={required} aria-invalid={!!err} aria-describedby={describedBy} autoComplete={autoComplete} placeholder={placeholder} {...rest} />
        ))}
      {hint && <span id={`${id}-hint`} className="tn-field__hint">{hint}</span>}
      {err && <span id={`${id}-err`} className="tn-field__error">{err}</span>}
    </div>
  );
}
