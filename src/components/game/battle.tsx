"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { card } from "@/lib/game/cards";
import { apply, GameError, newGame, racerStats, RULES, type Action, type GameState, type Racer, type Side } from "@/lib/game/engine";
import { chooseAction } from "@/lib/game/ai";
import { recordAiMatchAction } from "@/app/actions/game";
import { CardFace } from "./card-face";

type Pick =
  | { kind: "none" }
  | { kind: "hand"; uid: string; needs: "own" | "enemy" }
  | { kind: "racer"; uid: string }
  | { kind: "bump"; uid: string }
  | { kind: "ability"; uid: string };

const OWN_TARGET = new Set(["pit_stop", "nitro"]);
const ENEMY_TARGET = new Set(["oil_slick", "net_cannon", "boxing_glove", "sticker_drone", "claw_smog"]);
const ABILITY_TARGET = new Set(["backfire", "sneaky_lever", "sneeze"]);

function needsFor(cardId: string): "own" | "enemy" | null {
  const c = card(cardId);
  if (c.kind === "car") return "own";
  const id = c.ability?.id ?? "";
  if (OWN_TARGET.has(id)) return "own";
  if (ENEMY_TARGET.has(id)) return "enemy";
  return null;
}

/** A match against the computer, run entirely in the browser with the shared rules engine. */
export function Battle({ playerName, deck, opponent, seed }: { playerName: string; deck: string[]; opponent: { id: string; name: string; deck: string[] }; seed: number }) {
  // The seed comes from the server so the first render matches on both sides.
  const [s, setS] = useState<GameState>(() => newGame({ seed, names: [playerName, opponent.name], decks: [deck, opponent.deck] }));
  const [pick, setPick] = useState<Pick>({ kind: "none" });
  const [err, setErr] = useState("");
  const recorded = useRef(false);
  const ME: Side = 0, CPU: Side = 1;
  const me = s.players[ME], foe = s.players[CPU];
  const myTurn = s.active === ME && s.winner === null;

  // Computer turn: one action every half second so you can follow it.
  useEffect(() => {
    if (s.winner !== null || s.active !== CPU) return;
    const t = setTimeout(() => {
      let a: Action = chooseAction(s, CPU);
      try { setS(apply(s, CPU, a)); } catch { a = { type: "end" }; setS(apply(s, CPU, a)); }
    }, s.players[CPU].turns === 0 ? 300 : 550);
    return () => clearTimeout(t);
  }, [s]);

  useEffect(() => {
    if (s.winner === null || recorded.current) return;
    recorded.current = true;
    void recordAiMatchAction({ opponent: opponent.id, result: s.winner === "draw" ? "draw" : s.winner === ME ? "win" : "loss" });
  }, [s.winner, opponent.id]);

  function act(a: Action) {
    setErr("");
    try { setS(apply(s, ME, a)); setPick({ kind: "none" }); }
    catch (e) { if (e instanceof GameError) setErr(e.message); else throw e; }
  }

  function clickHand(uid: string, cardId: string) {
    if (!myTurn) return;
    const needs = needsFor(cardId);
    if (!needs) return act({ type: "play", uid });
    setPick({ kind: "hand", uid, needs });
  }
  function clickRacer(side: Side, r: Racer) {
    if (!myTurn) return;
    if (pick.kind === "hand") {
      if ((pick.needs === "own") !== (side === ME)) return setErr(pick.needs === "own" ? "Pick one of your racers." : "Pick an enemy racer.");
      return act({ type: "play", uid: pick.uid, target: r.uid });
    }
    if (pick.kind === "bump" && side === CPU) return act({ type: "bump", racer: pick.uid, target: r.uid });
    if (pick.kind === "ability" && side === CPU) return act({ type: "ability", racer: pick.uid, target: r.uid });
    if (side === ME) setPick(pick.kind === "racer" && pick.uid === r.uid ? { kind: "none" } : { kind: "racer", uid: r.uid });
  }

  const selectedRacer = pick.kind === "racer" ? me.track.find((r) => r.uid === pick.uid) : undefined;
  const targeting = (pick.kind === "hand" && pick.needs === "enemy") || pick.kind === "bump" || pick.kind === "ability";
  const prompt =
    pick.kind === "hand" ? `Pick ${pick.needs === "own" ? "one of your racers" : "an enemy racer"} for ${card(me.hand.find((c) => c.uid === pick.uid)?.cardId ?? "vr-blaze").name}.` :
    pick.kind === "bump" ? "Pick an enemy racer to bump." :
    pick.kind === "ability" ? "Pick an enemy racer." :
    myTurn ? "Play cards, then end your turn. Racers who didn't act race at the end of your turn." : s.winner === null ? `${foe.name} is thinking…` : "";

  return (
    <div className="battle">
      <Lane s={s} side={CPU} label={foe.name} targeting={targeting} onRacer={(r) => clickRacer(CPU, r)} />
      <Lane s={s} side={ME} label={`${me.name} (you)`} targeting={pick.kind === "hand" && pick.needs === "own"} selected={pick.kind === "racer" ? pick.uid : undefined} onRacer={(r) => clickRacer(ME, r)} />

      {s.winner !== null ? (
        <div className={`tn-notice ${s.winner === ME ? "tn-notice--success" : ""}`} role="status">
          <span className="tn-notice__title">{s.winner === "draw" ? "Dead heat." : s.winner === ME ? "You win!" : `${foe.name} wins.`}</span>{" "}
          <Link href="/play/battle">Race again</Link> · <Link href="/play/packs">Packs</Link>
        </div>
      ) : null}

      <section aria-label="Your hand">
        <div className="spread"><h2 style={{ margin: 0 }}>Hand</h2><span className="muted small">{me.deck.length} in deck · {me.scrap.length} in scrap</span></div>
        <div className="hand">
          {me.hand.map((c) => {
            const d = card(c.cardId);
            return (
              <button key={c.uid} type="button" className={`hand-card ${pick.kind === "hand" && pick.uid === c.uid ? "is-selected" : ""}`} disabled={!myTurn || d.cost > me.fuel}
                onClick={() => clickHand(c.uid, c.cardId)} aria-label={`${d.name}, ${d.cost} fuel. ${d.ability?.text ?? ""}`} title={d.ability?.text}>
                <CardFace cardId={c.cardId} size="s" caption={false} />
                <span className="small"><strong>{d.name}</strong> · {d.cost} fuel</span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="action-bar">
        <span aria-label={`${me.fuel} fuel`} className="fuel">{Array.from({ length: Math.min(RULES.maxFuel, Math.max(me.turns, 1)) }, (_, i) => <i key={i} className={i < me.fuel ? "" : "empty"} />)}</span>
        <span className="small" aria-live="polite">{err ? <span style={{ color: "var(--error)" }}>{err}</span> : prompt}</span>
        <span style={{ flex: 1 }} />
        {selectedRacer && !selectedRacer.acted && (
          <>
            {!selectedRacer.justPlayed && <button type="button" className="tn-btn tn-btn--secondary sm" onClick={() => setPick({ kind: "bump", uid: selectedRacer.uid })}>Bump ({racerStats(s, ME, selectedRacer).punch})</button>}
            {card(selectedRacer.cardId).ability?.activated && (
              <button type="button" className="tn-btn tn-btn--secondary sm" title={card(selectedRacer.cardId).ability!.text}
                onClick={() => ABILITY_TARGET.has(card(selectedRacer.cardId).ability!.id) ? setPick({ kind: "ability", uid: selectedRacer.uid }) : act({ type: "ability", racer: selectedRacer.uid })}>
                {card(selectedRacer.cardId).ability!.name}
              </button>
            )}
          </>
        )}
        {pick.kind !== "none" && <button type="button" className="tn-btn tn-btn--secondary sm" onClick={() => setPick({ kind: "none" })}>Cancel</button>}
        <button type="button" className="tn-btn tn-btn--primary" disabled={!myTurn} onClick={() => act({ type: "end" })}>End turn</button>
        {s.winner === null && <button type="button" className="linklike" onClick={() => act({ type: "concede" })}>Concede</button>}
      </div>

      <details open>
        <summary>Race log</summary>
        <ol className="battle-log" aria-live="off">{s.log.slice(-40).map((l, i) => <li key={i}>{l}</li>)}</ol>
      </details>
    </div>
  );
}

function Lane({ s, side, label, targeting, selected, onRacer }: { s: GameState; side: Side; label: string; targeting: boolean; selected?: string; onRacer: (r: Racer) => void }) {
  const p = s.players[side];
  return (
    <section className={`lane ${side === 1 ? "lane--foe" : ""}`} aria-label={label}>
      <div className="lane__head">
        <strong>{label}{s.active === side && s.winner === null ? " · racing now" : ""}</strong>
        <span className="small">{p.distance}/{RULES.finish} distance · turn {p.turns} · {side === 1 ? `${p.hand.length} cards in hand` : ""}</span>
      </div>
      <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={RULES.finish} aria-valuenow={p.distance} aria-label={`${label} distance`}><i style={{ width: `${Math.min(100, (p.distance / RULES.finish) * 100)}%` }} /></div>
      {p.field.length > 0 && <div className="field-cards">In play: {p.field.map((f) => <span key={f.uid} className="tn-badge">{card(f.cardId).name}</span>)}</div>}
      <div className="racers">
        {p.track.length === 0 && <p className="muted small">No racers on the track.</p>}
        {p.track.map((r) => {
          const st = racerStats(s, side, r);
          const d = card(r.cardId);
          return (
            <button key={r.uid} type="button" onClick={() => onRacer(r)}
              className={`racer ${selected === r.uid ? "is-selected" : ""} ${targeting ? "is-target" : ""} ${r.acted ? "is-done" : ""}`}
              aria-label={`${d.name}: ${st.gritLeft} of ${st.grit} grit, ${r.bounceLeft} bounce, pace ${st.pace}, punch ${st.punch}${r.car ? `, in ${card(r.car.cardId).name} with ${r.car.armor} armor` : ""}${r.stalled ? ", spun out" : ""}${r.acted ? ", done this turn" : ""}`}>
              <CardFace cardId={r.cardId} size="s" caption={false} />
              <span className="racer__stats">
                <strong>{d.name}</strong>
                <span>Pace {st.pace} · Punch {st.punch}</span>
                <span className="racer__bars" title="Grit (green), scars (red)">{Array.from({ length: st.grit }, (_, i) => <i key={i} className={`pip ${i >= st.gritLeft ? "pip--scar" : ""}`} />)}</span>
                <span className="racer__bars" title="Bounce left this turn">{Array.from({ length: r.bounceLeft }, (_, i) => <i key={i} className="pip pip--bounce" />)}</span>
                {r.car && <span className="small">{card(r.car.cardId).name} <span className="racer__bars">{Array.from({ length: r.car.armor }, (_, i) => <i key={i} className="pip pip--armor" />)}</span></span>}
                {r.stalled && <span className="small" style={{ color: "var(--error)" }}>Spun out</span>}
                {r.justPlayed && side === s.active && <span className="small muted">Just arrived</span>}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
