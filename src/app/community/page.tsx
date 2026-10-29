import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { currentActor, requireAgeGate } from "@/lib/auth/session";
import { listComics } from "@/lib/domain/community/comics";
import { listIdeas } from "@/lib/domain/community/ideas";
import { getMyProfile } from "@/lib/domain/community/profiles";
import { listPublishedSeries } from "@/lib/domain/catalog";
import { FanComicCard, IdeaCardView } from "@/components/community/cards";

export const metadata: Metadata = { title: "Community", description: "Fan comics, spinoffs and story ideas from the Tune Comics & Studio community." };

type SP = Promise<{ tab?: string; series?: string; q?: string }>;
const TABS = [
  { key: "comics", label: "Fan comics" },
  { key: "ideas", label: "Ideas and pitches" },
  { key: "following", label: "Following" },
] as const;

export default async function Community({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const tab = TABS.some((t) => t.key === sp.tab) ? sp.tab! : "comics";
  const qs = (o: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ tab, series: sp.series, q: sp.q, ...o })) if (v) p.set(k, v);
    return `/community?${p}`;
  };
  await requireAgeGate(qs({}));
  const actor = await currentActor();
  const [series, profile] = await Promise.all([listPublishedSeries(db), getMyProfile(db, actor)]);
  const filter = { seriesSlug: sp.series || undefined, term: sp.q };
  const [comics, ideas] = await Promise.all([
    tab === "ideas" ? [] : listComics(db, actor, { ...filter, following: tab === "following" }),
    tab === "comics" ? [] : listIdeas(db, actor, { ...filter, following: tab === "following" }),
  ]);
  const activeSeries = series.find((s) => s.slug === sp.series);
  return (
    <>
      <div className="spread" style={{ marginBottom: 16 }}>
        <div>
          <h1 className="tn-h1">Community</h1>
          <p className="muted" style={{ maxWidth: "60ch" }}>Comics, spinoffs and story ideas made by readers. Fan work isn&apos;t official canon. <Link href="/community/guidelines">Community guidelines</Link>.</p>
        </div>
        <div className="row">
          <Link className="tn-btn tn-btn--primary" href={profile ? "/create" : "/create/profile"}>Make a comic</Link>
          <Link className="tn-btn" href="/ideas/new">Pitch an idea</Link>
        </div>
      </div>

      <nav className="tabs" aria-label="Community sections">
        {TABS.map((t) => <Link key={t.key} href={qs({ tab: t.key })} aria-current={t.key === tab ? "page" : undefined}>{t.label}</Link>)}
      </nav>

      <form role="search" className="row" style={{ marginBottom: 20 }} action="/community">
        <input type="hidden" name="tab" value={tab} />
        <label htmlFor="cq" className="visually-hidden">Search the community</label>
        <input id="cq" name="q" type="search" defaultValue={sp.q ?? ""} placeholder="Search titles, stories or @handles" className="tn-field__input" style={{ maxWidth: 320 }} />
        <label htmlFor="cs" className="visually-hidden">Spinoffs of</label>
        <select id="cs" name="series" defaultValue={sp.series ?? ""} className="tn-field__input" style={{ width: "auto" }}>
          <option value="">All stories</option>
          {series.map((s) => <option key={s.id} value={s.slug}>Spinoffs of {s.title}</option>)}
        </select>
        <button className="tn-btn sm" type="submit">Filter</button>
      </form>

      {tab === "following" && !actor && <div className="empty"><Link href="/login?next=%2Fcommunity%3Ftab%3Dfollowing">Sign in</Link> to see posts from creators you follow.</div>}

      {tab !== "ideas" && (actor || tab !== "following") && (
        <section className="section" aria-labelledby="comics-h">
          <h2 id="comics-h" className={tab === "following" ? undefined : "visually-hidden"}>{activeSeries ? `Fan spinoffs of ${activeSeries.title}` : "Fan comics"}</h2>
          {comics.length ? <div className="fan-grid">{comics.map((c) => <FanComicCard key={c.id} c={c} />)}</div> : <div className="empty">No comics here yet. <Link href={profile ? "/create" : "/create/profile"}>Make the first one</Link>.</div>}
        </section>
      )}
      {tab !== "comics" && (actor || tab !== "following") && (
        <section className="section" aria-labelledby="ideas-h">
          <h2 id="ideas-h" className={tab === "following" ? undefined : "visually-hidden"}>Ideas and pitches</h2>
          {ideas.length ? <div className="grid-wide">{ideas.map((i) => <IdeaCardView key={i.id} i={i} />)}</div> : <div className="empty">No ideas here yet. <Link href="/ideas/new">Pitch one</Link>.</div>}
        </section>
      )}
    </>
  );
}
