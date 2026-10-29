import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requirePageRole } from "@/lib/auth/session";
import { getMyProfile } from "@/lib/domain/community/profiles";
import { getSettings } from "@/lib/domain/community/shared";
import { listPublishedSeries } from "@/lib/domain/catalog";
import { IdeaForm } from "@/components/community/forms";

export const metadata = { title: "Pitch an idea" };

export default async function NewIdea({ searchParams }: { searchParams: Promise<{ spinoff?: string }> }) {
  const sp = await searchParams;
  const here = sp.spinoff ? `/ideas/new?spinoff=${encodeURIComponent(sp.spinoff)}` : "/ideas/new";
  const actor = await requirePageRole("reader", here);
  const profile = await getMyProfile(db, actor);
  if (!profile || !profile.termsCurrent) redirect(`/create/profile?next=${encodeURIComponent(here)}`);
  const [series, settings] = await Promise.all([listPublishedSeries(db), getSettings(db)]);
  return (
    <div className="stack" style={{ maxWidth: 720 }}>
      <h1 className="tn-h1">Pitch an idea</h1>
      <p className="muted">Share a premise for a new story or a spinoff, and see what the community thinks. Anyone can pick up an idea and turn it into a comic.</p>
      <IdeaForm series={series.map((s) => ({ id: s.id, title: s.title }))} allowFanWorks={settings.allowFanWorks} defaultSpinoff={series.find((s) => s.slug === sp.spinoff)?.id} />
    </div>
  );
}
