import { redirect } from "next/navigation";
import { currentActor, safeNext } from "@/lib/auth/session";
import { LoginForm } from "@/components/auth-forms";

export const metadata = { title: "Sign in" };

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  if (await currentActor()) redirect(next);
  return (
    <div style={{ maxWidth: 440, margin: "0 auto" }}>
      <h1 className="tn-h2">Sign in</h1>
      <LoginForm next={next} />
    </div>
  );
}
