import { UnsubscribeForm } from "@/components/email-forms";

export const metadata = { title: "Email settings", robots: { index: false } };

// The link only shows a button; the change happens on POST, so mail scanners
// that open links can't unsubscribe anyone by accident.
export default async function Unsubscribe({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const t = (await searchParams).t ?? "";
  return (
    <div style={{ maxWidth: 440, margin: "0 auto" }}>
      <h1 className="tn-h2">Release emails</h1>
      <UnsubscribeForm token={t} />
    </div>
  );
}
