# Volcano Racers landing page (preview)

One-page site with a newsletter sign-up. Sign-ups are stored in Neon Postgres
(project `volcano-racers-newsletter`, table `newsletter_signups`).

- `index.html`, `styles.css`, `signup.js`: the page and the form script
- `thanks.html`: shown after a sign-up when JavaScript is off
- `api/subscribe.js`: POST /api/subscribe (Vercel function; also used by Netlify)
- `netlify/functions/subscribe.mjs`: Netlify wrapper for the same handler
- `test/`: `npm test` runs the handler tests

## Brand

`brand/` is a copy of the Tune Comics and Studio brand kit v3 (Tune Brand & Design System 1.0): tokens.css, components.css, tokens.json, the Courier Prime fonts, the Volcano Racers wordmark, and the draft tune-icon-tile.svg used only as an interim favicon. The Tune endorsement is text only, per the guide. Trademark search is still pending. Re-copy from `/mnt/project-files/brand/` when the kit changes. Fonts are self-hosted, so the page makes no third-party requests.

## Config
`DATABASE_URL` (secret): connection string for the insert-only role `vr_signup_writer`.
That role can add sign-ups but cannot read, change or delete them. Read the list in
the Neon console (SQL editor: `select email, created_at from newsletter_signups order by created_at desc;`).

## Deploy
This site lives in `sites/volcano-racers/` of the toon-platform repo. When importing the repo on
Netlify or Vercel, set the base / root directory to `sites/volcano-racers`.

- Vercel: `vercel deploy` (preview). Set DATABASE_URL for Preview.
- Netlify: `netlify deploy` (draft) or `netlify deploy --prod`. Set DATABASE_URL in site env.

## Launch checklist
Remove the `noindex` robots meta tags and the X-Robots-Tag header, add a privacy note,
and pick an email tool (sending is not set up yet; this only collects addresses).
