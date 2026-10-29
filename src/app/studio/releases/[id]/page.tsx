import Link from "next/link";
import { db } from "@/lib/db";
import { currentActor } from "@/lib/auth/session";
import { getStudioRelease } from "@/lib/domain/studio";
import { load } from "@/lib/page-helpers";
import { storageMode } from "@/lib/storage";
import { DeleteButtonForm, PublishPanel, ReleaseForm, VideoForm } from "@/components/studio-forms";
import { PageManager } from "@/components/page-manager";
import { deleteReleaseAction } from "@/app/actions/studio";

export default async function StudioRelease({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await load(getStudioRelease(db, await currentActor(), id), `/studio/releases/${id}`);
  const mode = storageMode();
  const comic = r.format === "comic";
  const ready = comic ? r.pages.length > 0 : !!r.videoUrl;
  return (
    <>
      <p className="crumbs">
        <Link href="/studio">Series</Link> / <Link href={`/studio/series/${r.seriesId}`}>{r.seriesTitle}</Link> / <Link href={`/studio/volumes/${r.volumeId}`}>{r.volumeTitle}</Link> / #{r.number}
      </p>
      <h1 className="display-m">{comic ? "Issue" : "Episode"} #{r.number}: {r.title}</h1>
      {r.seriesStatus !== "published" && <div className="alert alert-info">The series is still a draft, so readers won&apos;t see this even after you publish it. <Link href={`/studio/series/${r.seriesId}`}>Publish the series</Link> when you&apos;re ready.</div>}
      <PublishPanel
        id={r.id}
        status={r.status}
        publishAt={r.publishAt ? new Date(r.publishAt).toISOString() : null}
        ready={ready}
        readyHint={comic ? "Upload at least one page first." : "Add the video first."}
        previewHref={`/${comic ? "read" : "watch"}/${r.id}?preview=1`}
      />
      {comic ? (
        <PageManager releaseId={r.id} pages={r.pages} mode={mode} />
      ) : (
        <VideoForm id={r.id} version={r.version} videoUrl={r.videoUrl} durationSeconds={r.durationSeconds} mode={mode} />
      )}
      <section className="stack">
        <h2 className="display-s">Details</h2>
        <ReleaseForm format={r.format} mode={mode} values={{ id: r.id, version: r.version, number: r.number, title: r.title, synopsis: r.synopsis, coverUrl: r.coverUrl }} />
      </section>
      {r.status === "draft" && <DeleteButtonForm action={deleteReleaseAction} id={r.id} label={`Delete this ${comic ? "issue" : "episode"}`} confirmText="Delete it and all its pages? This can't be undone." />}
    </>
  );
}
