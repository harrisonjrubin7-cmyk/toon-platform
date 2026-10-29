import Link from "next/link";
import { db } from "@/lib/db";
import { currentActor } from "@/lib/auth/session";
import { getStudioVolume } from "@/lib/domain/studio";
import { load } from "@/lib/page-helpers";
import { storageMode } from "@/lib/storage";
import { formatDateTime } from "@/lib/format";
import { DeleteButtonForm, ReleaseForm, VolumeForm } from "@/components/studio-forms";
import { deleteVolumeAction } from "@/app/actions/studio";

export default async function StudioVolume({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const v = await load(getStudioVolume(db, await currentActor(), id), `/studio/volumes/${id}`);
  const noun = v.format === "comic" ? "issue" : "episode";
  const nextNumber = (v.releases.at(-1)?.number ?? 0) + 1;
  return (
    <>
      <p className="crumbs"><Link href="/studio">Series</Link> / <Link href={`/studio/series/${v.seriesId}`}>{v.seriesTitle}</Link> / {v.title}</p>
      <div className="spread">
        <h1 className="tn-h2" style={{ margin: 0 }}>{v.title}</h1>
        <span className="tn-badge">{v.format === "comic" ? "Comic" : "Show"}</span>
      </div>

      <section className="stack" aria-labelledby="rels">
        <h2 id="rels" className="tn-h3">{noun === "issue" ? "Issues" : "Episodes"}</h2>
        {v.releases.length === 0 ? (
          <div className="empty">No {noun}s yet.</div>
        ) : (
          <ul className="list">
            {v.releases.map((r) => {
              const scheduled = r.status === "published" && r.publishAt && new Date(r.publishAt) > new Date();
              return (
                <li key={r.id} className="list-item">
                  <div>
                    <Link className="tn-body-strong" href={`/studio/releases/${r.id}`}>#{r.number} {r.title}</Link>
                    <div className="tn-supporting muted">{v.format === "comic" ? `${r.pageCount} pages` : r.hasVideo ? "Video attached" : "No video yet"}{scheduled ? ` · goes live ${formatDateTime(r.publishAt!)}` : ""}</div>
                  </div>
                  {r.status === "draft" ? <span className="tn-badge">Draft</span> : scheduled ? <span className="tn-badge tn-badge--info">Scheduled</span> : <span className="tn-badge tn-badge--live">Live</span>}
                </li>
              );
            })}
          </ul>
        )}
        <details open={v.releases.length === 0}>
          <summary className="tn-body-strong">Add an {noun}</summary>
          <div style={{ marginTop: 12 }}><ReleaseForm volumeId={v.id} format={v.format} mode={storageMode()} nextNumber={nextNumber} /></div>
        </details>
      </section>

      <section className="stack">
        <h2 className="tn-h3">Details</h2>
        <VolumeForm values={{ id: v.id, title: v.title, description: v.description, position: v.position }} />
        {v.releases.length === 0 && <DeleteButtonForm action={deleteVolumeAction} id={v.id} label={`Delete this ${v.format === "comic" ? "saga" : "season"}`} confirmText="Delete it? This can't be undone." />}
      </section>
    </>
  );
}
