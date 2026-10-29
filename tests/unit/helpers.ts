import pg from "pg";
import type { Queryable } from "@/lib/db";
import type { Actor } from "@/lib/roles";
import { signup } from "@/lib/domain/accounts";

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
export const q: Queryable = pool;

let n = 0;
export async function makeUser(role: Actor["role"] = "reader"): Promise<Actor> {
  n++;
  const a = await signup(q, { email: `u${n}-${Date.now()}@example.com`, displayName: `User ${n}`, password: "correct horse battery", ageConfirmed: true });
  await q.query("update users set role = $2 where id = $1", [a.id, role]);
  return { ...a, role };
}

export const uniq = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
