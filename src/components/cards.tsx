/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import type { ReleaseCard, SeriesCard } from "@/lib/domain/catalog";
import { ipClass, RatingTag } from "./brand";
import { formatDuration, formatDate, isNew } from "@/lib/format";

export function IssueCard({ r, progress }: { r: ReleaseCard; progress?: { position: number; completed: boolean } }) {
  return (
    <Link href={`/read/${r.id}`} className={`tn-issue ${ipClass(r.theme)}`}>
      <div className="tn-issue__cover">
        {r.coverUrl ? <img src={r.coverUrl} alt="" loading="lazy" /> : r.seriesLogoUrl ? <img src={r.seriesLogoUrl} alt="" className="tn-issue__mark" style={{ objectFit: "contain" }} /> : null}
        <span className="tn-issue__num">#{r.number}</span>
      </div>
      <div className="tn-issue__body">
        <div className="row" style={{ gap: 6 }}>
          {progress?.completed ? <span className="tn-badge">Read</span> : progress ? <span className="tn-badge tn-badge--info">Reading</span> : isNew(r.publishedAt) ? <span className="tn-badge tn-badge--new">New</span> : null}
        </div>
        <h3 className="tn-issue__title">{r.title}</h3>
        <p className="tn-issue__meta">{r.seriesTitle} · {r.volumeTitle}</p>
      </div>
    </Link>
  );
}

export function EpisodeRow({ r, progress }: { r: ReleaseCard; progress?: { position: number; completed: boolean } }) {
  return (
    <Link href={`/watch/${r.id}`} className={`tn-episode ${ipClass(r.theme)}`}>
      <div className="tn-episode__thumb">{r.coverUrl ? <img src={r.coverUrl} alt="" loading="lazy" /> : <span>E{r.number}</span>}</div>
      <div className="tn-episode__body">
        <span className="tn-episode__eyebrow">{r.seriesTitle} · {r.volumeTitle} · Episode {r.number}</span>
        <h3 className="tn-episode__title">{r.title}</h3>
        <div className="tn-episode__meta">
          {r.durationSeconds ? <span>{formatDuration(r.durationSeconds)}</span> : null}
          <RatingTag rating={r.rating} note="" />
          {progress?.completed ? <span className="tn-badge">Watched</span> : progress ? <span className="tn-badge tn-badge--info">In progress</span> : isNew(r.publishedAt) ? <span className="tn-badge tn-badge--new">New</span> : null}
          {r.publishedAt ? <span>{formatDate(r.publishedAt)}</span> : null}
        </div>
      </div>
    </Link>
  );
}

export function ReleaseTile({ r, progress }: { r: ReleaseCard; progress?: { position: number; completed: boolean } }) {
  return r.format === "comic" ? <IssueCard r={r} progress={progress} /> : <EpisodeRow r={r} progress={progress} />;
}

export function SeriesTile({ s }: { s: SeriesCard }) {
  const parts = [s.issueCount ? `${s.issueCount} issue${s.issueCount === 1 ? "" : "s"}` : null, s.episodeCount ? `${s.episodeCount} episode${s.episodeCount === 1 ? "" : "s"}` : null].filter(Boolean);
  return (
    <Link href={`/series/${s.slug}`} className={`tn-issue ${ipClass(s.theme)}`}>
      <div className="tn-issue__cover">
        {s.coverUrl ? <img src={s.coverUrl} alt="" loading="lazy" /> : s.logoUrl ? <img src={s.logoUrl} alt="" className="tn-issue__mark" style={{ objectFit: "contain" }} /> : null}
      </div>
      <div className="tn-issue__body">
        <h3 className="tn-issue__title">{s.title}</h3>
        {s.tagline && <p className="tn-issue__meta">{s.tagline}</p>}
        <div className="row" style={{ gap: 6 }}>
          <RatingTag rating={s.rating} />
          <span className="tn-issue__meta">{parts.join(" · ") || "Coming soon"}</span>
        </div>
      </div>
    </Link>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="empty">{children}</div>;
}
