import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { currentActor, requireAgeGate } from "@/lib/auth/session";
import { getIdea } from "@/lib/domain/community/ideas";
import { listComments } from "@/lib/domain/community/social";
import { canModerate } from "@/lib/domain/community/shared";
import { load } from "@/lib/page-helpers";
import { formatDate } from "@/lib/format";
import { deleteIdeaAction } from "@/app/actions/community";
import { MODERATION_LABEL, SpinoffTag } from "@/components/community/cards";
import { Comments, LikeButton } from "@/components/community/social";
import { DecisionButtons, ReportButton, ShareButton } from "@/components/community/forms";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const i = await getIdea(db, (await params).id, null);
    return { title: `${i.title} (idea by @${i.author.handle})`, description: i.body.slice(0, 160), openGraph: { title: i.title, description: i.body.slice(0, 160) } };
  } catch {
    return { title: "Idea", robots: { index: false } };
  }
}

export default async function Idea({ params }: Props) {
  const { id } = await params;
  const path = `/ideas/${id}`;
  await requireAgeGate(path);
  const actor = await currentActor();
  const i = await load(getIdea(db, id, actor), path);
  const comments = await listComments(db, actor, "idea", id);
  const live = i.moderation === "visible";
  return (
    <article className="stack" style={{ maxWidth: 760 }}>
      <p className="tn-eyebrow">Idea · {i.rating === "Teen" ? "Teen" : "Mature 18+"} · {formatDate(i.createdAt)}</p>
      <h1 className="tn-h1">{i.title}</h1>
      <p>by <Link href={`/u/${i.author.handle}`}>@{i.author.handle}</Link></p>
      <SpinoffTag spinoff={i.spinoff} />
      {!live && <div className="tn-notice" role="status"><span className="tn-notice__title">{MODERATION_LABEL[i.moderation]}</span>{i.moderationNote && <span>{i.moderationNote}</span>}</div>}
      {i.body.split(/\n{2,}/).map((p, n) => <p key={n} style={{ whiteSpace: "pre-wrap" }}>{p}</p>)}
      <div className="row">
        {live && <LikeButton type="idea" id={i.id} liked={i.liked} count={i.likes} path={path} signedIn={!!actor} />}
        {live && <ShareButton path={path} title={i.title} />}
        {live && <Link className="tn-btn sm" href={i.spinoff ? `/create?spinoff=${i.spinoff.slug}` : "/create"}>Turn it into a comic</Link>}
        {actor && !i.isAuthor && <ReportButton targetType="idea" targetId={i.id} path={path} />}
        {i.isAuthor && <form action={deleteIdeaAction}><input type="hidden" name="id" value={i.id} /><button className="tn-btn tn-btn--ghost sm" type="submit">Delete idea</button></form>}
      </div>
      {canModerate(actor) && !i.isAuthor && <div className="card"><p className="tn-eyebrow">Studio moderation</p><DecisionButtons targetType="idea" targetId={i.id} options={live ? ["hide", "remove"] : i.moderation === "pending" ? ["approve", "remove"] : ["restore", "remove"]} /></div>}
      {live && <Comments type="idea" id={i.id} path={path} comments={comments} signedIn={!!actor} moderator={canModerate(actor)} />}
    </article>
  );
}
