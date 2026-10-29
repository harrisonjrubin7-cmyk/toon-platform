# Runbook

## Environments

| Env | App | Database | Files |
|---|---|---|---|
| Local | `npm run dev` | Local Postgres (`DATABASE_URL`) | `.data/media` |
| Preview | Vercel preview deployment of a branch | Neon project `toon-platform` (`wispy-unit-82539652`), branch `main` (until a separate `preview` branch is made) | Vercel Blob store |
| Production | Not set up | — | — |

## Environment variables

| Name | Where | Notes |
|---|---|---|
| `DATABASE_URL` | Vercel (Preview, Production) | Neon pooled connection string with `sslmode=verify-full`. Never commit it. |
| `ADMIN_EMAILS` | Vercel | Comma-separated. Sign up with one of these to become admin. |
| `BLOB_READ_WRITE_TOKEN` | Vercel | Added automatically when a Blob store is connected to the project. Without it, production uploads are refused. |

## Deploy

1. Push to GitHub. Vercel builds with `npm run vercel-build`, which runs `scripts/migrate.mjs` (applies new files in `db/migrations`, each once, in a transaction) and then `next build`.
2. Check `https://<deployment>/api/health` returns `{"ok":true,"db":"up"}`.
3. Sign in as an admin, open `/studio`, and confirm the series list loads.

## Migrations

- Add a new numbered file in `db/migrations/` (never edit an applied one). Prefer additive changes (new columns with defaults, new tables) so the previous deployment keeps working during a rollback.
- Applied migrations are recorded in `schema_migrations`.

## Backups and recovery

- Neon keeps point-in-time history (6 hours on the free plan for this project). To recover: create a branch from a time before the problem in the Neon console, check it, then point `DATABASE_URL` at it or restore.
- Before risky changes, create a Neon branch (instant copy) as a snapshot.
- Uploaded files in Blob are not versioned. Deleting a page removes only the database row; the file stays in Blob.

## Rollback

- App: in Vercel, promote the previous deployment (instant).
- Database: migrations are additive, so the previous app version keeps working. If data is damaged, restore from a Neon branch (above).

## Monitoring

- `/api/health` for uptime checks (DB reachability).
- Vercel runtime logs for errors. Server errors are logged with a digest code that the error page shows to users.

## Common tasks

- Make someone an admin without the UI: `DATABASE_URL=... npm run db:set-role -- person@example.com admin`
- Seed the confirmed IPs on a new database: `npm run db:seed` (safe to re-run).

## Known limits

- Free Neon plan: 0.5 GB storage, compute scales to zero (first request after idle is slower).
- Vercel Hobby plan is for non-commercial use; a paid plan is needed before selling anything.
- Episode video is served as a single file (no adaptive streaming).
- No password reset email yet.
