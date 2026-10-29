# Tune Comics & Studio platform

The web app where Tune Comics & Studio publishes its comics and its animated shows. (The repo keeps its working name, toon-platform.)

- **Readers** browse every series (IP), read comic issues page by page or as a scroll, watch episodes, follow series, and pick up where they left off.
- **Studio editors** create series, comic sagas and show seasons, upload pages and episode video, reorder pages, and publish now or on a schedule.
- **Admins** also manage people's roles and see the activity log.

Stack: Next.js 16 (App Router, server actions), Postgres (Neon), Vercel Blob for uploads, plain CSS on the studio brand kit (`public/brand`).

## Run it locally

```bash
cp .env.example .env.local          # set DATABASE_URL, ADMIN_EMAILS
npm install
npm run db:migrate                  # uses DATABASE_URL
npm run db:seed                     # adds Volcano Racers and Starfall as draft series
npm run dev
```

Sign up with an email listed in `ADMIN_EMAILS` to get the admin role. Without `BLOB_READ_WRITE_TOKEN`, uploads are saved to `.data/media` (development only).

## Checks

```bash
npm run check                       # typecheck + lint + unit tests (needs TEST_DATABASE_URL or local Postgres on :5433)
npm run build
npm run test:e2e                    # browser journeys against a fresh local database
```

## Docs

- [docs/INVENTORY.md](docs/INVENTORY.md): scope inventory and coverage matrix (what's built, verified, open)
- [docs/RUNBOOK.md](docs/RUNBOOK.md): environments, deploy, migrations, backups, rollback
- [docs/DECISIONS.md](docs/DECISIONS.md): decisions made and decisions still open
- [public/brand/README.md](public/brand/README.md): brand kit usage rules
