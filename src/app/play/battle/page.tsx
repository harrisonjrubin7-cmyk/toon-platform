import Link from "next/link";
import { randomInt } from "node:crypto";
import { db, withTx } from "@/lib/db";
import { requirePageRole } from "@/lib/auth/session";
import { ensureStarter, listDecks } from "@/lib/domain/cards";
import { AI_OPPONENTS, aiOpponent } from "@/lib/game/decks";
import { Battle } from "@/components/game/battle";
import { RULES } from "@/lib/game/engine";

export const metadata = { title: "Battle" };

export default async function BattlePage({ searchParams }: { searchParams: Promise<{ deck?: string; opponent?: string }> }) {
  const actor = await requirePageRole("reader", "/play/battle");
  await withTx((tx) => ensureStarter(tx, actor));
  const sp = await searchParams;
  const decks = (await listDecks(db, actor)).filter((d) => d.problems.length === 0);
  const deck = decks.find((d) => d.id === sp.deck);
  const opp = sp.opponent ? aiOpponent(sp.opponent) : null;

  if (deck && opp) {
    return (
      <>
        <p className="crumbs"><Link href="/play/battle">Battle</Link> / {deck.name} vs {opp.name}</p>
        <h1 className="visually-hidden">{deck.name} vs {opp.name}</h1>
        <Battle key={`${deck.id}-${opp.id}`} playerName={actor.displayName} deck={deck.cards} opponent={{ id: opp.id, name: opp.name, deck: [...opp.deck] }} seed={randomInt(0, 2 ** 31)} />
      </>
    );
  }

  return (
    <>
      <h1 className="tn-h1">Battle</h1>
      <p>First team to {RULES.finish} distance wins. <Link href="/play/rules">How to play</Link></p>
      {decks.length === 0 ? (
        <p className="empty">You don&apos;t have a race-ready deck. <Link href="/play/decks">Fix one up</Link>.</p>
      ) : (
        <form method="get" className="form-grid card">
          <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="tn-field__label">Your deck</legend>
            {decks.map((d, i) => (
              <label key={d.id} className="checkbox"><input type="radio" name="deck" value={d.id} defaultChecked={sp.deck ? d.id === sp.deck : i === 0} /> <span>{d.name}</span></label>
            ))}
          </fieldset>
          <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="tn-field__label">Opponent</legend>
            {AI_OPPONENTS.map((o, i) => (
              <label key={o.id} className="checkbox"><input type="radio" name="opponent" value={o.id} defaultChecked={i === 0} /> <span><strong>{o.name}</strong><br /><span className="muted small">{o.blurb}</span></span></label>
            ))}
          </fieldset>
          <div><button className="tn-btn tn-btn--primary" type="submit">Start the race</button></div>
        </form>
      )}
      <p className="muted small" style={{ marginTop: 16 }}>Racing other players is coming next.</p>
    </>
  );
}
