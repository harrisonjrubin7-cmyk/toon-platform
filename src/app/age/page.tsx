import Link from "next/link";
import { safeNext } from "@/lib/auth/session";
import { confirmAgeAction } from "@/app/actions/auth";

export const metadata = { title: "Mature content" };

export default async function AgeGate({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  return (
    <div style={{ maxWidth: 520, margin: "40px auto" }} className="card stack">
      <span className="tn-rating"><span className="tn-rating__code">18+</span><span className="tn-rating__note">Mature readers</span></span>
      <h1 className="display-m">Are you 18 or older?</h1>
      <p>Tune titles are made for adults. They include violence, strong language and other mature themes.</p>
      <form action={confirmAgeAction} className="row">
        <input type="hidden" name="next" value={next} />
        <button className="tn-btn tn-btn--primary" type="submit">Yes, I&apos;m 18 or older</button>
        <Link className="tn-btn" href="/">No, take me back</Link>
      </form>
    </div>
  );
}
