// Usage: DATABASE_URL=... node scripts/set-role.mjs person@example.com admin
import pg from "pg";
import { sslFor } from "./migrate.mjs";
const [email, role] = process.argv.slice(2);
if (!email || !["reader", "editor", "admin"].includes(role)) { console.error("usage: set-role.mjs <email> <reader|editor|admin>"); process.exit(1); }
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: sslFor(process.env.DATABASE_URL) });
await c.connect();
const r = await c.query("update users set role = $2 where lower(email) = lower($1) returning id", [email, role]);
await c.query("insert into audit_log (action, entity_type, entity_id, detail) select 'user.role_changed', 'user', id::text, $2 from users where lower(email) = lower($1)", [email, JSON.stringify({ to: role, via: "cli" })]);
console.log(r.rowCount ? `${email} is now ${role}` : `no user with email ${email}`);
await c.end();
