import { db } from "@/lib/db";
import { requirePageRole } from "@/lib/auth/session";
import { load } from "@/lib/page-helpers";
import { listProducts, money, storeConfig, storeReport } from "@/lib/domain/cards";
import { isTestKey } from "@/lib/payments/stripe";
import { GrantForm, ProductForm } from "@/components/game/store-forms";

export const metadata = { title: "Card store" };

export default async function StudioCards() {
  const actor = await requirePageRole("admin", "/studio/cards");
  const [products, report] = await load(Promise.all([listProducts(db, { includeInactive: true }), storeReport(db, actor)]), "/studio/cards");
  const cfg = storeConfig();
  const mode = cfg.provider === "stripe" ? (isTestKey() ? "Stripe test mode" : process.env.PAYMENTS_LIVE === "true" ? "Stripe LIVE" : "Stripe (key missing or live key blocked)") : cfg.provider === "test" ? "Test mode (free, no Stripe)" : "Off";
  return (
    <>
      <h1 className="tn-h1">Card store</h1>
      <p>Payments: <strong>{mode}</strong>. Daily limit per player {money(cfg.dailyCapCents)}. Not sold in: {cfg.blockedCountries.join(", ") || "none"}.</p>
      <section className="section">
        <h2>Sales</h2>
        <div className="stat-row">
          {report.totals.map((t) => <div key={t.provider + t.status} className="stat"><b>{t.n}</b><span>{t.provider} · {t.status} · {money(Number(t.cents))}</span></div>)}
          {report.packs.map((p) => <div key={p.status} className="stat"><b>{p.n}</b><span>packs {p.status}</span></div>)}
        </div>
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table>
            <thead><tr><th>When</th><th>Player</th><th>Pack</th><th>Qty</th><th>Amount</th><th>How</th><th>Status</th><th>Country</th></tr></thead>
            <tbody>{report.purchases.map((p) => (
              <tr key={p.id}><td>{p.created_at.toLocaleString()}</td><td>{p.email}</td><td>{p.product_id}</td><td>{p.quantity}</td><td>{money(p.amount_cents, p.currency)}</td><td>{p.provider}</td><td>{p.status}</td><td>{p.country ?? "?"}</td></tr>
            ))}</tbody>
          </table>
        </div>
      </section>
      <section className="section">
        <h2>Give packs</h2>
        <GrantForm products={products.map((p) => ({ id: p.id, name: p.name }))} />
      </section>
      <section className="section stack">
        <h2>Packs for sale</h2>
        {products.map((p) => <ProductForm key={`${p.id}-${p.version}`} p={p} />)}
      </section>
    </>
  );
}
