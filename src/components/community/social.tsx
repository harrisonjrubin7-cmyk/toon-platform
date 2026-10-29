import Link from "next/link";
import { deleteCommentAction, followUserAction, likeAction } from "@/app/actions/community";
import type { CommentItem } from "@/lib/domain/community/social";
import { formatDateTime } from "@/lib/format";
import { CommentForm, ReportButton } from "./forms";
import "./community.css";


export function LikeButton({ type, id, liked, count, path, signedIn }: { type: "comic" | "idea"; id: string; liked: boolean; count: number; path: string; signedIn: boolean }) {
  if (!signedIn) return <Link className="tn-btn sm" href={`/login?next=${encodeURIComponent(path)}`}>♥ Like ({count})</Link>;
  return (
    <form action={likeAction}>
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="path" value={path} />
      <input type="hidden" name="like" value={liked ? "0" : "1"} />
      <button type="submit" className={`tn-btn sm ${liked ? "tn-btn--primary" : ""}`} aria-pressed={liked}>♥ {liked ? "Liked" : "Like"} ({count})</button>
    </form>
  );
}

export function FollowButton({ userId, following, path, signedIn }: { userId: string; following: boolean; path: string; signedIn: boolean }) {
  if (!signedIn) return <Link className="tn-btn sm" href={`/login?next=${encodeURIComponent(path)}`}>Follow</Link>;
  return (
    <form action={followUserAction} style={{ display: "inline" }}>
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="path" value={path} />
      <input type="hidden" name="follow" value={following ? "0" : "1"} />
      <button type="submit" className={`tn-btn sm ${following ? "" : "tn-btn--primary"}`} aria-pressed={following}>{following ? "Following ✓" : "Follow"}</button>
    </form>
  );
}

export function Comments({ type, id, path, comments, signedIn, moderator }: { type: "comic" | "idea"; id: string; path: string; comments: CommentItem[]; signedIn: boolean; moderator: boolean }) {
  return (
    <section className="section" aria-labelledby="comments-h" style={{ maxWidth: 720 }}>
      <h2 id="comments-h">Comments ({comments.filter((c) => !c.hidden).length})</h2>
      {comments.length > 0 && (
        <ul className="comment-list">
          {comments.map((c) => (
            <li key={c.id} className="comment">
              <div className="spread">
                <span className="tn-supporting"><Link href={`/u/${c.author.handle}`}>@{c.author.handle}</Link> · {formatDateTime(c.createdAt)}{c.hidden ? " · hidden" : ""}</span>
                <span className="row" style={{ gap: 4 }}>
                  {(c.mine || moderator) && (
                    <form action={deleteCommentAction}>
                      <input type="hidden" name="commentId" value={c.id} />
                      <input type="hidden" name="path" value={path} />
                      <button className="tn-btn tn-btn--ghost sm" type="submit">Delete</button>
                    </form>
                  )}
                  {signedIn && !c.mine && <ReportButton targetType="comment" targetId={c.id} path={path} />}
                </span>
              </div>
              <p>{c.body}</p>
            </li>
          ))}
        </ul>
      )}
      {comments.length === 0 && <p className="muted">No comments yet.</p>}
      {signedIn ? <CommentForm type={type} id={id} path={path} /> : <p><Link href={`/login?next=${encodeURIComponent(path)}`}>Sign in</Link> to comment.</p>}
    </section>
  );
}
