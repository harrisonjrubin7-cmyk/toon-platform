import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "../db";
import { actorForToken, createSession, destroySession } from "../domain/accounts";
import { hasRole, type Actor, type Role } from "../roles";

export const SESSION_COOKIE = "toon_session";
export const AGE_COOKIE = "toon_age_ok";

/** The signed-in user for this request, or null. Cached per request. */
export const currentActor = cache(async (): Promise<Actor | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return actorForToken(db, token);
});

export async function startSession(userId: string) {
  const { token, expiresAt } = await createSession(db, userId);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", expires: expiresAt,
  });
}

export async function endSession() {
  const jar = await cookies();
  await destroySession(db, jar.get(SESSION_COOKIE)?.value);
  jar.delete(SESSION_COOKIE);
}

/** For pages: send visitors to sign in, and block roles that are too low. */
export async function requirePageRole(min: Role, returnTo: string): Promise<Actor> {
  const actor = await currentActor();
  if (!actor) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  if (!hasRole(actor, min)) redirect("/forbidden");
  return actor;
}

/** Mature content: signed-in users confirmed at signup; visitors confirm once per browser. */
export async function requireAgeGate(returnTo: string) {
  const actor = await currentActor();
  if (actor?.ageConfirmed) return;
  if ((await cookies()).get(AGE_COOKIE)?.value === "1") return;
  redirect(`/age?next=${encodeURIComponent(returnTo)}`);
}

export function safeNext(raw: unknown, fallback = "/"): string {
  const s = typeof raw === "string" ? raw : "";
  return s.startsWith("/") && !s.startsWith("//") && !s.includes("\\") ? s : fallback;
}
