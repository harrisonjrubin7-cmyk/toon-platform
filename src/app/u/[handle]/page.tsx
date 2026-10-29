import type { Metadata } from "next";
import { db } from "@/lib/db";
import { currentActor, requireAgeGate } from "@/lib/auth/session";
import { getProfileByHandle } from "@/lib/domain/community/profiles";
import { listComics } from "@/lib/domain/community/comics";
import { listIdeas } from "@/lib/domain/community/ideas";
import { canModerate } from "@/lib/domain/community/shared";
import { load } from "@/lib/page-helpers";
import { formatDate } from "@/lib/format";
import { Avatar, FanComicCard, IdeaCardView } from "@/components/community/cards";
import { FollowButton } from "@/components/community/social";
import { ReportButton, ShareButton, SuspendForm } from "@/components/community/forms";
import Link from "next/link";

type Props = { params: Promise<{ handle: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  return { title: `@${decodeURIComponent(handle)}` };
}

export default async function ProfilePage({ params }: Props) {
  const handle = decodeURIComponent((await params).handle);
  const path = `/u/${handle}`;
  await requireAgeGate(path);
  const actor = await currentActor();
  const p = await load(getProfileByHandle(db, handle, actor), path);
  const [comics, ideas] = await Promise.all([listComics(db, actor, { authorId: p.userId, limit: 60 }), listIdeas(db, actor, { authorId: p.userId, limit: 60 })]);
  return (
    <>
      <section className="hero">
        <div className="row" style={{ alignItems: "flex-start" }}>
          <Avatar url={p.avatarUrl} name={p.handle} />
          <div className="stack" style={{ flex: 1 }}>
            <h1 className="tn-h2" style={{ margin: 0 }}>@{p.handle}</h1>
            <p className="muted" style={{ margin: 0 }}>{p.displayName} · joined {formatDate(p.joinedAt)} · {p.followers} {p.followers === 1 ? "follower" : "followers"} · following {p.following}</p>
            {p.bio && <p style={{ whiteSpace: "pre-wrap" }}>{p.bio}</p>}
            <div className="row">
              {!p.isSelf && <FollowButton userId={p.userId} following={p.isFollowing} path={path} signedIn={!!actor} />}
              {p.isSelf && <Link className="tn-btn sm" href="/create/profile">Edit profile</Link>}
              <ShareButton path={path} title={`@${p.handle} on Tune Comics & Studio`} />
              {actor && !p.isSelf && <ReportButton targetType="profile" targetId={p.userId} path={path} label="Report profile" />}
            </div>
            {canModerate(actor) && !p.isSelf && <SuspendForm userId={p.userId} handle={p.handle} suspended={p.suspended} />}
          </div>
        </div>
      </section>
      <section className="section" aria-labelledby="pc-h">
        <h2 id="pc-h">Comics ({comics.length})</h2>
        {comics.length ? <div className="fan-grid">{comics.map((c) => <FanComicCard key={c.id} c={c} />)}</div> : <div className="empty">No published comics yet.</div>}
      </section>
      <section className="section" aria-labelledby="pi-h">
        <h2 id="pi-h">Ideas ({ideas.length})</h2>
        {ideas.length ? <div className="grid-wide">{ideas.map((i) => <IdeaCardView key={i.id} i={i} />)}</div> : <div className="empty">No ideas yet.</div>}
      </section>
    </>
  );
}
