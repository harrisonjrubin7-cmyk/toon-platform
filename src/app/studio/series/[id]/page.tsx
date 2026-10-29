import Link from "next/link";
import { db } from "@/lib/db";
import { currentActor } from "@/lib/auth/session";
import { getStudioSeries } from "@/lib/domain/studio";
import { load } from "@/lib/page-helpers";
import { storageMode } from "@/lib/storage";
import { DeleteSeriesForm, SeriesForm, StatusToggle, VolumeForm } from "@/components/studio-forms";

export default async function StudioSeries({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await load(getStudioSeries(db, await currentActor(), id), `/studio/series/${id}`);
  return (
    <>
      <p className="crumbs"><Link href="/studio">Series</Link> / {s.title}</p>
      <div className="spread">
        <h1 className="display-m" style={{ margin: 0 }}>{s.title}</h1>
        <div className="row">
          <span className={`tn-badge ${s.status === "published" ? "tn-badge--live" : ""}`}>{s.status === "published" ? "Live" : "Draft"}</span>
          {s.status === "published" && <Link href={`/series/${s.slug}`} target="_blank">View public page ↗</Link>}
        </div>
      </div>
      <div className="card stack">
        <p className="caption" style={{ margin: 0 }}>
          {s.status === "published"
            ? "Readers can see this series and any of its issues and episodes that are published."
            : "Hidden from readers. Its issues and episodes stay hidden even if they're published, until you publish the series."}
        </p>
        <StatusToggle id={s.id} status={s.status} noun="series" />
      </div>

      <section className="stack" aria-labelledby="vols">
        <h2 id="vols" className="display-s">Comic sagas and show seasons</h2>
        {s.volumes.length === 0 ? (
          <div className="empty">Nothing here yet. Add a saga (comics) or a season (show) below.</div>
        ) : (
          <ul className="list">
            {s.volumes.map((v) => (
              <li key={v.id} className="list-item">
                <div>
                  <Link className="body-strong" href={`/studio/volumes/${v.id}`}>{v.title}</Link>
                  <div className="caption muted">{v.format === "comic" ? "Comic" : "Show"} · {v.published} of {v.total} {v.format === "comic" ? "issues" : "episodes"} live</div>
                </div>
                <Link className="tn-btn sm" href={`/studio/volumes/${v.id}`}>Open</Link>
              </li>
            ))}
          </ul>
        )}
        <details>
          <summary className="body-strong">Add a saga or season</summary>
          <div style={{ marginTop: 12 }}><VolumeForm seriesId={s.id} /></div>
        </details>
      </section>

      <section className="stack" aria-labelledby="details">
        <h2 id="details" className="display-s">Series details</h2>
        <SeriesForm mode={storageMode()} values={s} />
      </section>
      {s.status === "draft" && <DeleteSeriesForm id={s.id} title={s.title} />}
    </>
  );
}
