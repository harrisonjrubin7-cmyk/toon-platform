import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { currentActor, requireAgeGate } from "@/lib/auth/session";
import { getRelease } from "@/lib/domain/catalog";
import { videoSource } from "@/lib/media";
import { load } from "@/lib/page-helpers";
import { formatDuration } from "@/lib/format";
import { EpisodePlayer } from "@/components/player";
import { ipClass, RatingTag } from "@/components/brand";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ preview?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const r = await getRelease(db, (await params).id, null);
    return { title: `${r.seriesTitle} E${r.number}: ${r.title}` };
  } catch {
    return { title: "Watch" };
  }
}

export default async function WatchPage({ params, searchParams }: Props) {
  const { id } = await params;
  const preview = (await searchParams).preview === "1";
  await requireAgeGate(`/watch/${id}`);
  const actor = await currentActor();
  const r = await load(getRelease(db, id, actor, preview));
  if (r.format === "comic") redirect(`/read/${id}`);
  const source = videoSource(r.videoUrl);
  return (
    <div className={`stack ${ipClass(r.theme)}`}>
      {preview && <div className="alert alert-info" role="status">Studio preview. Viewers can&apos;t see this until it&apos;s published.</div>}
      <p className="crumbs"><Link href={`/series/${r.seriesSlug}`}>{r.seriesTitle}</Link> · {r.volumeTitle}</p>
      <div className="spread">
        <h1 className="tn-h2" style={{ margin: 0 }}>Episode {r.number}: {r.title}</h1>
        <div className="row"><RatingTag rating={r.rating} />{r.durationSeconds ? <span className="tn-supporting">{formatDuration(r.durationSeconds)}</span> : null}</div>
      </div>
      {source ? (
        <EpisodePlayer releaseId={r.id} title={`${r.seriesTitle}, episode ${r.number}: ${r.title}`} source={source} startAt={r.progress && !r.progress.completed ? r.progress.position : 0} signedIn={!!actor} nextId={r.nextId} />
      ) : (
        <div className="empty">This episode&apos;s video isn&apos;t available right now.</div>
      )}
      {r.synopsis && <p>{r.synopsis}</p>}
    </div>
  );
}
