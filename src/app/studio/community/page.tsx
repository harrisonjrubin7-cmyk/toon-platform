import Link from "next/link";
import { db } from "@/lib/db";
import { requirePageRole } from "@/lib/auth/session";
import { listHidden, listSuspended, pendingQueue, reportQueue, REPORT_REASONS } from "@/lib/domain/community/moderation";
import { canConfigure, getSettings } from "@/lib/domain/community/shared";
import { load } from "@/lib/page-helpers";
import { formatDateTime } from "@/lib/format";
import { DecisionButtons, SettingsForm, SuspendForm } from "@/components/community/forms";

export const metadata = { title: "Community moderation" };

export default async function CommunityModeration() {
  const actor = await requirePageRole("editor", "/studio/community");
  const [queue, pending, hidden, suspended, settings] = await Promise.all([
    load(reportQueue(db, actor)), load(pendingQueue(db, actor)), load(listHidden(db, actor)), load(listSuspended(db, actor)), getSettings(db),
  ]);
  return (
    <>
      <h1 className="tn-h2">Community moderation</h1>
      <p className="muted">Reports from members, posts waiting for approval, hidden posts and paused members. Every decision is recorded in the activity log and the author is notified.</p>

      <section className="section" aria-labelledby="rq-h">
        <h2 id="rq-h">Reports ({queue.length})</h2>
        {queue.length === 0 ? <div className="empty">No open reports.</div> : (
          <ul className="list">
            {queue.map((item) => (
              <li key={`${item.targetType}:${item.targetId}`} className="card stack" style={{ display: "grid" }}>
                <div className="spread">
                  <span>
                    <span className="tn-badge">{item.targetType}</span>{" "}
                    {item.reports.some((r) => r.reason === "minor_safety") && <span className="tn-badge tn-badge--warn">Child safety</span>}{" "}
                    {item.link ? <Link className="tn-body-strong" href={item.link}>{item.title}</Link> : <span className="tn-body-strong">{item.title}</span>}
                    {item.author.handle && <span className="muted"> by @{item.author.handle}</span>}
                  </span>
                  <span className="tn-supporting muted">Now: {item.moderation}</span>
                </div>
                {item.excerpt && <p className="tn-supporting muted" style={{ margin: 0 }}>{item.excerpt}</p>}
                <ul className="tn-supporting">
                  {item.reports.map((r) => <li key={r.id}>{REPORT_REASONS[r.reason]}{r.details ? `: “${r.details}”` : ""} · {r.reporter ? `@${r.reporter}` : "deleted account"} · {formatDateTime(r.createdAt)}</li>)}
                </ul>
                {item.targetType === "profile" ? (
                  <div className="stack">
                    {item.author.userId && item.author.handle && <SuspendForm userId={item.author.userId} handle={item.author.handle} suspended={item.moderation === "suspended"} />}
                    <DecisionButtons targetType="profile" targetId={item.targetId} options={["dismiss"]} />
                  </div>
                ) : (
                  <>
                    <DecisionButtons targetType={item.targetType} targetId={item.targetId} options={item.moderation === "visible" ? ["dismiss", "hide", "remove"] : ["restore", "remove", "dismiss"]} />
                    {item.author.userId && item.author.handle && <SuspendForm userId={item.author.userId} handle={item.author.handle} />}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="section" aria-labelledby="pq-h">
        <h2 id="pq-h">Waiting for approval ({pending.length})</h2>
        {!settings.preModeration && pending.length === 0 ? <p className="muted">Approval is off: posts go live straight away.</p> : pending.length === 0 ? <div className="empty">Nothing waiting.</div> : (
          <ul className="list">
            {pending.map((p) => (
              <li key={p.targetId} className="list-item">
                <span><span className="tn-badge">{p.targetType}</span> <Link href={p.link}>{p.title}</Link> <span className="muted">by @{p.handle} · {formatDateTime(p.createdAt)}</span></span>
                <DecisionButtons targetType={p.targetType} targetId={p.targetId} options={["approve", "remove"]} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="section" aria-labelledby="hd-h">
        <h2 id="hd-h">Hidden and removed ({hidden.length})</h2>
        {hidden.length === 0 ? <div className="empty">Nothing hidden.</div> : (
          <ul className="list">
            {hidden.map((h) => (
              <li key={h.targetId} className="list-item">
                <span><span className="tn-badge">{h.targetType}</span> <Link href={h.link}>{h.title}</Link> <span className="muted">by @{h.handle} · {h.moderation}</span></span>
                <DecisionButtons targetType={h.targetType} targetId={h.targetId} options={h.moderation === "hidden" ? ["restore", "remove"] : ["restore"]} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="section" aria-labelledby="sp-h">
        <h2 id="sp-h">Paused members ({suspended.length})</h2>
        {suspended.length === 0 ? <div className="empty">No one is paused.</div> : (
          <ul className="list">
            {suspended.map((s) => (
              <li key={s.userId} className="list-item">
                <span><Link href={`/u/${s.handle}`}>@{s.handle}</Link> <span className="muted">until {formatDateTime(s.until)}{s.reason ? ` · ${s.reason}` : ""}</span></span>
                <SuspendForm userId={s.userId} handle={s.handle} suspended />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="section" aria-labelledby="st-h">
        <h2 id="st-h">Community rules</h2>
        {canConfigure(actor) ? <SettingsForm settings={settings} /> : (
          <p className="muted">Approval before posting: {settings.preModeration ? "on" : "off"}. Fan spinoffs: {settings.allowFanWorks ? "accepted" : "not accepted"}. Auto-hide after {settings.autoHideReports} reports. Only admins can change these.</p>
        )}
      </section>
    </>
  );
}
