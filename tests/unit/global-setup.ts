import pg from "pg";
import { migrate } from "../../scripts/migrate.mjs";

export default async function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgres://postgres@localhost:5433/toon_test";
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  await c.query("drop schema public cascade; create schema public;");
  await c.end();
  await migrate(url, () => {});
}
