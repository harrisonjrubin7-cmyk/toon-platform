# Scope inventory and coverage matrix

Status as of 2026-10-29. Source of truth for scope: the studio description doc (Oct 29, 2026), the owner's request ("a platform to publish both shows and books"), and owner messages in the project (Starfall is IP #2).

Status words: **Verified** = built and covered by an automated test that passed. **Built** = built, checked by hand or by type/lint only. **Open** = not built, waiting on a decision. **Blocked** = waiting on access.
Deployment: nothing is deployed yet (see RUNBOOK; blocked on a GitHub repo).

## Systems

| System | Purpose | Status |
|---|---|---|
| Reader web app | Public catalog, comic reader, episode player, account, library | Built, verified (below) |
| Studio admin (`/studio`) | Create, upload, publish, schedule; people and roles; activity | Built, verified (below) |
| Shared core | Accounts, sessions, roles, Postgres schema, media rules, audit log | Built, verified |
| Brand kit | Tune Comics & Studios kit v3, following the founder's Brand & Design System 1.0 (Georgia + system sans, ink/paper/champagne, 3px focus ring, 48px controls, no UI shadows; approved raster logos, interim SVG favicon) | Applied and verified 2026-10-29 (tsc, eslint, vitest 22/22, build, Playwright 8/8, DOM checks per theme) |
| Landing page + newsletter | Separate site from the "Launch Volcano Racers landing page" thread | Not part of this app (O6) |
| Store / payments | Not confirmed | Open (O2) |
| Native apps | Not confirmed | Not planned; the site is responsive |

Delivery environments: modern desktop and mobile browsers. Tested in Chromium (desktop 1280px, mobile 390px with no sideways scroll).

## Roles

| Role | Can | Can't |
|---|---|---|
| Visitor | Browse published series, issues, episodes; search; read and watch after the 18+ gate | Save progress, follow, open the studio, upload |
| Reader | Everything a visitor can, plus save progress, follow series, library | Open the studio, upload, change anything published |
| Editor | Everything a reader can, plus create/edit/delete series, sagas, seasons, issues, episodes; upload pages, covers, video; publish, schedule, unpublish; preview drafts | Change roles, disable accounts, view the activity log |
| Admin | Everything an editor can, plus change roles, disable/enable accounts, view the activity log | Demote or disable the last active admin; disable themselves |

All checks run on the server (domain layer), not only in the UI.

## Data (canonical entities)

`users` · `sessions` · `series` (an IP, with theme + logo) · `volumes` (comic saga or show season) · `releases` (issue or episode, with status, publish time, version) · `pages` (ordered images) · `progress` (per user, per release) · `follows` · `audit_log` · `schema_migrations`. Uploaded files live in Vercel Blob (production) or `.data/media` (dev).

## Coverage matrix

| ID | Area | Role | Screen / workflow | Required behavior | Status | Evidence |
|---|---|---|---|---|---|---|
| A1 | Accounts | Visitor | `/signup` | Email, display name, 10+ char password, 18+ confirmation; field errors; duplicate email blocked (case-insensitive) | Verified | unit `accounts.test.ts`; e2e "signup validation" |
| A2 | Accounts | Visitor | `/login` | Sign in; same message for unknown email and wrong password | Verified | unit; e2e |
| A3 | Accounts | All | Sign out | Session deleted server-side and cookie cleared | Verified | unit "sessions" |
| A4 | Accounts | — | Session expiry | 30-day sessions; expired sessions rejected | Verified | unit |
| A5 | Accounts | Admin | Bootstrap admin | `ADMIN_EMAILS` signups become admin | Verified | unit; e2e |
| A6 | Accounts | Reader+ | Password reset by email: /forgot, /reset | Single-use token stored hashed, 1-hour expiry, 3 per hour per account, same answer for unknown emails, signs out every session | Verified (unit + e2e) | Delivery needs RESEND_API_KEY + EMAIL_FROM in production |
| R1 | Catalog | Visitor | `/` home | Hero, series, latest issues, latest episodes; empty states | Verified | e2e "visitor … reads" |
| R2 | Catalog | Reader | `/` home | "Pick up where you left off", "New from series you follow" | Built | unit `continueList`, `newForYou` |
| R3 | Catalog | Visitor | `/comics`, `/shows`, `/series` | Lists of published content only | Verified | e2e; unit visibility tests |
| R4 | Catalog | Visitor | `/series/[slug]` | IP look (theme + logo), rating, synopsis, sagas/seasons with releases; drafts hidden | Verified | e2e checks `.tn-ip--volcano-racers` and logo |
| R5 | Catalog | Visitor | `/search` | Finds series and releases by title/synopsis; ignores drafts; 2+ letters | Verified | unit; e2e "search?q=green" |
| R6 | Mature gate | Visitor | `/age` | Series, reader and player pages require 18+ confirmation | Verified | e2e |
| R7 | Reader | Visitor | `/read/[id]` | Page-by-page (buttons, arrow keys, tap zones) and scroll modes; mode remembered; page count; next/previous issue | Verified | e2e |
| R8 | Reader | Reader | `/read/[id]` | Saves page; resumes on reopen; marks finished on last page | Verified | e2e "resumes on page 2"; unit |
| R9 | Player | Visitor | `/watch/[id]` | Plays uploaded MP4/WebM or YouTube/Vimeo embed; next episode | Verified (embed) / Built (file) | e2e checks the YouTube embed; file playback checked by type only |
| R10 | Player | Reader | `/watch/[id]` | Saves position every 10 s and on pause; resumes; finished at 92% | Built | not covered by e2e |
| R11 | Library | Reader | `/library` | In progress, new from follows, following, finished | Verified | e2e |
| R12 | Follow | Reader | Series page | Follow / unfollow | Verified | e2e; unit |
| S1 | Studio | Editor | `/studio` | List every series with live/draft and counts | Verified | e2e |
| S2 | Studio | Editor | New / edit series | Title, web address (auto from title), tagline, synopsis, rating, look, logo, cover, order; slug unique; stale-edit protection | Verified | e2e create; unit conflict tests |
| S3 | Studio | Editor | Publish / unpublish series | Hides or shows the whole IP | Verified | e2e; unit |
| S4 | Studio | Editor | Delete series | Only when unpublished; must type exact title | Verified (domain) | unit; UI built |
| S5 | Studio | Editor | Sagas / seasons | Add (comic or show), edit, delete only when empty | Verified | e2e add; unit delete guard |
| S6 | Studio | Editor | Issues / episodes | Create with number (unique per run), title, synopsis; edit with cover; delete drafts only | Verified | e2e; unit |
| S7 | Studio | Editor | Page upload | Multi-file and drag-drop, 3 parallel uploads, file-name order, progress, retry-safe (same file not added twice), image size recorded | Verified (local storage) | e2e uploads 3 pages; unit dedupe. Blob path not yet exercised |
| S8 | Studio | Editor | Page order / delete / description | Move earlier/later and save; delete with confirm; alt text per page | Verified (order) / Built (alt) | e2e reorder; unit delete + reorder conflict |
| S9 | Studio | Editor | Episode video | Upload file (duration read automatically) or paste YouTube/Vimeo link; bad links rejected | Verified (link) / Built (file) | e2e |
| S10 | Studio | Editor | Publish / schedule / unpublish | Requires pages (issue) or video (episode); schedule in local time; warns if series is a draft; preview as a reader | Verified (publish now, unpublish, guard) / Built (schedule UI) | e2e; unit schedule |
| S11 | Admin | Admin | `/studio/users` | Search people; change role; disable/enable (ends sessions); last-admin protection | Verified | e2e; unit |
| S12 | Admin | Admin | `/studio/activity` | Last 200 changes with who/what/when | Verified | e2e; unit |
| X1 | Security | All | Upload endpoint | Editors only; type and size limits; files only from our storage accepted into records | Verified | e2e 403 for reader; unit media rules |
| X2 | Security | All | Headers | nosniff, frame-options, referrer and permissions policies | Built | `next.config.ts` |
| X3 | Ops | — | `/api/health` | Reports DB up/down | Built | used by e2e web server |
| P1 | Payments / store | — | — | Not confirmed | Open (O2) | — |
| N1 | Notifications by email | Reader / Admin | New release emails to followers; opt-out in My library and by one-click link; Studio → Email log (admin) | Outbox with dedupe (one email per reader per release), scheduled releases sent at publish time, cancelled on unpublish, retries up to 5 times | Verified (unit + e2e) | Real delivery blocked until an email provider account exists; Vercel Hobby cron runs daily, so scheduled-release emails can be up to a day late |
| M1 | Merch, games, reader app | — | — | Studio doc lists these as open scope | Open | — |
| D1 | Deploy | — | Vercel preview | App, env vars, Blob store | Blocked on GitHub repo | RUNBOOK |

## Test runs (latest)

- `npx tsc --noEmit`: no errors.
- `npx eslint src`: no problems.
- `npx vitest run`: 4 files, 31 tests passed (2026-10-29, email added).
- `npx playwright test` (Chromium, built app on :3100): 10 passed (2026-10-29).
