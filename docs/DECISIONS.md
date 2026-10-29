# Decisions

## Made (reversible)

| # | Decision | Why |
|---|----------|-----|
| D1 | One web app for readers, viewers and the studio admin | Smallest thing that covers publishing both comics and shows; no native apps until asked. |
| D2 | Next.js 16 on Vercel, Postgres on Neon (free plan), uploads on Vercel Blob | All three were already connected to the owner's accounts; free tiers cover early use. |
| D3 | Own email + password accounts (scrypt hashes, server-side sessions in Postgres, httpOnly cookie) | No extra vendor; sessions can be revoked (disable account ends sessions). |
| D4 | Data model: Series (one IP) → Volume (a comic saga or a show season) → Release (an issue or an episode) → Pages | Matches the slate: an IP has both comics and a show. Multiple IPs supported (Volcano Racers, Starfall). |
| D5 | Roles: reader, editor, admin. Bootstrap admins via `ADMIN_EMAILS`. At least one active admin is always kept. | Covers the studio team without inventing more roles. |
| D6 | Mature-content gate: signup requires an 18+ confirmation; visitors confirm once per browser | Rating lane is TV-MA / mature by default (studio doc). |
| D7 | A release is public only when it is published, its publish time has passed, and its series is published | Lets the studio stage a whole IP before launch and schedule drops without a cron job. |
| D8 | Episodes play an uploaded MP4/WebM, or a YouTube/Vimeo link | Lets the studio start with hosted video without a paid video service. |
| D9 | Brand kit CSS/fonts/logos served verbatim from `public/brand` | A new brand version drops in unchanged. |
| D10 | The founder's Brand & Design System 1.0 is the source of truth (kit v3) | Logos are the approved raster files: wordmark PNG on light only (≥240px), social icon on dark. The tune-*.svg drafts are not used; `tune-icon-tile.svg` is an interim favicon until a 16px emblem exists. Form states follow the guide: busy buttons keep width, errors are inline with focus on the first invalid field, success sits in a polite live region. |
| D10 | Payments, store, subscriptions: **not built** | Not confirmed by the owner. |

## Open (owner's call)

| # | Question | Effect on the platform |
|---|----------|------------------------|
| O1 | Release format: single issues, digital-first webcomic, trades, or a mix | The reader already handles page-by-page and scroll. Trades would add a "collection" type. |
| O2 | Free, paid per issue, or subscription | Decides whether to add payments (Stripe is connected but its sign-in has expired). |
| O3 | Trademark search for "Tune Comics & Studios" | The name and logo are set (2026-10-29, brand kit v3); a trademark search is still pending before public launch. |
| O4 | TV season plan (bible: S1 = issues 1–15, S2 = 16–29, S3 = Apex Saga) | No show seasons are seeded until it's approved. |
| O5 | Video hosting at scale (Blob files vs. a streaming service like Mux) | Blob is fine for a few episodes; adaptive streaming would need a paid service. |
| O6 | Merge the Volcano Racers newsletter list (Neon project `volcano-racers-newsletter`) into platform accounts | Would add an audience/subscribers table and email sending. |
| O7 | Custom domain | Needs a domain purchase (cost) and DNS. |
