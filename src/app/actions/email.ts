"use server";
import { revalidatePath } from "next/cache";
import { db, withTx } from "@/lib/db";
import { currentActor } from "@/lib/auth/session";
import { requestPasswordReset, resetPassword, setReleaseEmails, unsubscribeByToken } from "@/lib/domain/email";
import { deliverDueEmails } from "@/lib/email/outbox";
import { configuredTransport } from "@/lib/email/transport";
import { sendDueEmailsAfterResponse } from "@/lib/email/deliver";
import { permissions } from "@/lib/roles";
import { AppError, toActionState, type ActionState } from "@/lib/errors";

export async function forgotPasswordAction(_: ActionState, f: FormData): Promise<ActionState> {
  try {
    await withTx((tx) => requestPasswordReset(tx, f.get("email")));
    sendDueEmailsAfterResponse();
  } catch (e) {
    return toActionState(e);
  }
  // Same answer whether or not the account exists.
  return { ok: true, message: "If that email has an account, a reset link is on its way. It works for one hour." };
}

export async function resetPasswordAction(_: ActionState, f: FormData): Promise<ActionState> {
  try {
    await withTx((tx) => resetPassword(tx, { token: f.get("token"), password: f.get("password"), confirm: f.get("confirm") }));
  } catch (e) {
    return toActionState(e);
  }
  return { ok: true, message: "Password changed. You've been signed out everywhere; sign in with the new password." };
}

export async function setReleaseEmailsAction(_: ActionState, f: FormData): Promise<ActionState> {
  const on = f.get("releases") === "on";
  try {
    await setReleaseEmails(db, await currentActor(), on);
  } catch (e) {
    return toActionState(e);
  }
  revalidatePath("/library");
  return { ok: true, message: on ? "You'll get an email when a series you follow has a new release." : "Release emails are off." };
}

export async function unsubscribeAction(_: ActionState, f: FormData): Promise<ActionState> {
  try {
    const done = await withTx((tx) => unsubscribeByToken(tx, f.get("t")));
    if (!done) return { error: "This unsubscribe link isn't valid. Sign in and turn emails off in My library." };
  } catch (e) {
    return toActionState(e);
  }
  return { ok: true, message: "You won't get release emails any more. You can turn them back on in My library." };
}

export async function sendDueEmailsAction(): Promise<ActionState> {
  try {
    if (!permissions.manageUsers(await currentActor())) throw new AppError("forbidden", "Only admins can send emails.");
    const r = await deliverDueEmails(db, configuredTransport());
    revalidatePath("/studio/email");
    if (r.skipped) return { error: "No email provider is set up, so nothing was sent. Add RESEND_API_KEY and EMAIL_FROM." };
    return { ok: true, message: `Sent ${r.sent}, failed ${r.failed}, cancelled ${r.cancelled}.` };
  } catch (e) {
    return toActionState(e);
  }
}
