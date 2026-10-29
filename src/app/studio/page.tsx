/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { db } from "@/lib/db";
import { currentActor } from "@/lib/auth/session";
import { studioOverview } from "@/lib/domain/studio";
import { load } from "@/lib/page-helpers";
import { RatingTag } from "@/components/brand";

export default async function StudioHome() {
  const series = await load(studioOverview(db, await currentActor()), "/studio");
  return (
    <>
      <div className="spread">
        <h1 className="display-m" style={{ margin: 0 }}>Series</h1>
        <Link className="tn-btn tn-btn--primary" href="/studio/series/new">New series</Link>
      </div>
      <p className="muted">Each series is one IP. Inside it, add comic sagas and show seasons, then their issues and episodes.</p>
      {series.length === 0 ? (
        <div className="empty">No series yet. Create the first one.</div>
      ) : (
        <ul className="list">
          {series.map((s) => (
            <li key={s.id} className="list-item">
              <div className="row">
                {s.logoUrl || s.coverUrl ? <img src={(s.logoUrl || s.coverUrl)!} alt="" style={{ width: 56, height: 40, objectFit: "contain" }} /> : null}
                <div>
                  <Link href={`/studio/series/${s.id}`} className="body-strong">{s.title}</Link>
                  <div className="caption muted">/series/{s.slug} · {s.published} of {s.total} releases live</div>
                </div>
              </div>
              <div className="row">
                <RatingTag rating={s.rating} note="" />
                <span className={`tn-badge ${s.status === "published" ? "tn-badge--live" : ""}`}>{s.status === "published" ? "Live" : "Draft"}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
