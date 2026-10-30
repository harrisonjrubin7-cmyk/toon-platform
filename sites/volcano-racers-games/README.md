# Volcano Racers games

Browser games starring the Volcano Racers cast. A Tune Comics & Studio original.
Static site: plain HTML, CSS and JavaScript modules. No build step, no server, no accounts.

## The five games

| # | Game | Where it lives | Status |
|---|------|----------------|--------|
| 1 | Card Battle | Platform app, `/play` (branch `claude/project-thread-3vgqe2`) | Built in its own thread. Needs a platform account because the card collection is stored on the server. The hub links to it once `CARD_BATTLE_URL` in `shared/config.js` is set. |
| 2 | Circuit Rush | `games/circuit-rush/` | Playable. Top-down racing: pick Quackers #02, Joe #07, Pip #11, Duke #44 or Wren #19 and race a three-track cup against the other four and Team GearCorp. |
| 3 | Blaze's Run | `games/blazes-run/` | Playable. Side-on endless runner on foot. |
| 4 | Ember's Flight | `games/embers-flight/` | Playable. Side-on flier: rescue the hatchlings, burn drones, keep the fire lit. |
| 5 | Pit Crew | `games/pit-crew/` | Playable. Repair puzzle that fixes the damage cars took in Circuit Rush. |

### How "toon physics, real scars" shows up

- **Circuit Rush:** cars bounce off walls with a BOING and pop back from a KA-BOOM, but every dent is saved on that car. Damage lowers top speed (a wrecked car runs at 65%) and carries from race to race and between visits, until it is repaired.
- **Pit Crew:** the only free way to fix that damage. Jobs come from the car's real scars (lava scorches become scrubbing jobs, wall hits become dents).
- **Blaze's Run:** hits flatten her into a rug and she pops back, but each one strains her bad knee. Three and she has to stop.
- **Ember's Flight:** his colour fades through four stages as his fire goes, with the grey chest patch from Issue #4.

Canon details used: Duke's car pulls left 4 degrees, Joe's tyre falls off when the car is badly damaged ("it's a style"), Pip's pop-out wings, Quackers' backfire launch and soot gag, Blaze leaving her own shadow panting behind at top speed, Gearlock's logo-covered airship and drones, the no-logo Cinder Isle cars against chrome GearCorp.

## Shared player file

All four games on this site share one profile in the browser (`localStorage` key `vr.player`, see `shared/profile.js`): racer name, coins, damage and scars for each team car, and best scores. The hub shows it and can wipe it.

Coins are for fun only. Anyone can edit browser storage, so nothing of value (cards, purchases) is ever granted from it. Rewarding trading cards from these games would need the games to move into the platform and call a server endpoint (agreed with the card battle thread; not built).

## Art

All art is **placeholder**: characters and cars are drawn in code with simple shapes in the colours approved in "Volcano Racers: Cast and Car Art Briefs" (29 Oct 2026). Harrison is the artist; swap in the real designs by replacing the drawing functions in `shared/draw.js` (cars), `games/blazes-run/render.js` (Blaze), and `games/embers-flight/render.js` (Ember, hatchlings, airship) with sprite images.

## Run it locally

```
cd sites/volcano-racers-games
npm run serve        # http://127.0.0.1:5173/
npm test             # unit tests (node --test), no install needed
npm run e2e          # browser smoke test with Playwright + Chromium; screenshots in e2e/screenshots/
```

The e2e script needs Playwright and Chromium installed globally (they are on the Claude cloud machines). It serves the site with the same Content Security Policy as production and fails on any console error.

## Deploy

Any static host works; there is no build step and no server.

- **Vercel (the studio's host):** add a project from this repo with **Root Directory** `sites/volcano-racers-games`, framework "Other", build and install commands empty. `vercel.json` sets the output folder and the same security headers as production (CSP with no inline code). `.vercelignore` keeps the tests out of the deploy. The platform app then links to that URL.
- **Netlify (alternative):** import the repo, base directory `sites/volcano-racers-games`, build command empty. `netlify.toml` sets the headers.

Nothing is deployed yet.

Rollback: promote the previous deployment (Vercel "Instant Rollback", or Netlify "Publish deploy" on an older one). There is no server state; player files live in each browser.

## Art rule

No badge, number, label or control may sit over a title or over the art. The game HUD is a strip above the play area, the touch buttons a strip below it, Pit Crew's job buttons a tray under the car (hovering one lights its spot on the car), and menus are opaque screens shown only while the game is paused. `npm run e2e` checks that nothing visible overlaps a game canvas or a hub card's art. Comic sound-effect words (BOING, CLANK) are drawn into the scene as part of the art.

## Controls and accessibility

- Keyboard everywhere: arrows or WASD, Space for the special/jump/fire, Esc to pause. On-screen buttons on touch devices.
- Menus, results and garage screens are real HTML (buttons, tables, live-region announcements for laps, hits and results), not drawn on the canvas. Focus moves into each panel when it opens.
- Pit Crew jobs are buttons in a tray under the car; every tool works with the keyboard (Space/Enter, hold Space, arrow keys).
- Screen shake is off when the system asks for reduced motion.
- The games pause when the tab is hidden.

## Decisions made here (reversible)

- Games 2 to 5 are a separate static site rather than routes in the platform app, so they can ship before the platform is deployed and add no load to it. They can move into the platform's `public/` folder unchanged later.
- The hub carries an 18+ label to match the studio's mature rating lane, but the games themselves show no gore or adult themes (no pills, no drinking); damage is dents, soot and scars. A one-time, self-declared 18+ check runs on first visit (`shared/age-gate.js`, localStorage key `vr.ageOk`).
- No sound yet.
