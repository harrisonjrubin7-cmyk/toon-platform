import { db } from "@/lib/db";
import { requirePageRole } from "@/lib/auth/session";
import { listUsers } from "@/lib/domain/accounts";
import { load } from "@/lib/page-helpers";
import { formatDate } from "@/lib/format";
import { UserRowControls } from "@/components/user-admin";

export const metadata = { title: "People and roles" };

export default async function Users({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const actor = await requirePageRole("admin", "/studio/users");
  const q = (await searchParams).q ?? "";
  const users = await load(listUsers(db, actor, q));
  return (
    <>
      <h1 className="tn-h2">People and roles</h1>
      <div className="card tn-supporting">
        <strong>Reader</strong>: reads, watches, follows and saves progress. <strong>Editor</strong>: also creates, uploads, publishes and deletes studio content. <strong>Admin</strong>: also changes roles, disables accounts and sees the activity log. The studio always keeps at least one admin.
      </div>
      <form role="search" className="row">
        <label htmlFor="uq" className="visually-hidden">Find people</label>
        <input id="uq" name="q" type="search" defaultValue={q} placeholder="Name or email" className="tn-field__input" style={{ maxWidth: 320 }} />
        <button className="tn-btn sm" type="submit">Find</button>
      </form>
      <div className="table-wrap">
        <table>
          <thead><tr><th scope="col">Person</th><th scope="col">Joined</th><th scope="col">Status</th><th scope="col">Role and access</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td><div className="tn-body-strong">{u.displayName}{u.id === actor.id ? " (you)" : ""}</div><div className="tn-supporting muted">{u.email}</div></td>
                <td className="tn-supporting">{formatDate(u.createdAt)}</td>
                <td>{u.disabled ? <span className="tn-badge tn-badge--warn">Disabled</span> : <span className="tn-badge">Active</span>}</td>
                <td><UserRowControls userId={u.id} role={u.role} disabled={u.disabled} isSelf={u.id === actor.id} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {users.length === 0 && <div className="empty">No one matches “{q}”.</div>}
    </>
  );
}
