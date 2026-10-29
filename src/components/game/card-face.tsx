/* eslint-disable @next/next/no-img-element */
import { card, collectorNo, RARITY_INFO, VARIANT_INFO, type Variant } from "@/lib/game/cards";

/**
 * One card. Printed cards show the printed front; digital-only tricks get a drawn frame.
 * Labels (rarity, parallel, serial, count) sit under the card, never on the art.
 */
export function CardFace({ cardId, variant = "base", serial, count, size = "m", missing, caption = true }: {
  cardId: string; variant?: Variant; serial?: number | null; count?: number; size?: "s" | "m" | "l"; missing?: boolean; caption?: boolean;
}) {
  const c = card(cardId);
  const label = `${c.name}, ${RARITY_INFO[c.rarity].label}${variant !== "base" ? `, ${VARIANT_INFO[variant].label}` : ""}`;
  return (
    <figure className={`gc gc--${size} gc--${c.rarity} gc--${variant} ${missing ? "gc--missing" : ""}`}>
      <div className="gc__frame" role="img" aria-label={missing ? `${c.name} (not collected yet)` : label}>
        {c.image ? (
          <img src={c.image} alt="" loading="lazy" width={500} height={700} />
        ) : (
          <div className="gc__drawn" style={{ ["--c1" as string]: c.colors[0], ["--c2" as string]: c.colors[1] }}>
            <div className="gc__drawn-top"><span>{c.name}</span><span className="gc__fuel" title="Fuel cost">{c.cost}</span></div>
            <div className="gc__drawn-art" aria-hidden>{c.role}</div>
            <p className="gc__drawn-text">{c.ability?.text}</p>
            <p className="gc__drawn-flavor">{c.flavor}</p>
          </div>
        )}
        {variant !== "base" && !missing && <span className="gc__foil" aria-hidden />}
      </div>
      {caption && (
        <figcaption className="gc__cap">
          <span className="gc__name">{c.name}</span>
          <span className="gc__meta">
            <span className={`gc__rarity gc__rarity--${c.rarity}`}>{RARITY_INFO[c.rarity].glyph} {RARITY_INFO[c.rarity].label}</span>
            {variant !== "base" && <span className="gc__variant">{VARIANT_INFO[variant].label.replace(" /50", "")}{serial ? ` ${serial}/50` : ""}</span>}
            {count !== undefined && count > 0 && <span className="gc__count">×{count}</span>}
          </span>
          <span className="gc__no">{collectorNo(c)}</span>
        </figcaption>
      )}
    </figure>
  );
}
