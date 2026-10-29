import Link from "next/link";
import { db } from "@/lib/db";
import { requirePageRole } from "@/lib/auth/session";
import { activity } from "@/lib/domain/studio";
import { load } from "@/lib/page-helpers";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Activity log" };

const LINKS: Record<string, (id: string) => string> = {
  series: (id) => `/studio/series/${id}`,
  volume: (id) => `/studio/volumes/${id}`,
  release: (id) => `/studio/releases/${id}`,
};

export default async function Activity() {
  const actor = await requirePageRole("admin", "/studio/activity");
  const rows = await load(activity(db, actor, 200));
  return (
    <>
      <h1 className="tn-h2">Activity log</h1>
      <p className="muted">The last 200 changes made in the studio and to accounts.</p>
      <div className="table-wrap">
        <table>
          <thead><tr><th scope="col">When (UTC)</th><th scope="col">Who</th><th scope="col">What</th><th scope="col">Details</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="tn-supporting">{formatDateTime(r.at)}</td>
                <td className="tn-supporting">{r.actor}</td>
                <td><code>{r.action}</code>{r.entityId && LINKS[r.entityType] && !r.action.endsWith(".deleted") ? <> · <Link href={LINKS[r.entityType](r.entityId)}>open</Link></> : null}</td>
                <td className="tn-supporting"><code>{Object.keys(r.detail ?? {}).length ? JSON.stringify(r.detail) : ""}</code></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && <div className="empty">No activity yet.</div>}
    </>
  );
}
