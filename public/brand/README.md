# Toon Comics & Studio brand kit (concepts, v1, 2026-10-29)

Status: proposal. The studio name and trademark search are still open, so every logo here is a concept.

Full brand book, tokens and live components: https://claude.ai/artifact/CX9RQhp8BfARL7FB839CnT

## How to use it in a site or app

```html
<link rel="stylesheet" href="brand/tokens/tokens.css">     <!-- colours, type, spacing, fonts -->
<link rel="stylesheet" href="brand/tokens/components.css"> <!-- tn- components -->
```

- `tokens.css` defines CSS custom properties for two themes: `paper` (default) and `late-show` (dark; follows the OS, or force it with `data-theme="late-show"` on `<html>`). Fonts load from `brand/fonts/` (relative path `../fonts/`).
- Type classes: `.display-xl .display-l .display-m .display-s .sfx .body-l .body .body-strong .caption .label .script`.
- Components: `tn-btn` (+`--primary --danger --ghost`), `tn-field`, `tn-badge` (+`--new --live --info --warn`), `tn-rating`, `tn-bubble` (+`--shout`), `tn-caption` (+`--scar`), `tn-issue`, `tn-episode`, `tn-lockup`. Markup examples are in the artifact's component cards.
- IP theming: wrap a section in `.tn-ip--volcano-racers` to switch `--ip-accent` to magma and `--ip-ground` to basalt. `.tn-ip--starfall` is reserved for IP #2.

## Key rules

- `toon-red` is for logos and display type 24px+. Links and primary buttons use `action` (passes AA).
- `scar` only for ratings, content warnings, destructive actions.
- Every object gets an ink outline (`--line`) and a hard offset shadow (`--shadow-toon`). No blurred shadows, no gradients.
- Show a rating tag (TV-MA / 18+) near every title and before any buy or play button.

## Files

- `logos/`: 5 studio and 3 Volcano Racers SVGs (text outlined, no fonts needed) + `logo-concepts-sheet.png`.
- `fonts/`: Bowlby One, Bangers, Work Sans (variable), Courier Prime. All SIL Open Font Licence.
- `tokens/`: `tokens.json` (source), `tokens.css`, `components.css`, `components-preview.png`.
