# Tune Comics & Studios brand kit (v3)

Follows **Tune Brand & Design System 1.0** (October 2026), the founder's guide in `guide/`. That guide is the source of truth. The design system with the full brand book and live previews in both themes: https://claude.ai/artifact/CX9RQhp8BfARL7FB839CnT

Status: naming, final logo construction and trademark availability are still open.

## What's here

- `guide/`: the founder's guide as `brand-guide.html` and `Tune-Brand-Design-System.pdf`.
- `logos/`: the approved artwork (raster concept art).
  - `transparent-wordmark.png`: primary signature, on ivory or white only. Min 240 CSS px wide.
  - `social-icon.jpg`: the folded T on its charcoal ground. Social, stamps, opening and end frames. Min 32 CSS px. Not for tiny UI icons.
  - `cinematic-banner.jpg`: hero and title visual; the reference for dark layouts.
  - `volcano-racers-*`: IP #1 marks, unchanged.
  - `draft-vectors/`: my earlier SVG rebuilds. **Not approved** (the guide forbids rebuilding the wordmark from a similar serif). `tune-icon-tile.svg` may serve as an interim favicon until the 16 px emblem exists.
- `concepts/brand-board.jpg`: concept presentation only.
- `fonts/`: Courier Prime only (studio extension for screenplay excerpts). Display and UI use system fonts.
- `tokens/tokens.json` is the source; `tokens.css` is generated from it; `components.css` holds the `tn-` classes; `components-preview.png` shows both themes.
- `archive-tune-v2/` and `archive-toon-v1/`: superseded. Don't build on them.

## Using it

1. Link `tokens/tokens.css`, then `tokens/components.css`.
2. Themes: `data-theme="ivory"` (paper, default) or `data-theme="noir"` (ink). Without it, the page follows the system scheme.
3. Wrap content in `.tn-container`; lay out with `.tn-grid` (4/8/12 columns).
4. IP content: `.tn-ip--volcano-racers` sets `--ip-accent` to magma and `--ip-ground` to basalt. `.tn-ip--starfall` is reserved.
5. Endorse IP marks in words: "A Tune Comics & Studios original" in eyebrow style. No emblem at that size.
6. On dark backgrounds, don't use or invert the transparent wordmark. Use the social icon or banner.

## Changes from v2

- Palette: ink `#161616`, paper `#F4F0E8`, champagne `#D4C1A0`, bronze `#80603A`, muted `#65615B`, line `#C8C2B8`, success `#326448`, error `#A52A37`, focus `#005FCC` (noir focus `#4C9AFF`). Token names are unchanged; `--accent` is bronze on ivory and champagne on noir.
- Fonts: Playfair Display and Montserrat are dropped. `--font-display` is Georgia; `--font-sans` is the system stack.
- Type classes are now prefixed: `.tn-display`, `.tn-h1`, `.tn-h2`, `.tn-h3`, `.tn-body`, `.tn-body-strong`, `.tn-supporting`, `.tn-eyebrow`, `.tn-script` (v2 used bare names such as `.body`).
- Focus: 3 px blue ring, 4 px offset (was 2 px gold).
- Buttons: sentence case, 48 px min height, primary hover `#38352F`; new `--danger`, `--link`, `[disabled]`, `[aria-busy]` states.
- New components: `.tn-card`, `.tn-notice` (`--success`, `--error`), `.tn-container`, `.tn-grid`. Fields use a 2 px error border with `aria-invalid`.
- Shadows: `--shadow-1` is now `none`; `--shadow-2` is for dialogs only.
- New tokens: `--bronze`, `--success`, `--on-success`, `--secondary-hover`, `--action-pressed`, `--stroke-focus`, `--stroke-notice`, `--duration-micro`, `--duration-page`, `--content-max`, `--control-min`, `--gutter-*`.
