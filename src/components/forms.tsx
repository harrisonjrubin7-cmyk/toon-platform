"use client";
import { useId } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/lib/errors";

export function SubmitButton({ children, pendingText, className = "tn-btn tn-btn--primary", ...rest }: { children: React.ReactNode; pendingText?: string; className?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending || rest.disabled} aria-disabled={pending} {...rest}>
      {pending ? pendingText ?? "Working…" : children}
    </button>
  );
}

export function FormAlert({ state }: { state: ActionState }) {
  if (!state) return null;
  if (state.error) return <div className="alert alert-error" role="alert">{state.error}</div>;
  if (state.message) return <div className="alert alert-ok" role="status">{state.message}</div>;
  return null;
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
      {hint && !err && <span id={`${id}-hint`} className="tn-field__hint">{hint}</span>}
      {err && <span id={`${id}-err`} className="tn-field__hint">{err}</span>}
    </div>
  );
}
