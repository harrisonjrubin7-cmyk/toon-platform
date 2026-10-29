import type { Metadata } from "next";
import { db } from "@/lib/db";
import { currentActor, requireAgeGate } from "@/lib/auth/session";
import { getSeries } from "@/lib/domain/catalog";
import { load } from "@/lib/page-helpers";
import { EpisodeRow, IssueCard } from "@/components/cards";
import { Endorsement, IpMark, ipClass, RatingTag } from "@/components/brand";
import { followAction } from "@/app/actions/reader";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const s = await getSeries(db, slug, null);
    return { title: s.title, description: s.tagline || s.synopsis.slice(0, 160) };
  } catch {
    return { title: "Series" };
  }
}

export default async function SeriesPage({ params }: Props) {
  const { slug } = await params;
  await requireAgeGate(`/series/${slug}`);
  const actor = await currentActor();
  const s = await load(getSeries(db, slug, actor));
  return (
    <div className={ipClass(s.theme)}>
      <section className={`hero ${s.theme !== "studio" ? "on-ground" : ""}`}>
        <IpMark src={s.logoUrl} title={s.title} />
        {s.tagline && <p className="body-l" style={{ marginTop: 12 }}>{s.tagline}</p>}
        <div className="row" style={{ marginBottom: 12 }}>
          <RatingTag rating={s.rating} />
          <Endorsement />
        </div>
        {s.synopsis && s.synopsis.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}
        <form action={followAction}>
          <input type="hidden" name="seriesId" value={s.id} />
          <input type="hidden" name="slug" value={s.slug} />
          <input type="hidden" name="follow" value={s.following ? "0" : "1"} />
          <button className={`tn-btn ${s.following ? "" : "tn-btn--primary"}`} type="submit" aria-pressed={s.following}>
            {s.following ? "Following ✓" : "Follow this series"}
          </button>
        </form>
      </section>

      {s.volumes.length === 0 && <div className="empty">Nothing from this series is out yet. Follow it to see new issues and episodes in your library.</div>}

      {s.volumes.map((v) => (
        <section className="section" key={v.id} aria-labelledby={`v-${v.id}`}>
          <div className="section-head">
            <h2 id={`v-${v.id}`}>{v.title}</h2>
            <span className="tn-badge">{v.format === "comic" ? "Comic" : "Show"}</span>
          </div>
          {v.description && <p className="muted">{v.description}</p>}
          {v.format === "comic" ? (
            <div className="issue-grid">{v.releases.map((r) => <IssueCard key={r.id} r={r} />)}</div>
          ) : (
            <div className="episode-list two">{v.releases.map((r) => <EpisodeRow key={r.id} r={r} />)}</div>
          )}
        </section>
      ))}
    </div>
  );
}
