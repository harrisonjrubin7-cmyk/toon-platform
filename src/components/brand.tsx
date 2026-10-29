import Link from "next/link";

/** Studio logo that swaps to the on-dark artwork when the reader's OS is in dark mode. */
export function StudioLogo({ variant = "wordmark", height = 40 }: { variant?: "wordmark" | "bubble" | "monogram"; height?: number }) {
  const base = `/brand/logos/toon-studio-${variant}`;
  const dark = variant === "monogram" ? `${base}.svg` : `${base}-on-dark.svg`;
  return (
    <picture>
      <source srcSet={dark} media="(prefers-color-scheme: dark)" />
      <img src={`${base}.svg`} alt="Toon Comics & Studio" style={{ height, width: "auto" }} />
    </picture>
  );
}

export function SiteLogoLink() {
  return (
    <Link href="/" className="logo-link" aria-label="Toon Comics & Studio home">
      <StudioLogo variant="wordmark" height={40} />
    </Link>
  );
}

/** An IP's mark, with the dark variant when one exists alongside it (name-on-dark.svg). */
export function IpMark({ src, title, className = "ip-mark" }: { src: string | null; title: string; className?: string }) {
  if (!src) return <h1 className="display-l">{title}</h1>;
  const dark = /^\/brand\/logos\/.+-wordmark\.svg$/.test(src) ? src.replace(/\.svg$/, "-on-dark.svg") : null;
  return (
    <h1 style={{ margin: 0 }}>
      <picture>
        {dark && <source srcSet={dark} media="(prefers-color-scheme: dark)" />}
        <img src={src} alt={title} className={className} />
      </picture>
    </h1>
  );
}

const RATING_NOTES: Record<string, string> = { "TV-MA": "Mature", R: "18+", Mature: "18+", "TV-14": "14+", "PG-13": "13+", Teen: "Teen", "TV-PG": "PG", Unrated: "" };

export function RatingTag({ rating, note }: { rating: string; note?: string }) {
  const n = note ?? RATING_NOTES[rating] ?? "";
  return (
    <span className="tn-rating" aria-label={`Rated ${rating}${n ? `, ${n}` : ""}`}>
      <span className="tn-rating__code">{rating}</span>
      {n && <span className="tn-rating__note">{n}</span>}
    </span>
  );
}

export function ipClass(theme: string | null | undefined) {
  return theme && theme !== "studio" ? `tn-ip--${theme}` : "";
}
