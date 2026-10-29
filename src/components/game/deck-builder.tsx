"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveDeckAction } from "@/app/actions/game";
import { card, CARDS, DECK_RULES, type CardKind } from "@/lib/game/cards";
import { deckProblems } from "@/lib/game/engine";
import { CardFace } from "./card-face";

const KIND_LABEL: Record<CardKind, string> = { racer: "Racers", car: "Cars", trick: "Tricks", field: "Field", collectible: "Collectibles" };

/** Pick cards you own into a 20-card deck. Rules are checked live here and again on the server. */
export function DeckBuilder({ deck, owned }: { deck: { id?: string; name: string; cards: string[]; version?: number }; owned: Record<string, number> }) {
  const router = useRouter();
  const [name, setName] = useState(deck.name);
  const [list, setList] = useState<string[]>(deck.cards);
  const [version, setVersion] = useState(deck.version);
  const [id, setId] = useState(deck.id);
  const [kind, setKind] = useState<CardKind | "all">("all");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of list) m.set(c, (m.get(c) ?? 0) + 1);
    return m;
  }, [list]);
  const problems = deckProblems(list);
  const charCount = (cid: string) => list.filter((x) => card(x).character === card(cid).character).length;
  const maxFor = (cid: string) => (["legendary", "secret"].includes(card(cid).rarity) ? DECK_RULES.maxLegendaryCopies : DECK_RULES.maxCopies);
  const canAdd = (cid: string) => list.length < DECK_RULES.size && (counts.get(cid) ?? 0) < (owned[cid] ?? 0) && charCount(cid) < maxFor(cid);
  const add = (cid: string) => canAdd(cid) && setList([...list, cid]);
  const remove = (cid: string) => { const i = list.lastIndexOf(cid); if (i >= 0) setList(list.filter((_, j) => j !== i)); };

  const pool = CARDS.filter((c) => owned[c.id] && c.kind !== "collectible" && (kind === "all" || c.kind === kind));
  const grouped = [...counts.entries()].sort((a, b) => card(a[0]).cost - card(b[0]).cost || card(a[0]).name.localeCompare(card(b[0]).name));

  function save() {
    setMsg(null);
    start(async () => {
      const r = await saveDeckAction({ id, name, cards: list, version });
      if (r?.error) { setMsg({ ok: false, text: r.error }); return; }
      setId(r?.deckId); setVersion(r?.version);
      setMsg({ ok: true, text: r?.message ?? "Saved." });
      if (!id && r?.deckId) router.replace(`/play/decks/${r.deckId}`);
    });
  }

  return (
    <div className="builder">
      <section aria-labelledby="pool-h">
        <div className="spread">
          <h2 id="pool-h">Your cards</h2>
          <div className="row" role="group" aria-label="Show">
            {(["all", "racer", "car", "trick", "field"] as const).map((k) => (
              <button key={k} type="button" className={`tn-badge ${kind === k ? "tn-badge--info" : ""}`} aria-pressed={kind === k} onClick={() => setKind(k)}>{k === "all" ? "All" : KIND_LABEL[k]}</button>
            ))}
          </div>
        </div>
        <div className="builder__pool">
          {pool.map((c) => (
            <div key={c.id} className="pool-item">
              <CardFace cardId={c.id} caption={false} />
              <span className="small"><strong>{c.name}</strong><br /><span className="muted">{c.cost} fuel · {counts.get(c.id) ?? 0}/{Math.min(owned[c.id], maxFor(c.id))} in deck</span></span>
              <div className="row" style={{ gap: 4 }}>
                <button type="button" className="qty-btn" onClick={() => remove(c.id)} disabled={!counts.get(c.id)} aria-label={`Remove ${c.name}`}>−</button>
                <button type="button" className="qty-btn" onClick={() => add(c.id)} disabled={!canAdd(c.id)} aria-label={`Add ${c.name}`}>+</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <aside className="builder__deck card stack" aria-labelledby="deck-h">
        <h2 id="deck-h">Deck</h2>
        <div className="tn-field">
          <label className="tn-field__label" htmlFor="deck-name">Name</label>
          <input id="deck-name" className="tn-field__input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        </div>
        <p><strong>{list.length}/{DECK_RULES.size}</strong> cards · {list.filter((c) => card(c).kind === "racer").length} racers</p>
        {problems.length > 0 ? <ul className="problems" aria-live="polite">{problems.map((p) => <li key={p}>{p}</li>)}</ul> : <p className="tn-notice tn-notice--success" role="status">Race-ready.</p>}
        <ul className="deck-list">
          {grouped.map(([cid, n]) => (
            <li key={cid}>
              <span><span className="muted">{card(cid).cost}</span> {card(cid).name}</span>
              <span className="row" style={{ gap: 4 }}>
                <span>×{n}</span>
                <button type="button" className="qty-btn" onClick={() => remove(cid)} aria-label={`Remove one ${card(cid).name}`}>−</button>
              </span>
            </li>
          ))}
        </ul>
        {msg && <div className={`tn-notice ${msg.ok ? "tn-notice--success" : "tn-notice--error"}`} role={msg.ok ? "status" : "alert"}>{msg.text}</div>}
        <button type="button" className="tn-btn tn-btn--primary" onClick={save} disabled={pending || !name.trim()} aria-busy={pending || undefined}>{pending ? "Saving…" : "Save deck"}</button>
        <p className="muted small">Rules: exactly {DECK_RULES.size} cards, at least {DECK_RULES.minRacers} racers, up to {DECK_RULES.maxCopies} of a card and 1 of a Legendary character.</p>
      </aside>
    </div>
  );
}
