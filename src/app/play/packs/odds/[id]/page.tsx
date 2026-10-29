import Link from "next/link";
import { db } from "@/lib/db";
import { load } from "@/lib/page-helpers";
import { getProduct } from "@/lib/domain/cards";
import { disclose, pct } from "@/lib/game/packs";
import { RARITIES, RARITY_INFO, SCAR_FOIL_RUN, VARIANT_INFO, collectorNo, type Variant } from "@/lib/game/cards";

export const metadata = { title: "Pack odds" };

/** Public: anyone can read the odds before signing up or buying. */
export default async function Odds({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await load(getProduct(db, id));
  const d = disclose(p.odds);
  return (
    <>
      <p className="crumbs"><Link href="/play/packs">Packs</Link> / Odds</p>
      <h1 className="tn-h1">{p.name}: odds</h1>
      <p>{d.size} cards per pack. Each card is drawn independently by the slot rules below, so duplicates can happen. Within a rarity, every card is equally likely.</p>

      <section className="section">
        <h2>Slots</h2>
        <div className="table-wrap">
          <table className="odds-table">
            <thead><tr><th>Slot</th>{RARITIES.map((r) => <th key={r}>{RARITY_INFO[r].label}</th>)}</tr></thead>
            <tbody>
              {d.slots.map((s, i) => (
                <tr key={i}><td>{s.count} card{s.count > 1 ? "s" : ""}</td>{RARITIES.map((r) => <td key={r}>{s.chances[r] ? pct(s.chances[r]!) : "—"}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section">
        <h2>Parallels</h2>
        <p>Every card in the pack separately has these chances to be a parallel:</p>
        <ul>
          {(Object.keys(d.variants) as Variant[]).map((v) => <li key={v}>{VARIANT_INFO[v].label}: {pct(d.variants[v])}</li>)}
        </ul>
        <p className="muted small">Scar foils are numbered 1 to {SCAR_FOIL_RUN} for each card across all players. Once all {SCAR_FOIL_RUN} of a card are pulled, a scar foil pull of that card comes out as a reverse holo instead. Artist proofs are print-only.</p>
      </section>

      <section className="section">
        <h2>Chance per pack</h2>
        <ul>{RARITIES.filter((r) => d.byRarity[r] > 0).map((r) => <li key={r}>At least one {RARITY_INFO[r].label}: {pct(d.byRarity[r])}</li>)}</ul>
        <div className="table-wrap">
          <table className="odds-table">
            <thead><tr><th>No.</th><th>Card</th><th>Rarity</th><th>Chance in one pack</th></tr></thead>
            <tbody>
              {d.byCard.map(({ card: c, chance }) => (
                <tr key={c.id}><td>{collectorNo(c)}</td><td>{c.name}</td><td>{RARITY_INFO[c.rarity].glyph} {RARITY_INFO[c.rarity].label}</td><td>{pct(chance)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
