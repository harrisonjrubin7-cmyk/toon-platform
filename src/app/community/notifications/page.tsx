import Link from "next/link";
import { db } from "@/lib/db";
import { requirePageRole } from "@/lib/auth/session";
import { listNotifications } from "@/lib/domain/community/social";
import { formatDateTime } from "@/lib/format";
import { markReadAction } from "@/app/actions/community";

export const metadata = { title: "Notifications" };

const href = (t: string | null, id: string | null, handle: string | null) =>
  t === "comic" && id ? `/c/${id}` : t === "idea" && id ? `/ideas/${id}` : t === "profile" && handle ? `/u/${handle}` : null;

export default async function Notifications() {
  const actor = await requirePageRole("reader", "/community/notifications");
  const items = await listNotifications(db, actor);
  const unread = items.filter((i) => !i.read).length;
  return (
    <div className="stack" style={{ maxWidth: 720 }}>
      <div className="spread">
        <h1 className="tn-h1">Notifications</h1>
        {unread > 0 && <form action={markReadAction}><button className="tn-btn sm" type="submit">Mark all as read</button></form>}
      </div>
      {items.length === 0 ? <div className="empty">Nothing yet. Likes, comments, follows and studio decisions about your posts show up here.</div> : (
        <ul className="list">
          {items.map((n) => {
            const who = n.actor.handle ? `@${n.actor.handle}` : "Someone";
            const text = {
              like: `${who} liked your ${n.targetType}.`,
              comment: `${who} commented on your ${n.targetType}: “${n.detail}”`,
              follow: `${who} started following you.`,
              moderation: `The studio took action on your ${n.targetType}: ${n.detail}`,
              approved: `The studio approved your ${n.targetType}. It's live.`,
            }[n.kind] ?? n.detail;
            const link = n.kind === "follow" ? (n.actor.handle ? `/u/${n.actor.handle}` : null) : href(n.targetType, n.targetId, null);
            return (
              <li key={n.id} className="list-item">
                <span>{!n.read && <span className="tn-badge tn-badge--new" style={{ marginRight: 8 }}>New</span>}{link ? <Link href={link}>{text}</Link> : text}</span>
                <span className="tn-supporting muted">{formatDateTime(n.createdAt)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
