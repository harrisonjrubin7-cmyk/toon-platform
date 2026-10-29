"use client";
import Link from "next/link";
import { useActionState } from "react";
import { loginAction, signupAction } from "@/app/actions/auth";
import { Field, FormAlert, SubmitButton } from "./forms";

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState(loginAction, undefined);
  return (
    <form action={action} className="form-grid card" noValidate>
      <FormAlert state={state} />
      <input type="hidden" name="next" value={next} />
      <Field name="email" label="Email" type="email" autoComplete="email" required state={state} />
      <Field name="password" label="Password" type="password" autoComplete="current-password" required state={state} />
      <SubmitButton pendingText="Signing in…">Sign in</SubmitButton>
      <p className="tn-supporting">New here? <Link href={`/signup?next=${encodeURIComponent(next)}`}>Create an account</Link></p>
    </form>
  );
}

export function SignupForm({ next }: { next: string }) {
  const [state, action] = useActionState(signupAction, undefined);
  return (
    <form action={action} className="form-grid card" noValidate>
      <FormAlert state={state} />
      <input type="hidden" name="next" value={next} />
      <Field name="displayName" label="Display name" autoComplete="nickname" required state={state} />
      <Field name="email" label="Email" type="email" autoComplete="email" required state={state} />
      <Field name="password" label="Password" type="password" autoComplete="new-password" required state={state} hint="At least 10 characters." minLength={10} />
      <div className={`tn-field ${state?.fields?.ageConfirmed ? "tn-field--error" : ""}`}>
        <label className="checkbox">
          <input type="checkbox" name="ageConfirmed" required aria-invalid={!!state?.fields?.ageConfirmed} />
          <span>I am 18 or older. Tune titles are for mature readers.</span>
        </label>
        {state?.fields?.ageConfirmed && <span className="tn-field__hint">{state.fields.ageConfirmed}</span>}
      </div>
      <SubmitButton pendingText="Creating account…">Create account</SubmitButton>
      <p className="tn-supporting">Already have an account? <Link href={`/login?next=${encodeURIComponent(next)}`}>Sign in</Link></p>
    </form>
  );
}
