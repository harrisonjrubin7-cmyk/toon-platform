import { db } from "@/lib/db";
import { requirePageRole } from "@/lib/auth/session";
import { continueList, followedSeries, newForYou } from "@/lib/domain/catalog";
import { Empty, ReleaseTile, SeriesTile } from "@/components/cards";
import Link from "next/link";
import { getEmailSettings } from "@/lib/domain/email";
import { ReleaseEmailsForm } from "@/components/email-forms";

export const metadata = { title: "My library" };

export default async function Library() {
  const actor = await requirePageRole("reader", "/library");
  const [cont, follows, fresh, mail] = await Promise.all([continueList(db, actor), followedSeries(db, actor), newForYou(db, actor), getEmailSettings(db, actor)]);
  const reading = cont.filter((c) => !c.completed);
  const done = cont.filter((c) => c.completed);
  return (
    <>
      <h1 className="tn-h1">My library</h1>
      <section className="section">
        <h2>In progress</h2>
        {reading.length ? <div className="issue-grid">{reading.map((r) => <ReleaseTile key={r.id} r={r} progress={r} />)}</div> : <Empty>Nothing in progress. <Link href="/comics">Find something to read</Link>.</Empty>}
      </section>
      <section className="section">
        <h2>New from series you follow</h2>
        {fresh.length ? <div className="issue-grid">{fresh.map((r) => <ReleaseTile key={r.id} r={r} />)}</div> : <Empty>You&apos;re all caught up.</Empty>}
      </section>
      <section className="section">
        <h2>Following</h2>
        {follows.length ? <div className="issue-grid">{follows.map((s) => <SeriesTile key={s.id} s={s} />)}</div> : <Empty>Follow a series from its page to see new releases here.</Empty>}
      </section>
      <section className="section">
        <h2>Emails</h2>
        <ReleaseEmailsForm on={mail.releases} />
      </section>
      {done.length > 0 && (
        <section className="section">
          <h2>Finished</h2>
          <div className="issue-grid">{done.map((r) => <ReleaseTile key={r.id} r={r} progress={r} />)}</div>
        </section>
      )}
    </>
  );
}
