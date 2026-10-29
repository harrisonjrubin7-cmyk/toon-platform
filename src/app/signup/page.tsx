import { redirect } from "next/navigation";
import { currentActor, safeNext } from "@/lib/auth/session";
import { SignupForm } from "@/components/auth-forms";

export const metadata = { title: "Create an account" };

export default async function Signup({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  if (await currentActor()) redirect(next);
  return (
    <div style={{ maxWidth: 440, margin: "0 auto" }}>
      <h1 className="tn-h2">Join Tune</h1>
      <p className="muted">Save your place in every issue and episode, and follow the series you love.</p>
      <SignupForm next={next} />
    </div>
  );
}
