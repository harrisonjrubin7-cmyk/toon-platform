import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requirePageRole } from "@/lib/auth/session";
import { getMyProfile } from "@/lib/domain/community/profiles";
import { myComics } from "@/lib/domain/community/comics";
import { listIdeas } from "@/lib/domain/community/ideas";
import { getSettings } from "@/lib/domain/community/shared";
import { listPublishedSeries } from "@/lib/domain/catalog";
import { formatDate } from "@/lib/format";
import { NewComicForm } from "@/components/community/forms";
import { MODERATION_LABEL } from "@/components/community/cards";

export const metadata = { title: "My creations" };

export default async function Create({ searchParams }: { searchParams: Promise<{ spinoff?: string }> }) {
  const actor = await requirePageRole("reader", "/create");
  const profile = await getMyProfile(db, actor);
  const sp = await searchParams;
  if (!profile || !profile.termsCurrent) redirect(`/create/profile?next=${encodeURIComponent(sp.spinoff ? `/create?spinoff=${sp.spinoff}` : "/create")}`);
  const [comics, ideas, series, settings] = await Promise.all([myComics(db, actor), listIdeas(db, actor, { authorId: actor.id, limit: 60 }), listPublishedSeries(db), getSettings(db)]);
  const spinoff = series.find((s) => s.slug === sp.spinoff)?.id;
  return (
    <>
      <div className="spread">
        <div>
          <h1 className="tn-h1">My creations</h1>
          <p className="muted">Signed in as <Link href={`/u/${profile.handle}`}>@{profile.handle}</Link> · <Link href="/create/profile">Edit profile</Link></p>
        </div>
        <Link className="tn-btn" href="/ideas/new">Pitch an idea</Link>
      </div>
      {profile.suspendedUntil && (
        <div className="tn-notice tn-notice--error" role="alert">
          <span className="tn-notice__title">Posting is paused</span>
          <span>Until {profile.suspendedUntil.toUTCString()}.{profile.suspendedReason ? ` Reason: ${profile.suspendedReason}` : ""}</span>
        </div>
      )}
      <section className="section" aria-labelledby="new-h">
        <h2 id="new-h">Start a new comic</h2>
        <p className="muted">Upload finished pages, or pick a panel layout and upload art for each panel. Add dialogue, captions and sound effects; they always show in a strip under the panel, never over your art.</p>
        <NewComicForm series={series.map((s) => ({ id: s.id, title: s.title }))} allowFanWorks={settings.allowFanWorks} defaultSpinoff={spinoff} />
      </section>
      <section className="section" aria-labelledby="mine-h">
        <h2 id="mine-h">Your comics ({comics.length})</h2>
        {comics.length === 0 ? <div className="empty">Nothing yet.</div> : (
          <ul className="list">
            {comics.map((c) => (
              <li key={c.id} className="list-item">
                <div>
                  <Link className="tn-body-strong" href={`/create/${c.id}`}>{c.title}</Link>
                  <div className="tn-supporting muted">{c.pageCount} {c.pageCount === 1 ? "page" : "pages"} · edited {formatDate(c.updatedAt)} · ♥ {c.likes} · 💬 {c.comments}</div>
                </div>
                <span className="row">
                  <span className="tn-badge">{c.status === "draft" ? "Draft" : "Published"}</span>
                  {c.status === "published" && c.moderation !== "visible" && <span className="tn-badge tn-badge--warn">{MODERATION_LABEL[c.moderation]}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="section" aria-labelledby="ideas-h">
        <h2 id="ideas-h">Your live ideas ({ideas.length})</h2>
        {ideas.length === 0 ? <div className="empty">No ideas posted.</div> : (
          <ul className="list">{ideas.map((i) => <li key={i.id} className="list-item"><Link href={`/ideas/${i.id}`}>{i.title}</Link><span className="tn-supporting muted">♥ {i.likes} · 💬 {i.comments}</span></li>)}</ul>
        )}
      </section>
    </>
  );
}
