import { db } from "@/lib/db";
import { latestReleases } from "@/lib/domain/catalog";
import { Empty, IssueCard } from "@/components/cards";

export const metadata = { title: "Comics" };

export default async function Comics() {
  const issues = await latestReleases(db, 200, "comic");
  return (
    <>
      <h1 className="display-l">Comics</h1>
      <p className="muted">Every issue, newest first.</p>
      {issues.length ? <div className="issue-grid">{issues.map((r) => <IssueCard key={r.id} r={r} />)}</div> : <Empty>No issues are out yet.</Empty>}
    </>
  );
}
