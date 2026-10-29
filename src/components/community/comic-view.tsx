/* eslint-disable @next/next/no-img-element -- member uploads of unknown size; plain img keeps them responsive. */
import { LAYOUTS, spansRow, type FanPage, type Letter } from "@/lib/comic-layouts";
import "./community.css";

function LetterLine({ l }: { l: Letter }) {
  if (l.kind === "sfx") return <li className="letter letter--sfx"><span className="visually-hidden">Sound effect: </span>{l.text}</li>;
  if (l.kind === "caption") return <li className="letter letter--caption"><span className="tn-caption">{l.text}</span></li>;
  return (
    <li className={`letter letter--${l.kind}`}>
      {l.speaker && <span className="letter__speaker">{l.speaker}{l.kind === "thought" ? " (thinking)" : ""}</span>}
      <span className={`tn-bubble${/!$/.test(l.text) && l.text === l.text.toUpperCase() ? " tn-bubble--shout" : ""}`}>{l.text}</span>
    </li>
  );
}

/**
 * Renders a fan comic. Each panel is the art on its own, then its lettering in a strip
 * directly underneath: balloons, captions and sound effects are never drawn on the art.
 */
export function FanComicPages({ pages, title }: { pages: FanPage[]; title: string }) {
  if (pages.length === 0) return <div className="empty">No pages yet.</div>;
  return (
    <div className="fan-comic">
      {pages.map((p, i) => (
        <section key={i} className="fan-page" data-cols={LAYOUTS[p.layout]?.cols ?? 1} aria-label={`Page ${i + 1} of ${pages.length}`}>
          {p.panels.map((panel, j) => (
            <figure key={j} className={`fan-panel${spansRow(p.layout, j) ? " span-row" : ""}`}>
              {panel.imageUrl ? (
                <img className="fan-panel__art" src={panel.imageUrl} alt={panel.alt || `${title}, page ${i + 1}, panel ${j + 1}`} loading={i < 2 ? "eager" : "lazy"} />
              ) : (
                <div className="fan-panel__blank">No art yet</div>
              )}
              {panel.lettering.length > 0 && (
                <figcaption>
                  <ol className="letter-strip" aria-label={`Lettering for page ${i + 1}, panel ${j + 1}`}>
                    {panel.lettering.map((l, k) => <LetterLine key={k} l={l} />)}
                  </ol>
                </figcaption>
              )}
            </figure>
          ))}
        </section>
      ))}
    </div>
  );
}
