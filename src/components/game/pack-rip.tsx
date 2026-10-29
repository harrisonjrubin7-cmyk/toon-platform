"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { openPackAction } from "@/app/actions/game";
import { card, RARITY_INFO, VARIANT_INFO } from "@/lib/game/cards";
import type { Pull } from "@/lib/game/packs";
import { CardFace } from "./card-face";

type Phase = "sealed" | "ripping" | "reveal" | "done" | "error";

const isHit = (p: Pull) => ["epic", "legendary", "secret"].includes(p.rarity) || p.variant !== "base";

/**
 * Rip a pack: tear it open, then flip the cards one at a time with the best card last.
 * The cards are decided on the server before the animation starts; the animation only reveals them.
 */
export function PackRip({ packId, packName, nextPackId }: { packId: string; packName: string; nextPackId: string | null }) {
  const [phase, setPhase] = useState<Phase>("sealed");
  const [pulls, setPulls] = useState<Pull[]>([]);
  const [newCards, setNewCards] = useState<string[]>([]);
  const [shown, setShown] = useState(0);
  const [faceUp, setFaceUp] = useState(false);
  const [error, setError] = useState("");
  const live = useRef<HTMLParagraphElement>(null);
  const flipBtn = useRef<HTMLButtonElement>(null);

  async function rip() {
    if (phase !== "sealed") return;
    setPhase("ripping");
    const [res] = await Promise.all([openPackAction(packId), new Promise((r) => setTimeout(r, 800))]);
    if (!res.ok) { setError(res.error); setPhase("error"); return; }
    setPulls(res.pulls);
    setNewCards(res.newCards);
    setPhase("reveal");
  }

  useEffect(() => { if (phase === "reveal") flipBtn.current?.focus(); }, [phase, shown]);

  // Two taps per card: flip it face up, then move on to the next face-down card.
  function flip() {
    if (faceUp) {
      setFaceUp(false);
      if (shown >= pulls.length) setPhase("done");
      return;
    }
    const p = pulls[shown];
    if (!p) return;
    const c = card(p.cardId);
    if (live.current) live.current.textContent = `${c.name}. ${RARITY_INFO[c.rarity].label}${p.variant !== "base" ? `, ${VARIANT_INFO[p.variant].label}${p.serial ? ` number ${p.serial} of 50` : ""}` : ""}${newCards.includes(p.cardId) ? ". New to your collection!" : ""}`;
    setShown(shown + 1);
    setFaceUp(true);
  }

  if (phase === "error") {
    return <div className="tn-notice tn-notice--error" role="alert"><span className="tn-notice__title">Couldn&apos;t open the pack</span> {error} <Link href="/play/packs">Back to packs</Link></div>;
  }

  if (phase === "sealed" || phase === "ripping") {
    return (
      <div className="rip">
        <button type="button" className={`pack ${phase === "ripping" ? "is-ripping" : ""}`} onClick={rip} aria-busy={phase === "ripping" || undefined} disabled={phase === "ripping"}>
          <span className="pack__tear" aria-hidden />
          <span className="pack__inner">
            <span>
              <span className="pack__title">{packName}</span><br />
              <span className="small">Volcano Racers · Series 1</span><br /><br />
              <span className="tn-eyebrow">{phase === "ripping" ? "Ripping…" : "Tap to rip"}</span>
            </span>
          </span>
        </button>
        <p className="muted small">The cards inside were sealed when you got the pack. Opening it just shows you.</p>
      </div>
    );
  }

  return (
    <div className="stack">
      <p ref={live} className="visually-hidden" aria-live="polite" />
      {phase === "reveal" && (
        <div className="reveal-stage">
          <p className="muted">{shown} of {pulls.length} revealed{!faceUp && shown === pulls.length - 1 ? ". Last card…" : ""}</p>
          <button ref={flipBtn} type="button" className={`reveal-card ${faceUp ? "is-flipped" : ""} ${faceUp && isHit(pulls[shown - 1]) ? "is-hit" : ""}`} onClick={flip}
            aria-label={faceUp ? (shown < pulls.length ? `Next card (${shown + 1} of ${pulls.length})` : "See all cards") : `Flip card ${shown + 1} of ${pulls.length}`}>
            <div className="reveal-card__inner">
              <div className="reveal-card__back gc gc--l" aria-hidden><div className="gc__frame"><img src="/game/cards/back-generic.jpg" alt="" /></div></div>
              <div className="reveal-card__front">
                {faceUp && <CardFace cardId={pulls[shown - 1].cardId} variant={pulls[shown - 1].variant} serial={pulls[shown - 1].serial} size="l" caption={false} />}
              </div>
            </div>
          </button>
          {faceUp && (() => {
            const p = pulls[shown - 1];
            const c = card(p.cardId);
            return (
              <p className="row" style={{ justifyContent: "center" }}>
                <strong>{c.name}</strong>
                <span className={`gc__rarity gc__rarity--${c.rarity}`}>{RARITY_INFO[c.rarity].glyph} {RARITY_INFO[c.rarity].label}</span>
                {p.variant !== "base" && <span className="gc__variant">{VARIANT_INFO[p.variant].label.replace(" /50", "")}{p.serial ? ` ${p.serial}/50` : ""}</span>}
                {newCards.includes(p.cardId) && <span className="tn-badge tn-badge--new">New</span>}
              </p>
            );
          })()}
          <p className="muted small">{faceUp ? "Tap the card for the next one." : "Tap the card to flip it."}</p>
          <button type="button" className="linklike" onClick={() => { setShown(pulls.length); setPhase("done"); }}>Show all</button>
        </div>
      )}
      {phase === "done" && (
        <>
          <h2>You pulled</h2>
          <div className="pull-strip">
            {pulls.map((p, i) => (
              <div key={i} className={`stack ${isHit(p) ? "is-hit" : ""}`} style={{ gap: 4 }}>
                <CardFace cardId={p.cardId} variant={p.variant} serial={p.serial} size="m" />
                {newCards.includes(p.cardId) && <span className="tn-badge tn-badge--new">New</span>}
              </div>
            ))}
          </div>
          <div className="row" style={{ justifyContent: "center" }}>
            {nextPackId ? <a className="tn-btn tn-btn--primary" href={`/play/packs/open/${nextPackId}`}>Rip the next pack</a> : <Link className="tn-btn tn-btn--primary" href="/play/packs">Back to packs</Link>}
            <Link className="tn-btn tn-btn--secondary" href="/play/collection">See my collection</Link>
          </div>
        </>
      )}
    </div>
  );
}
