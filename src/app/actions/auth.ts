"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { authenticate, confirmAge, signup } from "@/lib/domain/accounts";
import { AGE_COOKIE, currentActor, endSession, safeNext, startSession } from "@/lib/auth/session";
import { toActionState, type ActionState } from "@/lib/errors";

export async function signupAction(_: ActionState, form: FormData): Promise<ActionState> {
  let next: string;
  try {
    const actor = await signup(db, {
      email: form.get("email"), displayName: form.get("displayName"), password: form.get("password"),
      ageConfirmed: form.get("ageConfirmed") === "on",
    });
    await startSession(actor.id);
    next = safeNext(form.get("next"));
  } catch (e) {
    return toActionState(e);
  }
  redirect(next);
}

export async function loginAction(_: ActionState, form: FormData): Promise<ActionState> {
  let next: string;
  try {
    const actor = await authenticate(db, String(form.get("email") ?? ""), String(form.get("password") ?? ""));
    await startSession(actor.id);
    next = safeNext(form.get("next"));
  } catch (e) {
    return toActionState(e);
  }
  redirect(next);
}

export async function logoutAction() {
  await endSession();
  redirect("/");
}

export async function confirmAgeAction(form: FormData) {
  const actor = await currentActor();
  if (actor) await confirmAge(db, actor);
  (await cookies()).set(AGE_COOKIE, "1", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365, secure: process.env.NODE_ENV === "production" });
  redirect(safeNext(form.get("next")));
}
