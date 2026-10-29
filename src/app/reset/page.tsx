import Link from "next/link";
import { db } from "@/lib/db";
import { resetTokenIsValid } from "@/lib/domain/email";
import { ResetForm } from "@/components/email-forms";

export const metadata = { title: "Choose a new password", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Reset({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token ?? "";
  const valid = await resetTokenIsValid(db, token);
  return (
    <div style={{ maxWidth: 440, margin: "0 auto" }}>
      <h1 className="tn-h2">Choose a new password</h1>
      {valid ? (
        <ResetForm token={token} />
      ) : (
        <div className="tn-notice tn-notice--error" role="alert">
          <p className="tn-body-strong">This link has expired or was already used.</p>
          <p className="tn-body">Reset links work once, for one hour. <Link href="/forgot">Ask for a new one</Link>.</p>
        </div>
      )}
    </div>
  );
}
