import { db } from "@/lib/db";
import { load } from "@/lib/page-helpers";
import { publicCollector } from "@/lib/domain/cards";
import { Binder } from "@/components/game/binder";

export const metadata = { title: "Collector" };

export default async function Collector({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await load(publicCollector(db, id));
  return (
    <>
      <h1 className="tn-h1">{c.displayName}&apos;s binder</h1>
      <p className="muted">Record vs players {c.vsPlayers.won}–{c.vsPlayers.lost} · vs the computer {c.vsComputer.won}–{c.vsComputer.lost}</p>
      <Binder owned={c.owned} summary={c.summary} filter="owned" />
    </>
  );
}
