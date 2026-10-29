import Link from "next/link";
import { db, withTx } from "@/lib/db";
import { requirePageRole } from "@/lib/auth/session";
import { ensureStarter, listDecks } from "@/lib/domain/cards";

export const metadata = { title: "Decks" };

export default async function Decks() {
  const actor = await requirePageRole("reader", "/play/decks");
  await withTx((tx) => ensureStarter(tx, actor));
  const decks = await listDecks(db, actor);
  return (
    <>
      <div className="spread">
        <h1 className="tn-h1">Decks</h1>
        <Link className="tn-btn tn-btn--primary" href="/play/decks/new">New deck</Link>
      </div>
      {decks.length ? (
        <ul className="list">
          {decks.map((d) => (
            <li key={d.id} className="list-item">
              <span>
                <Link href={`/play/decks/${d.id}`}><strong>{d.name}</strong></Link>{" "}
                <span className="muted small">{d.cards.length} cards · {d.problems.length ? `Needs work: ${d.problems[0]}` : "Race-ready"}</span>
              </span>
              <span className="row">
                {!d.problems.length && <Link className="tn-btn tn-btn--secondary sm" href={`/play/battle?deck=${d.id}`}>Race</Link>}
                <Link className="tn-btn tn-btn--secondary sm" href={`/play/decks/${d.id}`}>Edit</Link>
              </span>
            </li>
          ))}
        </ul>
      ) : <p className="empty">No decks yet.</p>}
    </>
  );
}
