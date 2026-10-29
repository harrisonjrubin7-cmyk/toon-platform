"use client";
import Link from "next/link";
import { useActionState } from "react";
import { forgotPasswordAction, resetPasswordAction, sendDueEmailsAction, setReleaseEmailsAction, unsubscribeAction } from "@/app/actions/email";
import { Field, FormAlert, SubmitButton } from "./forms";

export function ForgotForm() {
  const [state, action] = useActionState(forgotPasswordAction, undefined);
  return (
    <form action={action} className="form-grid card" noValidate>
      <FormAlert state={state} />
      <Field name="email" label="Email" type="email" autoComplete="email" required state={state} />
      <SubmitButton pendingText="Sending…">Send reset link</SubmitButton>
      <p className="tn-supporting"><Link href="/login">Back to sign in</Link></p>
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPasswordAction, undefined);
  if (state?.ok) {
    return (
      <div className="stack">
        <FormAlert state={state} />
        <p><Link className="tn-btn tn-btn--primary" href="/login">Sign in</Link></p>
      </div>
    );
  }
  return (
    <form action={action} className="form-grid card" noValidate>
      <FormAlert state={state} />
      <input type="hidden" name="token" value={token} />
      <Field name="password" label="New password" type="password" autoComplete="new-password" required minLength={10} hint="At least 10 characters." state={state} />
      <Field name="confirm" label="Type it again" type="password" autoComplete="new-password" required state={state} />
      <SubmitButton pendingText="Saving…">Set new password</SubmitButton>
    </form>
  );
}

export function ReleaseEmailsForm({ on }: { on: boolean }) {
  const [state, action] = useActionState(setReleaseEmailsAction, undefined);
  return (
    <form action={action} className="form-grid card" noValidate>
      <FormAlert state={state} />
      <label className="checkbox">
        <input type="checkbox" name="releases" defaultChecked={on} />
        <span>Email me when a series I follow has a new issue or episode</span>
      </label>
      <SubmitButton pendingText="Saving…">Save email setting</SubmitButton>
    </form>
  );
}

export function UnsubscribeForm({ token }: { token: string }) {
  const [state, action] = useActionState(unsubscribeAction, undefined);
  if (state?.ok) return <FormAlert state={state} />;
  return (
    <form action={action} className="form-grid card" noValidate>
      <FormAlert state={state} />
      <input type="hidden" name="t" value={token} />
      <p className="tn-body">Stop emails about new releases from series you follow?</p>
      <SubmitButton pendingText="Saving…">Stop release emails</SubmitButton>
    </form>
  );
}

export function SendDueEmailsButton() {
  const [state, action] = useActionState(sendDueEmailsAction, undefined);
  return (
    <form action={action} className="stack">
      <FormAlert state={state} />
      <SubmitButton className="tn-btn tn-btn--secondary" pendingText="Sending…">Send due emails now</SubmitButton>
    </form>
  );
}
