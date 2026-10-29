# Tune Comics & Studios brand kit (v2)

The studio identity in charcoal, ivory and champagne, from the founder's Tune concepts (2026-10-29). The design system with the full brand book and live component previews is at https://claude.ai/artifact/CX9RQhp8BfARL7FB839CnT.

Status: the name is set; a trademark search is still pending. The SVGs are the editable vector masters.

## What's here

- `logos/`: `tune-wordmark`, `tune-icon` (sculptural T), `tune-lockup`, `tune-icon-tile` (app icon, favicon), `tune-icon-mono` (foil, single ink). Each colour mark has an `-on-dark` file. `volcano-racers-*` are IP #1's marks, unchanged. `tune-logo-sheet.png` shows them all.
- `concepts/`: the founder's four PNG renders (banner, sculptural T, wordmark, brand board). Hero and reference art, not logo files.
- `fonts/`: Playfair Display (display), Montserrat (UI and body), Courier Prime (script). All OFL.
- `tokens/tokens.json`: source of truth. `tokens/tokens.css` is generated from it (fonts load from `../fonts/`). `tokens/components.css` holds the `tn-` component classes. `components-preview.png` shows them in both themes.
- `archive-toon-v1/`: the earlier Toon kit, kept for reference only. Don't build on it.

## Using it

1. Link `tokens/tokens.css`, then `tokens/components.css`.
2. Themes: `data-theme="ivory"` (light, default) or `data-theme="noir"`. Without the attribute, the page follows the system colour scheme.
3. Primary buttons are solid charcoal on ivory (`--action`). Champagne (`--champagne`) is decorative only: it fails contrast as text. Gold text and links use `--accent`.
4. Wrap IP content in `.tn-ip--volcano-racers` to switch `--ip-accent` to magma and `--ip-ground` to basalt. `.tn-ip--starfall` is reserved.
5. Endorse IP marks with "A Tune Comics & Studios original" beside the T icon.

## Changes from v1 (Toon)

- Themes renamed: `paper` → `ivory`, `late-show` → `noir`.
- Removed tokens: `--toon-red`, `--sun`, `--sky`, `--on-bright`, `--shadow-toon`, `--shadow-toon-l`, `--shadow-press`, `--shadow-ink`, `--stroke-thin`, `--stroke-heavy`, `--font-sfx`. Use `--champagne`/`--accent`, `--shadow-1`/`--shadow-2`, `--stroke-hair` and hairlines instead. New: `--champagne`, `--accent`, `--line-input`, `--stroke-hair`, `--radius-s`.
- Fonts: Bowlby One, Bangers and Work Sans are out; Playfair Display and Montserrat are in.
- Class prefix stays `tn-`.
