/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import type { ComicCard } from "@/lib/domain/community/comics";
import type { IdeaCard } from "@/lib/domain/community/ideas";
import { formatDate } from "@/lib/format";
import "./community.css";

export function SpinoffTag({ spinoff }: { spinoff: { slug: string; title: string } | null }) {
  if (!spinoff) return null;
  return <span className="spinoff-tag">Fan spinoff of <strong>{spinoff.title}</strong> · not official canon</span>;
}

export function FanComicCard({ c }: { c: ComicCard }) {
  const cover = c.coverUrl ?? c.firstPanelUrl;
  return (
    <Link href={`/c/${c.id}`} className="fan-card">
      <div className="fan-card__cover">{cover ? <img src={cover} alt="" loading="lazy" /> : <div className="cover-fallback">{c.title}</div>}</div>
      <span className="fan-card__title">{c.title}</span>
      <span className="fan-card__meta">
        <span>@{c.author.handle}</span>
        <span>{c.pageCount} {c.pageCount === 1 ? "page" : "pages"}</span>
        <span>{c.rating === "Teen" ? "Teen" : "Mature"}</span>
        <span aria-label={`${c.likes} likes`}>♥ {c.likes}</span>
        <span aria-label={`${c.comments} comments`}>💬 {c.comments}</span>
      </span>
      <SpinoffTag spinoff={c.spinoff} />
    </Link>
  );
}

export function IdeaCardView({ i }: { i: IdeaCard }) {
  return (
    <Link href={`/ideas/${i.id}`} className="idea-card">
      <span className="tn-eyebrow">Idea · @{i.author.handle} · {formatDate(i.createdAt)}</span>
      <span className="tn-body-strong">{i.title}</span>
      <p>{i.body}</p>
      <span className="fan-card__meta"><span aria-label={`${i.likes} likes`}>♥ {i.likes}</span><span aria-label={`${i.comments} comments`}>💬 {i.comments}</span></span>
      <SpinoffTag spinoff={i.spinoff} />
    </Link>
  );
}

export function Avatar({ url, name, small }: { url: string | null; name: string; small?: boolean }) {
  if (url) return <img src={url} alt="" className={`avatar${small ? " sm" : ""}`} />;
  return <span className={`avatar${small ? " sm" : ""}`} aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>;
}

export const MODERATION_LABEL: Record<string, string> = {
  visible: "Live", pending: "Waiting for approval", hidden: "Hidden for review", removed: "Removed by the studio",
};
