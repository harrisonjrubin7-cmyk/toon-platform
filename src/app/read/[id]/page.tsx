import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { currentActor, requireAgeGate } from "@/lib/auth/session";
import { getRelease } from "@/lib/domain/catalog";
import { load } from "@/lib/page-helpers";
import { ComicReader } from "@/components/reader";
import { ipClass, RatingTag } from "@/components/brand";
import { redirect } from "next/navigation";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ preview?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const r = await getRelease(db, (await params).id, null);
    return { title: `${r.seriesTitle} #${r.number}: ${r.title}` };
  } catch {
    return { title: "Read" };
  }
}

export default async function ReadPage({ params, searchParams }: Props) {
  const { id } = await params;
  const preview = (await searchParams).preview === "1";
  await requireAgeGate(`/read/${id}`);
  const actor = await currentActor();
  const r = await load(getRelease(db, id, actor, preview));
  if (r.format === "show") redirect(`/watch/${id}`);
  return (
    <div className={ipClass(r.theme)}>
      {preview && <div className="alert alert-info" role="status" style={{ marginBottom: 12 }}>Studio preview. Readers can&apos;t see this until it&apos;s published.</div>}
      <p className="crumbs"><Link href={`/series/${r.seriesSlug}`}>{r.seriesTitle}</Link> · {r.volumeTitle}</p>
      <div className="spread">
        <h1 className="tn-h2" style={{ margin: 0 }}>#{r.number} {r.title}</h1>
        <RatingTag rating={r.rating} />
      </div>
      {r.synopsis && <p className="muted" style={{ marginTop: 8 }}>{r.synopsis}</p>}
      {!actor && <p className="tn-supporting muted"><Link href={`/login?next=/read/${id}`}>Sign in</Link> to save your place.</p>}
      <ComicReader releaseId={r.id} title={`${r.seriesTitle} #${r.number}`} pages={r.pages} startAt={r.progress && !r.progress.completed ? r.progress.position : 0} signedIn={!!actor} nextId={r.nextId} prevId={r.prevId} />
    </div>
  );
}
