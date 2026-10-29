import Link from "next/link";
import { db } from "@/lib/db";
import { requirePageRole } from "@/lib/auth/session";
import { load } from "@/lib/page-helpers";
import * as cards from "@/lib/domain/cards";
import { disclose, pct } from "@/lib/game/packs";
import { RARITY_INFO, RARITIES } from "@/lib/game/cards";
import { BuyForm } from "@/components/game/store-forms";
import { CardFace } from "@/components/game/card-face";

export const metadata = { title: "Packs" };

const STATUS: Record<string, string> = {
  paid: "Payment received. Your packs are below, ready to rip.",
  pending: "Waiting for the payment to confirm. This page updates when you reload it.",
  failed: "The payment didn't go through. You weren't charged.",
  expired: "Checkout timed out. You weren't charged.",
  refunded: "This purchase was refunded.",
};

export default async function Packs({ searchParams }: { searchParams: Promise<{ purchase?: string; cancelled?: string }> }) {
  const actor = await requirePageRole("reader", "/play/packs");
  const sp = await searchParams;
  const cfg = cards.storeConfig();
  const [products, sealed, opened, history] = await load(Promise.all([
    cards.listProducts(db), cards.sealedPacks(db, actor), cards.openedPacks(db, actor, 6), cards.purchaseHistory(db, actor),
  ]), "/play/packs");
  const purchase = sp.purchase ? await cards.getPurchase(db, actor, sp.purchase).catch(() => null) : null;

  return (
    <>
      <h1 className="tn-h1">Packs</h1>
      {purchase && <div className={`tn-notice ${purchase.status === "paid" ? "tn-notice--success" : ""}`} role="status">{STATUS[purchase.status] ?? purchase.status}</div>}
      {sp.cancelled && <div className="tn-notice" role="status">Checkout cancelled. You weren&apos;t charged.</div>}

      <section className="section">
        <div className="section-head"><h2>Sealed packs</h2><span className="muted">{sealed.length} waiting</span></div>
        {sealed.length ? (
          <ul className="list">
            {sealed.map((p) => (
              <li key={p.id} className="list-item">
                <span><strong>{p.productName}</strong> <span className="muted small">{p.source === "grant" ? "Gift from the studio" : "Bought"} {p.createdAt.toLocaleDateString()}</span></span>
                <Link className="tn-btn tn-btn--primary" href={`/play/packs/open/${p.id}`}>Rip it</Link>
              </li>
            ))}
          </ul>
        ) : <p className="empty">No sealed packs. Get some below.</p>}
      </section>

      <section className="section">
        <h2>Shop</h2>
        {cfg.provider === "test" && <p className="notice-box"><strong>Test mode.</strong> No money changes hands; packs are added straight to your account so the store can be tried out.</p>}
        {cfg.provider === "off" && <p className="notice-box">Pack sales aren&apos;t switched on yet. Packs can still be given out by the studio.</p>}
        <div className="grid-wide">
          {products.map((p) => {
            const d = disclose(p.odds);
            return (
              <article key={p.id} className="card stack">
                <h3>{p.name}</h3>
                <p className="muted">{p.description}</p>
                <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
                  {RARITIES.filter((r) => d.byRarity[r] > 0).map((r) => (
                    <li key={r}>{RARITY_INFO[r].glyph} {RARITY_INFO[r].label}: {pct(d.byRarity[r])} per pack</li>
                  ))}
                </ul>
                <p className="small"><Link href={`/play/packs/odds/${p.id}`}>Full odds for every card</Link></p>
                {cfg.provider !== "off" && <BuyForm productId={p.id} priceLabel={cards.money(p.priceCents, p.currency)} unitCents={p.priceCents} currency={p.currency} testMode={cfg.provider === "test"} />}
              </article>
            );
          })}
        </div>
        <p className="muted small" style={{ marginTop: 12 }}>
          Packs are random. Odds are shown before you buy and every pack keeps the odds it was sold with. Sales are for adults (18+), limited to {cards.money(cfg.dailyCapCents)} a day, and not offered in {cfg.blockedCountries.join(", ") || "no countries"}. Cards have no cash value and can&apos;t be sold or cashed out.
        </p>
      </section>

      {opened.length > 0 && (
        <section className="section">
          <h2>Recent rips</h2>
          <div className="stack">
            {opened.map((o) => (
              <div key={o.id}>
                <p className="small muted">{o.name} · {o.opened_at.toLocaleString()}</p>
                <div className="card-grid s">{o.contents.map((c, i) => <CardFace key={i} cardId={c.cardId} variant={c.variant} serial={c.serial} size="s" />)}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {history.length > 0 && (
        <section className="section">
          <h2>Purchase history</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Packs</th><th>Amount</th><th>Status</th></tr></thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id}><td>{h.created_at.toLocaleString()}</td><td>{h.quantity}</td><td>{h.provider === "test" ? "Test (free)" : cards.money(h.amount_cents, h.currency)}</td><td>{h.status}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
