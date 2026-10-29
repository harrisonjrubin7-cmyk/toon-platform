import { CARDS, RARITIES, RARITY_INFO, VARIANT_INFO, DIGITAL_VARIANTS, type Variant } from "@/lib/game/cards";
import type { OwnedCard, portfolio } from "@/lib/domain/cards";
import { CardFace } from "./card-face";

/** Portfolio summary plus the full checklist: owned cards in colour, missing ones greyed out. */
export function Binder({ owned, summary, filter }: { owned: OwnedCard[]; summary: ReturnType<typeof portfolio>; filter?: string }) {
  const byCard = new Map<string, { qty: number; best: Variant }>();
  for (const o of owned) {
    const e = byCard.get(o.cardId) ?? { qty: 0, best: "base" as Variant };
    e.qty += o.quantity;
    if (DIGITAL_VARIANTS.indexOf(o.variant) > DIGITAL_VARIANTS.indexOf(e.best)) e.best = o.variant;
    byCard.set(o.cardId, e);
  }
  const list = CARDS.filter((c) => !filter || filter === "all" || (filter === "missing" ? !byCard.has(c.id) : filter === "owned" ? byCard.has(c.id) : c.rarity === filter));
  return (
    <div className="stack">
      <div className="stat-row">
        <div className="stat"><b>{Math.round((summary.distinct / summary.total) * 100)}%</b><span>{summary.distinct} of {summary.total} cards</span></div>
        {RARITIES.map((r) => (
          <div key={r} className="stat"><b>{summary.byRarity[r]?.owned ?? 0}/{summary.byRarity[r]?.total ?? 0}</b><span>{RARITY_INFO[r].glyph} {RARITY_INFO[r].label}</span></div>
        ))}
        {(["reverse_holo", "scar_foil"] as Variant[]).map((v) => <div key={v} className="stat"><b>{summary.variants[v]}</b><span>{VARIANT_INFO[v].label}</span></div>)}
        <div className="stat"><b>{summary.points.toLocaleString()}</b><span>collector points</span></div>
      </div>
      <div className="meter" aria-hidden><i style={{ width: `${(summary.distinct / summary.total) * 100}%` }} /></div>
      {list.length ? (
        <div className="card-grid">
          {list.map((c) => {
            const e = byCard.get(c.id);
            return <CardFace key={c.id} cardId={c.id} variant={e?.best ?? "base"} count={e?.qty} missing={!e} />;
          })}
        </div>
      ) : <p className="empty">No cards match.</p>}
      <details>
        <summary>Every copy you own, by parallel</summary>
        <div className="table-wrap"><table>
          <thead><tr><th>Card</th><th>Parallel</th><th>Copies</th><th>First pulled</th></tr></thead>
          <tbody>{owned.sort((a, b) => a.cardId.localeCompare(b.cardId)).map((o) => (
            <tr key={o.cardId + o.variant}><td>{CARDS.find((c) => c.id === o.cardId)?.name}</td><td>{VARIANT_INFO[o.variant].label}</td><td>{o.quantity}</td><td>{o.firstAcquiredAt.toLocaleDateString()}</td></tr>
          ))}</tbody>
        </table></div>
      </details>
      <p className="muted small">Collector points are a score for bragging rights: Common 1, Rare 5, Epic 20, Legendary 50, Full Art 150, times 2 for reverse holo and 10 for scar foil. Cards have no cash value.</p>
    </div>
  );
}
