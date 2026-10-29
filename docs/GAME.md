# Volcano Racers card game

Status 2026-10-29: first playable version, behind a test-mode store. Rules, card numbers, prices and odds are proposals for the owner to approve.

## What's built

| Area | Where | Notes |
|---|---|---|
| Card catalog | `src/lib/game/cards.ts`, `src/lib/game/data/vr1-print.json` | The JSON is a copy of `/mnt/project-files/trading-cards/cards.json` (owned by the trading cards work). Ids are `vr-<print id>`. Game numbers are derived from printed stats. Cards 21–23 are Full Art secret rares; 24–29 are digital-only tricks. Re-copy the JSON when the print set changes. |
| Rules engine | `src/lib/game/engine.ts` | Pure and deterministic (seeded). Runs in the browser for computer matches; the same code will run on the server for player-vs-player. |
| Computer opponent | `src/lib/game/ai.ts`, `src/lib/game/decks.ts` | Three prebuilt teams. |
| Starter deck | `ensureStarter` | 20 cards + a ready deck, once per account, free. |
| Collection / portfolio | `/play/collection`, `/play/collectors/[id]` | Completion, rarity counts, parallels, collector points. Sharing is opt-in. |
| Decks | `/play/decks` | 20 cards, 6+ racers, max 2 copies, 1 per Legendary character; only owned cards (server-checked). Stale-save protection. |
| Packs | `/play/packs`, `/play/packs/open/[id]`, `/play/packs/odds/[id]` | Odds are shown per slot, per rarity and per card before buying. Each pack stores the odds it was sold with. Opening is server-side (crypto RNG) and idempotent. Scar foils are numbered 1–50 per card across all players. |
| Store safeguards | `startPurchase` | Signed-in 18+ accounts, daily spend cap, country block list, pack must be on sale. |
| Payments | `src/lib/payments/stripe.ts`, `/api/payments/stripe` | Stripe Checkout over REST. Live keys are refused unless `PAYMENTS_LIVE=true`. Webhook is signature-checked and fulfilment runs once. |
| Studio | `/studio/cards` (admin) | Price, on-sale switch, odds JSON, free pack grants, sales report. All logged in the activity log. |

## Not built / open

- **Rulebook choice (owner).** The printed v2 cards show Pokémon-style moves; the digital game uses race rules. One rulebook should cover both.
- **Paid random packs (owner + legal).** Loot-box rules vary by country. Decide the model and get a legal check before live sales.
- **Player vs player.** Planned: server-held matches using the same engine (the `matches` table already has room for it).
- **Marketplace, trading, resale, cash-out, blockchain.** Not built. Needs an owner decision; big legal and cost questions.
- **Rewards from the other Volcano Racers games.** Not built; would need those games to call a server endpoint.

## Configuration

| Variable | Default | Meaning |
|---|---|---|
| `PAYMENTS_PROVIDER` | `off` | `off` (no sales), `test` (free fake purchases, for demos and e2e), `stripe` |
| `STRIPE_SECRET_KEY` | — | `sk_test_…`. A `sk_live_` key is refused unless `PAYMENTS_LIVE=true`. |
| `STRIPE_WEBHOOK_SECRET` | — | From the Stripe webhook pointing at `/api/payments/stripe` |
| `PAYMENTS_LIVE` | unset | Only set to `true` after the owner approves live sales |
| `PACKS_DAILY_CAP_CENTS` | `5000` | Per-player spend cap over 24 hours |
| `PACKS_BLOCKED_COUNTRIES` | `BE` | Comma-separated ISO codes, read from Vercel's `x-vercel-ip-country` header. Unknown country is allowed. |
