import Link from "next/link";

export const metadata = { title: "No access" };

export default function Forbidden() {
  return (
    <div className="card stack" style={{ maxWidth: 520, margin: "40px auto" }}>
      <h1 className="tn-h2">You don&apos;t have access to this</h1>
      <p>This part of the site is for studio staff. If you think you should have access, ask a studio admin to change your role.</p>
      <Link className="tn-btn" href="/">Go home</Link>
    </div>
  );
}
