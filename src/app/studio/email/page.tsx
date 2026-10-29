import { db } from "@/lib/db";
import { requirePageRole } from "@/lib/auth/session";
import { emailOverview } from "@/lib/domain/email";
import { configuredTransport } from "@/lib/email/transport";
import { load } from "@/lib/page-helpers";
import { formatDateTime } from "@/lib/format";
import { SendDueEmailsButton } from "@/components/email-forms";

export const metadata = { title: "Email" };

const STATUS = ["pending", "sending", "sent", "failed", "cancelled"] as const;

export default async function EmailLog() {
  const actor = await requirePageRole("admin", "/studio/email");
  const { counts, recent } = await load(emailOverview(db, actor, 100));
  const transport = configuredTransport();
  return (
    <>
      <h1 className="tn-h2">Email</h1>
      {transport?.name === "resend" ? (
        <p className="tn-body">Emails are sent through Resend.</p>
      ) : transport ? (
        <div className="tn-notice" role="status"><p className="tn-body">No email provider is set up. This is a test setup, so emails are recorded here but not delivered.</p></div>
      ) : (
        <div className="tn-notice tn-notice--error" role="alert"><p className="tn-body">No email provider is set up, so nothing is being delivered. Set RESEND_API_KEY and EMAIL_FROM.</p></div>
      )}
      <dl className="stat-row">
        {STATUS.map((s) => (<div key={s}><dt className="tn-supporting">{s}</dt><dd className="tn-h3">{counts[s] ?? 0}</dd></div>))}
      </dl>
      <SendDueEmailsButton />
      <div className="table-wrap">
        <table>
          <thead><tr><th scope="col">Due / sent (UTC)</th><th scope="col">To</th><th scope="col">Subject</th><th scope="col">Status</th></tr></thead>
          <tbody>
            {recent.map((r) => (
              <tr key={r.id}>
                <td className="tn-supporting">{formatDateTime(r.sentAt ?? r.sendAfter)}</td>
                <td className="tn-supporting">{r.to}</td>
                <td>{r.subject}</td>
                <td className="tn-supporting">{r.status}{r.attempts > 1 ? ` (${r.attempts} tries)` : ""}{r.lastError ? ` · ${r.lastError}` : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {recent.length === 0 && <div className="empty" role="status">No emails yet. Password resets and release notices will show up here.</div>}
    </>
  );
}
