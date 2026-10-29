import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requirePageRole } from "@/lib/auth/session";
import { getMyProfile } from "@/lib/domain/community/profiles";
import { getComicForEdit, publishProblems } from "@/lib/domain/community/comics";
import { getSettings } from "@/lib/domain/community/shared";
import { listPublishedSeries } from "@/lib/domain/catalog";
import { storageMode } from "@/lib/storage";
import { load } from "@/lib/page-helpers";
import { ComicEditor } from "@/components/community/editor";
import { PublishControls } from "@/components/community/forms";
import { MODERATION_LABEL } from "@/components/community/cards";

export const metadata = { title: "Edit comic" };

export default async function EditComic({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requirePageRole("reader", `/create/${id}`);
  const profile = await getMyProfile(db, actor);
  if (!profile || !profile.termsCurrent) redirect(`/create/profile?next=${encodeURIComponent(`/create/${id}`)}`);
  const [comic, series, settings] = await Promise.all([load(getComicForEdit(db, actor, id), `/create/${id}`), listPublishedSeries(db), getSettings(db)]);
  const problems = publishProblems(comic.pages, comic.title);
  return (
    <>
      <div className="crumbs"><Link href="/create">My creations</Link> / {comic.title}</div>
      <div className="spread">
        <h1 className="tn-h2">{comic.title}</h1>
        <span className="row">
          <span className="tn-badge">{comic.status === "draft" ? "Draft" : "Published"}</span>
          {comic.moderation !== "visible" && <span className="tn-badge tn-badge--warn">{MODERATION_LABEL[comic.moderation]}</span>}
        </span>
      </div>
      {comic.moderation === "removed" && (
        <div className="tn-notice tn-notice--error" role="alert"><span className="tn-notice__title">Removed by the studio</span><span>{comic.moderationNote ?? "It broke the community guidelines."} It can&apos;t be edited or republished.</span></div>
      )}
      {comic.moderation === "hidden" && (
        <div className="tn-notice" role="status"><span className="tn-notice__title">Hidden while the studio reviews it</span>{comic.moderationNote && <span>{comic.moderationNote}</span>}</div>
      )}
      <section className="card stack" aria-labelledby="pub-h">
        <h2 id="pub-h" className="tn-h3">Publishing</h2>
        {comic.status === "draft" && problems.length > 0 && (
          <div className="tn-supporting"><strong>Before you can publish:</strong> <ul>{problems.slice(0, 6).map((p) => <li key={p}>{p}</li>)}{problems.length > 6 && <li>and {problems.length - 6} more</li>}</ul></div>
        )}
        {settings.preModeration && comic.status === "draft" && <p className="tn-supporting muted">The studio approves new comics before they go live.</p>}
        <PublishControls id={comic.id} status={comic.status} moderation={comic.moderation} title={comic.title} />
      </section>
      {comic.moderation !== "removed" && (
        <ComicEditor comic={comic} userId={actor.id} mode={storageMode()} series={series.map((s) => ({ id: s.id, title: s.title }))} allowFanWorks={settings.allowFanWorks} />
      )}
    </>
  );
}
