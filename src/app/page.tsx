import Link from "next/link";
import { db } from "@/lib/db";
import { currentActor } from "@/lib/auth/session";
import { continueList, latestReleases, listPublishedSeries, newForYou } from "@/lib/domain/catalog";
import { EpisodeRow, Empty, IssueCard, ReleaseTile, SeriesTile } from "@/components/cards";
import { StudioLogo } from "@/components/brand";

export default async function Home() {
  const actor = await currentActor();
  const [series, comics, episodes, cont, fresh] = await Promise.all([
    listPublishedSeries(db),
    latestReleases(db, 10, "comic"),
    latestReleases(db, 6, "show"),
    actor ? continueList(db, actor) : Promise.resolve([]),
    actor ? newForYou(db, actor) : Promise.resolve([]),
  ]);
  const inProgress = cont.filter((c) => !c.completed).slice(0, 6);
  return (
    <>
      <section className="hero">
        <div className="row" style={{ gap: 20, alignItems: "center" }}>
          <StudioLogo variant="icon" height={96} />
          <div style={{ flex: 1, minWidth: 240 }}>
            <h1 className="display-l" style={{ margin: 0 }}>Cartoons that bleed.</h1>
            <p className="body-l" style={{ margin: "8px 0 16px" }}>Read the comics and watch the shows from Tune Comics &amp; Studios. Toon physics. Real scars.</p>
            <div className="row">
              <Link className="tn-btn tn-btn--primary" href="/comics">Read comics</Link>
              <Link className="tn-btn" href="/shows">Watch shows</Link>
            </div>
          </div>
        </div>
      </section>

      {inProgress.length > 0 && (
        <section className="section" aria-labelledby="continue">
          <div className="section-head"><h2 id="continue">Pick up where you left off</h2><Link href="/library">My library</Link></div>
          <div className="issue-grid">{inProgress.map((r) => <ReleaseTile key={r.id} r={r} progress={r} />)}</div>
        </section>
      )}

      {fresh.length > 0 && (
        <section className="section" aria-labelledby="fresh">
          <div className="section-head"><h2 id="fresh">New from series you follow</h2></div>
          <div className="issue-grid">{fresh.slice(0, 6).map((r) => <ReleaseTile key={r.id} r={r} />)}</div>
        </section>
      )}

      <section className="section" aria-labelledby="series-h">
        <div className="section-head"><h2 id="series-h">Series</h2><Link href="/series">See all</Link></div>
        {series.length ? <div className="issue-grid">{series.map((s) => <SeriesTile key={s.id} s={s} />)}</div> : <Empty>No series are live yet. Check back soon.</Empty>}
      </section>

      <section className="section" aria-labelledby="comics-h">
        <div className="section-head"><h2 id="comics-h">Latest issues</h2><Link href="/comics">All comics</Link></div>
        {comics.length ? <div className="issue-grid">{comics.map((r) => <IssueCard key={r.id} r={r} />)}</div> : <Empty>The first issue hasn&apos;t dropped yet.</Empty>}
      </section>

      <section className="section" aria-labelledby="eps-h">
        <div className="section-head"><h2 id="eps-h">Latest episodes</h2><Link href="/shows">All shows</Link></div>
        {episodes.length ? <div className="episode-list two">{episodes.map((r) => <EpisodeRow key={r.id} r={r} />)}</div> : <Empty>No episodes are out yet.</Empty>}
      </section>
    </>
  );
}
