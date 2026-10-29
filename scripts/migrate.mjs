// Applies db/migrations/*.sql in order, once each. Usage: DATABASE_URL=... node scripts/migrate.mjs
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

export async function migrate(connectionString, log = console.log) {
  const client = new pg.Client({ connectionString, ssl: sslFor(connectionString) });
  await client.connect();
  try {
    await client.query("create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())");
    const dir = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "db", "migrations");
    const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
    const { rows } = await client.query("select name from schema_migrations");
    const done = new Set(rows.map((r) => r.name));
    for (const file of files) {
      if (done.has(file)) continue;
      const sql = await readFile(path.join(dir, file), "utf8");
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query("insert into schema_migrations(name) values ($1)", [file]);
        await client.query("commit");
        log(`applied ${file}`);
      } catch (e) {
        await client.query("rollback");
        throw new Error(`migration ${file} failed: ${e.message}`);
      }
    }
  } finally {
    await client.end();
  }
}

export function sslFor(url) {
  return /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: true };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error("DATABASE_URL is required"); process.exit(1); }
  migrate(url).then(() => console.log("migrations up to date")).catch((e) => { console.error(e.message); process.exit(1); });
}
