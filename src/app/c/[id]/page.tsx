import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { currentActor, requireAgeGate } from "@/lib/auth/session";
import { getComic } from "@/lib/domain/community/comics";
import { listComments } from "@/lib/domain/community/social";
import { canModerate } from "@/lib/domain/community/shared";
import { load } from "@/lib/page-helpers";
import { formatDate } from "@/lib/format";
import { FanComicPages } from "@/components/community/comic-view";
import { MODERATION_LABEL, SpinoffTag } from "@/components/community/cards";
import { Comments, FollowButton, LikeButton } from "@/components/community/social";
import { DecisionButtons, ReportButton, ShareButton } from "@/components/community/forms";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  try {
    const c = await getComic(db, id, null);
    const image = c.coverUrl ?? c.firstPanelUrl;
    return {
      title: `${c.title} by @${c.author.handle}`,
      description: c.summary.slice(0, 160) || `A fan comic by @${c.author.handle} on Tune Comics & Studio.`,
      openGraph: { title: c.title, description: c.summary.slice(0, 160), images: image ? [image] : undefined, type: "article" },
    };
  } catch {
    return { title: "Fan comic", robots: { index: false } };
  }
}

export default async function FanComic({ params }: Props) {
  const { id } = await params;
  const path = `/c/${id}`;
  await requireAgeGate(path);
  const actor = await currentActor();
  const c = await load(getComic(db, id, actor), path);
  const comments = await listComments(db, actor, "comic", id);
  const isPublic = c.status === "published" && c.moderation === "visible";
  return (
    <article>
      <header className="stack" style={{ marginBottom: 24 }}>
        <p className="tn-eyebrow">Fan comic · {c.rating === "Teen" ? "Teen" : "Mature 18+"}{c.publishedAt ? ` · ${formatDate(c.publishedAt)}` : ""}</p>
        <h1 className="tn-h1">{c.title}</h1>
        <p className="row">by <Link href={`/u/${c.author.handle}`}>@{c.author.handle}</Link> ({c.author.displayName}) {!c.isAuthor && <FollowButton userId={c.authorId} following={c.authorFollowed} path={path} signedIn={!!actor} />}</p>
        <SpinoffTag spinoff={c.spinoff} />
        {c.summary && <p className="muted" style={{ maxWidth: "65ch" }}>{c.summary}</p>}
        {c.contentNotes && <p className="tn-supporting"><strong>Content notes:</strong> {c.contentNotes}</p>}
        {!isPublic && <div className="tn-notice" role="status"><span className="tn-notice__title">Only you{c.isAuthor ? "" : " and the studio"} can see this</span><span>{c.status === "draft" ? "It's a draft." : MODERATION_LABEL[c.moderation]}{c.moderationNote ? ` · ${c.moderationNote}` : ""}</span></div>}
        <div className="row">
          {isPublic && <LikeButton type="comic" id={c.id} liked={c.liked} count={c.likes} path={path} signedIn={!!actor} />}
          {isPublic && <ShareButton path={path} title={c.title} />}
          {c.isAuthor && <Link className="tn-btn sm" href={`/create/${c.id}`}>Edit</Link>}
          {actor && !c.isAuthor && <ReportButton targetType="comic" targetId={c.id} path={path} />}
        </div>
        {canModerate(actor) && !c.isAuthor && (
          <div className="card"><p className="tn-eyebrow">Studio moderation</p><DecisionButtons targetType="comic" targetId={c.id} options={c.moderation === "visible" ? ["hide", "remove"] : c.moderation === "pending" ? ["approve", "remove"] : ["restore", "remove"]} /></div>
        )}
      </header>
      <FanComicPages pages={c.pages} title={c.title} />
      {isPublic && <Comments type="comic" id={c.id} path={path} comments={comments} signedIn={!!actor} moderator={canModerate(actor)} />}
    </article>
  );
}
