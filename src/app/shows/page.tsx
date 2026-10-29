import { db } from "@/lib/db";
import { latestReleases } from "@/lib/domain/catalog";
import { Empty, EpisodeRow } from "@/components/cards";

export const metadata = { title: "Shows" };

export default async function Shows() {
  const eps = await latestReleases(db, 200, "show");
  return (
    <>
      <h1 className="tn-h1">Shows</h1>
      <p className="muted">Every episode, newest first.</p>
      {eps.length ? <div className="episode-list two">{eps.map((r) => <EpisodeRow key={r.id} r={r} />)}</div> : <Empty>No episodes are out yet.</Empty>}
    </>
  );
}
