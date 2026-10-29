"use client";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="card stack" style={{ maxWidth: 520, margin: "40px auto" }} role="alert">
      <p className="tn-eyebrow" aria-hidden="true">Error</p>
      <h1 className="tn-h2">This page didn’t load</h1>
      <p>Something went wrong on our side, so nothing is shown. Please try again. If it keeps happening, tell the studio team{error.digest ? ` and quote code ${error.digest}` : ""}.</p>
      <button className="tn-btn tn-btn--primary" onClick={reset}>Try again</button>
    </div>
  );
}
