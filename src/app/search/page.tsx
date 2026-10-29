import { db } from "@/lib/db";
import { search } from "@/lib/domain/catalog";
import { Empty, ReleaseTile, SeriesTile } from "@/components/cards";

export const metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? "").toString();
  const res = q.trim().length >= 2 ? await search(db, q) : null;
  return (
    <>
      <h1 className="display-l">Search</h1>
      <form role="search" action="/search" className="row" style={{ marginBottom: 24 }}>
        <label htmlFor="q" className="visually-hidden">Search series, issues and episodes</label>
        <input id="q" name="q" type="search" className="tn-field__input" defaultValue={q} placeholder="Search series, issues, episodes" style={{ flex: 1, minWidth: 220 }} />
        <button className="tn-btn tn-btn--primary" type="submit">Search</button>
      </form>
      {!res && <p className="muted">Type at least two letters.</p>}
      {res && res.series.length === 0 && res.releases.length === 0 && <Empty>Nothing matches “{q}”.</Empty>}
      {res && res.series.length > 0 && (
        <section className="section"><h2>Series</h2><div className="issue-grid">{res.series.map((s) => <SeriesTile key={s.id} s={s} />)}</div></section>
      )}
      {res && res.releases.length > 0 && (
        <section className="section"><h2>Issues and episodes</h2><div className="issue-grid">{res.releases.map((r) => <ReleaseTile key={r.id} r={r} />)}</div></section>
      )}
    </>
  );
}
