# Community and fan comic creator

Readers make their own comics (from finished pages or panel layouts), letter them, post and share them, make spinoffs of the studio's series, and pitch ideas. Others follow, like, comment and report. Studio editors moderate.

Asked for by the owner on 2026-10-29 ("a community feature ... create comics ... users create their own and share and post", then "create new ideas and spinoffs from existing comics"). Card battles are a separate thread.

## Hard rules built in

- **Nothing is drawn over the art.** Panels are images only. Dialogue, thoughts, captions and sound effects live in a strip under their panel (`.letter-strip`). The e2e test checks every panel image with `expectNothingOver` and that the strip starts below the image.
- **18+ only.** Joining needs the existing 18+ signup; reading community pages needs the age gate. Every post is rated Mature or Teen so a future teen line can filter (`maxRatingFor`, `ratingsVisibleTo` in `src/lib/domain/community/shared.ts`).
- **Members own their originals**; the studio gets a licence to host and show them while they're up. Fan works of studio IPs are labelled "not official canon". Draft terms: `/community/guidelines` (version `TERMS_VERSION`), **pending legal review**.
- **Panels can only use images the author uploaded** to their own folder (`community/<userId>/`), through a separate reader-level upload (`/api/community/upload`: images only, file bytes sniffed, 10 MB, 300 a day). The editor-only studio upload is unchanged.

## Inventory

| ID | Area | Role | Screen / route | Behaviour | Status | Evidence |
|---|---|---|---|---|---|---|
| C1 | Profile | Member | `/create/profile` | Handle (unique, reserved names blocked), bio, picture; must accept current guidelines/terms; re-accept when `TERMS_VERSION` changes | Verified | unit; e2e |
| C2 | Profile | Anyone 18+ | `/u/[handle]` | Public profile, follower counts, their comics and ideas, follow, share, report | Built | unit (follow counts) |
| C3 | Creator | Member | `/create` | My comics (draft/published/moderation state), my ideas, start a comic (title, rating, spinoff of) | Verified | e2e |
| C4 | Creator | Member | `/create/[id]` | Editor: details, cover, pages; 8 panel layouts; upload art per panel; alt text; lettering lines (dialogue, thought, caption, SFX) with speaker; reorder/delete pages; preview as a reader; save with stale-edit protection; leave-page warning | Verified (layout, upload, lettering, save) / Built (reorder, preview, cover) | e2e; unit (conflict, image ownership, panel count) |
| C5 | Creator | Member | Publish / unpublish / delete | Publish needs a title and art in every panel; live comics must stay complete; delete needs the exact title | Verified | unit; e2e publish |
| C6 | Spinoffs | Member | Creator, idea form, series page | Link a comic or idea to a published studio series; "Fan spinoffs of …" filter; series page links | Verified (domain) / Built (series page links) | unit |
| C7 | Ideas | Member | `/ideas/new`, `/ideas/[id]` | Pitch a story or spinoff; like, comment, share, report; "Turn it into a comic" | Verified | e2e create; unit |
| C8 | Feed | Anyone 18+ | `/community` | Fan comics, ideas, following tabs; search; filter by series | Verified (comics, following) | e2e |
| C9 | Reading | Anyone 18+ | `/c/[id]` | Pages in layout, lettering strips under panels, content notes, rating, spinoff label, share link with preview image | Verified | e2e incl. nothing-over-art |
| C10 | Social | Signed in | Like, follow | Idempotent like/unlike and follow/unfollow; no self-follow; only on posts the viewer can see | Verified | unit; e2e |
| C11 | Social | Member | Comments | Post (rate-limited), delete own; moderators delete any | Verified | unit; e2e |
| C12 | Notifications | Signed in | `/community/notifications`, header count | Likes, comments, follows, moderation decisions, approvals; mark all read | Verified | unit; e2e |
| C13 | Reports | Signed in | Report on comics, ideas, comments, profiles | Reasons incl. child safety; one open report per person per item; child-safety report hides at once; N distinct reports hide automatically | Verified | unit; e2e |
| C14 | Moderation | Editor | `/studio/community` | Report queue (child safety first), approval queue, hidden/removed list, paused members; hide, remove, restore, approve, dismiss with a note to the author; pause posting 1/7/30 days or indefinitely; staff can't be paused | Verified (hide, restore) / Built (others in UI) | unit all decisions; e2e hide + restore |
| C15 | Rules | Admin | `/studio/community` | Approve-before-live on/off; accept fan spinoffs on/off; auto-hide threshold | Verified (domain) / Built (UI) | unit |
| C16 | Audit | Admin | Activity log | Profile, post, report and moderation actions are logged | Built | `audit()` calls |

## Decisions

| # | Decision | Why |
|---|---|---|
| CD1 | Fan comic pages are one validated JSON document per comic (`fan_comics.pages`) | The editor saves the whole comic at once with a version check; no partial-save states. |
| CD2 | Lettering is structured text, never image overlays | Owner's rule: no text or UI over art. Also makes lettering searchable and readable by screen readers. |
| CD3 | Moderation policy is settings, not code | The owner's answer on "live now vs approve first vs originals only" flips a setting. Default: live now, fan works accepted, auto-hide at 3 reports. |
| CD4 | Sexually explicit content is not allowed, even though the site is 18+ | Studio lane is TV-MA/R, not explicit; explicit UGC brings legal duties (age verification, record-keeping) the studio hasn't taken on. Owner can revisit. |

## Open (owner's call)

| # | Question | Effect |
|---|---|---|
| CO1 | House rules card: live now with fan works / approve every post / originals only | Sets the two switches in Studio → Community. |
| CO2 | Legal review of the draft guidelines and creator terms | Needed before public launch. |
| CO3 | Teen line: will teens get accounts? | Would need an age field at signup and teen-safe defaults (no DMs, Teen-only feed). The rating filter is ready. |
| CO4 | Uploaded files stay in storage after a post is deleted or removed | Same as studio uploads (RUNBOOK). A cleanup job could delete them. |
| CO5 | Automated image scanning (e.g. hash matching for child-safety material) | Not built; needs a provider such as PhotoDNA or a Cloudflare CSAM scanning tool before opening to the public. |

## Tables (migration 004)

`community_settings`, `profiles`, `user_follows`, `fan_comics`, `ideas`, `likes`, `comments`, `reports`, `community_notifications`, `community_uploads`. Additive only.
