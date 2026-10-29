// Seeds the studio's confirmed IPs as draft series. Safe to re-run.
// Only confirmed facts: Volcano Racers is IP #1 with two scripted comic sagas; Starfall is IP #2 (no details yet).
import pg from "pg";
import { sslFor } from "./migrate.mjs";

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL is required"); process.exit(1); }
const c = new pg.Client({ connectionString: url, ssl: sslFor(url) });
await c.connect();

async function series(slug, fields) {
  const { rows } = await c.query(
    `insert into series (slug, title, tagline, rating, theme, logo_url, position) values ($1,$2,$3,$4,$5,$6,$7)
     on conflict (slug) do nothing returning id`,
    [slug, fields.title, fields.tagline ?? "", fields.rating ?? "TV-MA", fields.theme, fields.logoUrl ?? null, fields.position],
  );
  if (rows[0]) { console.log(`created series ${slug}`); return rows[0].id; }
  console.log(`series ${slug} already exists`);
  return null;
}

const vr = await series("volcano-racers", {
  title: "Volcano Racers", tagline: "Toon physics. Real scars.", theme: "volcano-racers",
  logoUrl: "/brand/logos/volcano-racers-wordmark.svg", position: 1,
});
if (vr) {
  await c.query("insert into volumes (series_id, format, title, position) values ($1,'comic','Saga One: The Ember Heart Saga',1), ($1,'comic','Saga Two: The Apex Saga',2)", [vr]);
}
await series("starfall", { title: "Starfall", theme: "starfall", position: 2 });

await c.end();
