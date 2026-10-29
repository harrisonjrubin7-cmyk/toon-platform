# Volcano Racers landing page (preview)

One-page site with a newsletter sign-up. Sign-ups are stored in Neon Postgres
(project `volcano-racers-newsletter`, table `newsletter_signups`).

- `index.html`, `styles.css`, `signup.js`: the page and the form script
- `thanks.html`: shown after a sign-up when JavaScript is off
- `api/subscribe.js`: POST /api/subscribe saves the sign-up and sends the welcome email
- `api/unsubscribe.js`: /api/unsubscribe?token=… (GET confirm page, POST unsubscribe, one-click from mail apps)
- `lib/email.js`: Resend sender, welcome email text, link base URL
- `netlify/functions/*.mjs` + `netlify/adapter.mjs`: Netlify wrappers for the same handlers
- `db/`: SQL migrations (002 adds unsubscribe tokens, welcome tracking and the vr_* functions)
- `test/`: `npm test` runs the handler tests

## Brand

`brand/` is a copy of the Tune Comics & Studio brand kit v3 (Tune Brand & Design System 1.0): tokens.css, components.css, tokens.json, the Courier Prime fonts, the Volcano Racers wordmark, and the draft tune-icon-tile.svg used only as an interim favicon. The Tune endorsement is text only, per the guide. Trademark search is still pending. Re-copy from `/mnt/project-files/brand/` when the kit changes. Fonts are self-hosted, so the page makes no third-party requests.

## Config
- `DATABASE_URL` (secret): connection string for role `vr_signup_writer`. It has no table access;
  it can only call `vr_subscribe`, `vr_mark_welcome_sent` and `vr_unsubscribe`, so it cannot read,
  change or delete the list.
- `RESEND_API_KEY` (secret) and `EMAIL_FROM` (e.g. `Tune Comics & Studio <news@your-domain>`, on a
  domain verified in Resend): same provider as the platform app. Without both, sign-ups are still
  saved and no welcome email is sent.
- `SITE_URL` (optional): base for unsubscribe links. Netlify's `DEPLOY_PRIME_URL`/`URL` are used otherwise.

Read the list in the Neon console SQL editor:
`select email, created_at, welcome_sent_at, unsubscribed_at from newsletter_signups order by created_at desc;`
Anyone with `unsubscribed_at` set must be left out of every send. Signing up again does not resubscribe them.

## Deploy
This site lives in `sites/volcano-racers/` of the toon-platform repo. When importing the repo on
Netlify or Vercel, set the base / root directory to `sites/volcano-racers`.

- Vercel: `vercel deploy` (preview). Set DATABASE_URL for Preview.
- Netlify: `netlify deploy` (draft) or `netlify deploy --prod`. Set DATABASE_URL in site env.

## Launch checklist
Remove the `noindex` robots meta tags and the X-Robots-Tag header, add a privacy note, set the
Resend env vars, and add the studio's postal address to the welcome email (CAN-SPAM).
