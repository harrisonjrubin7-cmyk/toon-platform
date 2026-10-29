import Link from "next/link";
import { db } from "@/lib/db";
import { requirePageRole } from "@/lib/auth/session";
import { load } from "@/lib/page-helpers";
import { getCollection, getDeck } from "@/lib/domain/cards";
import { deleteDeckAction } from "@/app/actions/game";
import { DeckBuilder } from "@/components/game/deck-builder";

export const metadata = { title: "Deck builder" };

export default async function EditDeck({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requirePageRole("reader", `/play/decks/${id}`);
  const isNew = id === "new";
  const [deck, owned] = await load(Promise.all([isNew ? Promise.resolve(null) : getDeck(db, actor, id), getCollection(db, actor)]), `/play/decks/${id}`);
  const counts: Record<string, number> = {};
  for (const o of owned) counts[o.cardId] = (counts[o.cardId] ?? 0) + o.quantity;
  return (
    <>
      <p className="crumbs"><Link href="/play/decks">Decks</Link> / {deck?.name ?? "New deck"}</p>
      <h1 className="tn-h1">{deck ? `Edit ${deck.name}` : "New deck"}</h1>
      <DeckBuilder key={deck?.id ?? "new"} deck={deck ?? { name: "My deck", cards: [] }} owned={counts} />
      {deck && (
        <details style={{ marginTop: 24 }}>
          <summary>Delete this deck</summary>
          <form action={deleteDeckAction} className="row" style={{ marginTop: 8 }}>
            <input type="hidden" name="id" value={deck.id} />
            <span className="muted small">The cards stay in your collection.</span>
            <button className="tn-btn tn-btn--danger sm" type="submit">Delete {deck.name}</button>
          </form>
        </details>
      )}
    </>
  );
}
