import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card stack" style={{ maxWidth: 520, margin: "40px auto" }}>
      <p className="tn-eyebrow" aria-hidden="true">404</p>
      <h1 className="tn-h2">Page not found</h1>
      <p>It may not be out yet, or it was moved.</p>
      <Link className="tn-btn tn-btn--primary" href="/">Go home</Link>
    </div>
  );
}
