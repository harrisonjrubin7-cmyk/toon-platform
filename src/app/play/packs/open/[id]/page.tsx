import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePageRole } from "@/lib/auth/session";
import { sealedPacks, openedPacks } from "@/lib/domain/cards";
import { PackRip } from "@/components/game/pack-rip";
import { CardFace } from "@/components/game/card-face";

export const metadata = { title: "Rip a pack" };

export default async function OpenPack({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requirePageRole("reader", `/play/packs/open/${id}`);
  const sealed = await sealedPacks(db, actor);
  const pack = sealed.find((p) => p.id === id);
  if (!pack) {
    const done = (await openedPacks(db, actor, 50)).find((p) => p.id === id);
    if (!done) notFound();
    return (
      <>
        <p className="crumbs"><Link href="/play/packs">Packs</Link> / Opened</p>
        <h1 className="tn-h1">Already ripped</h1>
        <div className="pull-strip">{done.contents.map((c, i) => <CardFace key={i} cardId={c.cardId} variant={c.variant} serial={c.serial} />)}</div>
      </>
    );
  }
  const next = sealed.find((p) => p.id !== id)?.id ?? null;
  return (
    <>
      <p className="crumbs"><Link href="/play/packs">Packs</Link> / Rip</p>
      <h1 className="visually-hidden">Rip {pack.productName}</h1>
      <PackRip packId={pack.id} packName={pack.productName} nextPackId={next} />
    </>
  );
}
