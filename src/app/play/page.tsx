import Link from "next/link";
import { db, withTx } from "@/lib/db";
import { currentActor } from "@/lib/auth/session";
import * as cards from "@/lib/domain/cards";
import { CardFace } from "@/components/game/card-face";

export const metadata = { title: "Garage" };

export default async function PlayHome() {
  const actor = await currentActor();
  if (!actor) {
    return (
      <>
        <section className="play-hero">
          <p className="tn-eyebrow">Volcano Racers · The card game</p>
          <h1 className="tn-h1">Toon physics. Real scars.</h1>
          <p>Collect the racers of Cinder Isle, build a deck and race. Hits bounce off, until they don&apos;t. Every account starts with a free 20-card starter deck.</p>
          <div className="row">
            <Link className="tn-btn tn-btn--primary" href="/signup?next=/play">Create a free account</Link>
            <Link className="tn-btn tn-btn--secondary" href="/login?next=/play">Sign in</Link>
          </div>
        </section>
        <p><Link href="/play/rules">How to play</Link> · <Link href="/play/packs/odds/ember-heart-booster">Pack odds</Link></p>
      </>
    );
  }
  const newbie = await withTx((tx) => cards.ensureStarter(tx, actor));
  const [owned, profile, sealed, pulls] = await Promise.all([
    cards.getCollection(db, actor), cards.getProfile(db, actor), cards.sealedPacks(db, actor), cards.recentPulls(db, 8),
  ]);
  const sum = cards.portfolio(owned);
  return (
    <>
      <section className="play-hero">
        <p className="tn-eyebrow">Volcano Racers · The card game</p>
        <h1 className="tn-h1">Welcome to the garage, {actor.displayName}.</h1>
        {newbie && <p role="status">Your free starter deck, Cinder Isle Garage, is in your collection. Take it for a spin against the computer.</p>}
        <div className="row">
          <Link className="tn-btn tn-btn--primary" href="/play/battle">Race the computer</Link>
          <Link className="tn-btn tn-btn--secondary" href="/play/packs">{sealed.length ? `Rip ${sealed.length} sealed pack${sealed.length > 1 ? "s" : ""}` : "Get packs"}</Link>
        </div>
      </section>

      <div className="stat-row">
        <div className="stat"><b>{sum.distinct}/{sum.total}</b><span>cards collected</span></div>
        <div className="stat"><b>{sum.copies}</b><span>copies owned</span></div>
        <div className="stat"><b>{sum.points.toLocaleString()}</b><span>collector points</span></div>
        <div className="stat"><b>{profile.vsComputer.won}–{profile.vsComputer.lost}</b><span>vs the computer</span></div>
      </div>

      <section className="section">
        <div className="play-tiles">
          <Link className="play-tile" href="/play/battle"><strong>Battle</strong><span className="muted">Race a computer team with one of your decks.</span></Link>
          <Link className="play-tile" href="/play/packs"><strong>Packs</strong><span className="muted">Rip Ember Heart Boosters. Odds are on every pack.</span></Link>
          <Link className="play-tile" href="/play/collection"><strong>Collection</strong><span className="muted">Your binder, completion and parallels.</span></Link>
          <Link className="play-tile" href="/play/decks"><strong>Decks</strong><span className="muted">Build 20-card decks from cards you own.</span></Link>
        </div>
      </section>

      <section className="section">
        <div className="section-head"><h2>Big pulls</h2><span className="muted small">From collectors who share their binder</span></div>
        {pulls.length ? (
          <div className="card-grid s">
            {pulls.map((p, i) => (
              <div key={i} className="stack" style={{ gap: 4 }}>
                <CardFace cardId={p.cardId} variant={p.variant} size="s" />
                <Link className="small" href={`/play/collectors/${p.userId}`}>{p.displayName}</Link>
              </div>
            ))}
          </div>
        ) : <p className="empty">No big pulls shared yet. Pull an Epic or better and share your binder to show up here.</p>}
      </section>
      <p className="muted small">Cards are collectibles for play. They have no cash value and can&apos;t be sold or cashed out.</p>
    </>
  );
}
