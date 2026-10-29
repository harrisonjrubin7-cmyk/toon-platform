/**
 * Page layouts for the fan comic creator. Each layout fixes how many panels a page has
 * and how they sit on the grid. Lettering never sits on a panel: it goes in a strip
 * directly under the panel it belongs to.
 */
export const LAYOUTS = {
  full: { label: "One full page", panels: 1, cols: 1 },
  "two-stack": { label: "Two panels, stacked", panels: 2, cols: 1 },
  "two-across": { label: "Two panels, side by side", panels: 2, cols: 2 },
  "three-stack": { label: "Three panels, stacked", panels: 3, cols: 1 },
  "three-across": { label: "Three-panel strip", panels: 3, cols: 3 },
  "big-top": { label: "One wide, then two", panels: 3, cols: 2 },
  grid4: { label: "Four-panel grid", panels: 4, cols: 2 },
  grid6: { label: "Six-panel grid", panels: 6, cols: 2 },
} as const;

export type LayoutKey = keyof typeof LAYOUTS;
export const LAYOUT_KEYS = Object.keys(LAYOUTS) as LayoutKey[];

export const LETTER_KINDS = {
  dialogue: "Dialogue",
  thought: "Thought",
  caption: "Caption",
  sfx: "Sound effect",
} as const;
export type LetterKind = keyof typeof LETTER_KINDS;

export type Letter = { kind: LetterKind; speaker: string; text: string };
export type Panel = { imageUrl: string | null; alt: string; lettering: Letter[] };
export type FanPage = { layout: LayoutKey; panels: Panel[] };

export const LIMITS = { pages: 60, letters: 12, text: 400, speaker: 40, alt: 300 };

export const emptyPanel = (): Panel => ({ imageUrl: null, alt: "", lettering: [] });

/** Changes a page's layout, keeping the panels that still fit and adding empty ones. */
export function relayout(page: FanPage, layout: LayoutKey): FanPage {
  const n = LAYOUTS[layout].panels;
  const panels = page.panels.slice(0, n);
  while (panels.length < n) panels.push(emptyPanel());
  return { layout, panels };
}

/** Panel n spans the full row in the "big-top" layout. */
export const spansRow = (layout: LayoutKey, index: number) => layout === "big-top" && index === 0;
