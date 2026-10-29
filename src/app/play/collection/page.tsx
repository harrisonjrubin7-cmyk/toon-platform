import Link from "next/link";
import { db, withTx } from "@/lib/db";
import { requirePageRole } from "@/lib/auth/session";
import * as cards from "@/lib/domain/cards";
import { setPublicAction } from "@/app/actions/game";
import { Binder } from "@/components/game/binder";
import { RARITIES, RARITY_INFO } from "@/lib/game/cards";

export const metadata = { title: "Collection" };

const FILTERS = [["all", "All"], ["owned", "Owned"], ["missing", "Missing"], ...RARITIES.map((r) => [r, RARITY_INFO[r].label])] as const;

export default async function Collection({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const actor = await requirePageRole("reader", "/play/collection");
  const { show = "all" } = await searchParams;
  await withTx((tx) => cards.ensureStarter(tx, actor));
  const [owned, profile] = await Promise.all([cards.getCollection(db, actor), cards.getProfile(db, actor)]);
  return (
    <>
      <div className="spread">
        <h1 className="tn-h1">My collection</h1>
        <form action={setPublicAction} className="row">
          <input type="hidden" name="on" value={profile.publicCollection ? "0" : "1"} />
          <span className="muted small">{profile.publicCollection ? "Your binder is public." : "Your binder is private."}</span>
          <button className="tn-btn tn-btn--secondary sm" type="submit">{profile.publicCollection ? "Make private" : "Share my binder"}</button>
          {profile.publicCollection && <Link className="small" href={`/play/collectors/${actor.id}`}>Public page</Link>}
        </form>
      </div>
      <nav aria-label="Filter cards" className="row" style={{ margin: "12px 0" }}>
        {FILTERS.map(([k, label]) => (
          <Link key={k} href={`/play/collection?show=${k}`} className={`tn-badge ${show === k ? "tn-badge--info" : ""}`} aria-current={show === k ? "true" : undefined}>{label}</Link>
        ))}
      </nav>
      <Binder owned={owned} summary={cards.portfolio(owned)} filter={show} />
      <p className="muted small">Sharing shows your display name, your cards and your record, and adds your Epic and better pulls to the garage feed. Your email is never shown.</p>
    </>
  );
}
