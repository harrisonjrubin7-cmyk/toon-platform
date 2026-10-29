import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import type { Queryable } from "../db";
import { AppError } from "../errors";
import { hashPassword, verifyPassword } from "../auth/password";
import { permissions, type Actor, type Role } from "../roles";
import { audit } from "./audit";

export const SESSION_DAYS = 30;

const signupSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(254),
  displayName: z.string().trim().min(1, "Enter a display name.").max(60, "Keep it under 60 characters."),
  password: z.string().min(10, "Use at least 10 characters.").max(200),
  ageConfirmed: z.literal(true, { message: "You must confirm you are 18 or older." }),
});

function fieldErrors(err: z.ZodError) {
  const fields: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = String(issue.path[0] ?? "form");
    fields[key] ??= issue.message;
  }
  return fields;
}

export function parseOrThrow<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new AppError("invalid", "Please fix the highlighted fields.", fieldErrors(parsed.error));
  return parsed.data;
}

type UserRow = { id: string; email: string; display_name: string; role: Role; age_confirmed_at: Date | null; password_hash: string; disabled_at: Date | null };

const toActor = (u: UserRow): Actor => ({ id: u.id, email: u.email, displayName: u.display_name, role: u.role, ageConfirmed: !!u.age_confirmed_at });

export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

export async function signup(q: Queryable, input: unknown): Promise<Actor> {
  const data = parseOrThrow(signupSchema, input);
  const role: Role = adminEmails().includes(data.email) ? "admin" : "reader";
  const hash = await hashPassword(data.password);
  try {
    const { rows } = await q.query<UserRow>(
      `insert into users (email, display_name, password_hash, role, age_confirmed_at)
       values ($1,$2,$3,$4, now()) returning *`,
      [data.email, data.displayName, hash, role],
    );
    await audit(q, rows[0].id, "user.signup", "user", rows[0].id, { role });
    return toActor(rows[0]);
  } catch (e) {
    if ((e as { code?: string }).code === "23505") throw new AppError("conflict", "An account with that email already exists.", { email: "Already registered. Try signing in." });
    throw e;
  }
}

export async function authenticate(q: Queryable, emailRaw: string, password: string): Promise<Actor> {
  const email = String(emailRaw ?? "").trim().toLowerCase();
  const { rows } = await q.query<UserRow>("select * from users where lower(email) = $1", [email]);
  const user = rows[0];
  // Same message either way, so the form does not reveal which emails exist.
  const fail = new AppError("unauthenticated", "That email and password don't match.");
  if (!user) {
    await verifyPassword(password, "scrypt$AAAAAAAAAAAAAAAAAAAAAA==$" + "A".repeat(86) + "==");
    throw fail;
  }
  if (!(await verifyPassword(String(password ?? ""), user.password_hash))) throw fail;
  if (user.disabled_at) throw new AppError("forbidden", "This account is disabled.");
  return toActor(user);
}

const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

export async function createSession(q: Queryable, userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 864e5);
  await q.query("insert into sessions (token_hash, user_id, expires_at) values ($1,$2,$3)", [hashToken(token), userId, expiresAt]);
  return { token, expiresAt };
}

export async function actorForToken(q: Queryable, token: string | undefined): Promise<Actor | null> {
  if (!token) return null;
  const { rows } = await q.query<UserRow>(
    `select u.* from sessions s join users u on u.id = s.user_id
     where s.token_hash = $1 and s.expires_at > now() and u.disabled_at is null`,
    [hashToken(token)],
  );
  return rows[0] ? toActor(rows[0]) : null;
}

export async function destroySession(q: Queryable, token: string | undefined) {
  if (token) await q.query("delete from sessions where token_hash = $1", [hashToken(token)]);
}

// ---- Administration ----

export type UserListItem = { id: string; email: string; displayName: string; role: Role; disabled: boolean; createdAt: Date };

export async function listUsers(q: Queryable, actor: Actor | null, search = ""): Promise<UserListItem[]> {
  if (!permissions.manageUsers(actor)) throw new AppError("forbidden", "Only admins can manage users.");
  const { rows } = await q.query<UserRow & { created_at: Date }>(
    `select * from users where $1 = '' or email ilike '%' || $1 || '%' or display_name ilike '%' || $1 || '%'
     order by created_at desc limit 200`,
    [search.trim()],
  );
  return rows.map((u) => ({ id: u.id, email: u.email, displayName: u.display_name, role: u.role, disabled: !!u.disabled_at, createdAt: u.created_at }));
}

const roleSchema = z.enum(["reader", "editor", "admin"]);

export async function setUserRole(q: Queryable, actor: Actor | null, userId: string, roleRaw: unknown) {
  if (!permissions.manageUsers(actor)) throw new AppError("forbidden", "Only admins can change roles.");
  const role = parseOrThrow(roleSchema, roleRaw);
  const { rows } = await q.query<UserRow>("select * from users where id = $1 for update", [userId]);
  if (!rows[0]) throw new AppError("not_found", "User not found.");
  if (rows[0].role === "admin" && role !== "admin") await assertAnotherAdmin(q, userId);
  await q.query("update users set role = $2 where id = $1", [userId, role]);
  await audit(q, actor!.id, "user.role_changed", "user", userId, { from: rows[0].role, to: role });
}

export async function setUserDisabled(q: Queryable, actor: Actor | null, userId: string, disabled: boolean) {
  if (!permissions.manageUsers(actor)) throw new AppError("forbidden", "Only admins can disable accounts.");
  if (actor!.id === userId) throw new AppError("invalid", "You can't disable your own account.");
  const { rows } = await q.query<UserRow>("select * from users where id = $1 for update", [userId]);
  if (!rows[0]) throw new AppError("not_found", "User not found.");
  if (disabled && rows[0].role === "admin") await assertAnotherAdmin(q, userId);
  await q.query("update users set disabled_at = case when $2 then now() else null end where id = $1", [userId, disabled]);
  if (disabled) await q.query("delete from sessions where user_id = $1", [userId]);
  await audit(q, actor!.id, disabled ? "user.disabled" : "user.enabled", "user", userId);
}

async function assertAnotherAdmin(q: Queryable, exceptUserId: string) {
  const { rows } = await q.query<{ n: string }>(
    "select count(*) n from users where role = 'admin' and disabled_at is null and id <> $1",
    [exceptUserId],
  );
  if (Number(rows[0].n) === 0) throw new AppError("invalid", "The studio needs at least one active admin.");
}

export async function confirmAge(q: Queryable, actor: Actor) {
  await q.query("update users set age_confirmed_at = coalesce(age_confirmed_at, now()) where id = $1", [actor.id]);
}
