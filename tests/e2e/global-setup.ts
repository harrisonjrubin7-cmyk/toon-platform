import pg from "pg";
import { execFileSync } from "node:child_process";

export default async function setup() {
  if (process.env.E2E_BASE_URL) return; // running against a deployed site: don't touch its database
  const url = process.env.E2E_DATABASE_URL ?? "postgres://postgres@localhost:5433/toon_e2e";
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  await c.query("drop schema public cascade; create schema public;");
  await c.end();
  execFileSync(process.execPath, ["scripts/migrate.mjs"], { env: { ...process.env, DATABASE_URL: url }, stdio: "inherit" });
}
