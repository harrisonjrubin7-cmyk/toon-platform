import { db } from "@/lib/db";
import { listPublishedSeries } from "@/lib/domain/catalog";
import { Empty, SeriesTile } from "@/components/cards";

export const metadata = { title: "Series" };

export default async function AllSeries() {
  const series = await listPublishedSeries(db);
  return (
    <>
      <h1 className="display-l">Series</h1>
      <p className="muted">Every Toon world, in comics and on screen.</p>
      {series.length ? <div className="issue-grid">{series.map((s) => <SeriesTile key={s.id} s={s} />)}</div> : <Empty>No series are live yet.</Empty>}
    </>
  );
}
