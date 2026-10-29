/* eslint-disable @next/next/no-img-element -- static SVG brand marks; next/image adds nothing for vectors. */
import Link from "next/link";

export const STUDIO_NAME = "Tune Comics & Studios";

/**
 * Tune studio signature, per Brand & Design System 1.0: the transparent wordmark on
 * light backgrounds only (never under 240 CSS px wide), and the folded-T emblem on its
 * own charcoal ground for dark themes. The brand kit's tn-on-light / tn-on-dark classes
 * pick the right one for the active theme.
 */
export function StudioLogo({ width = 240, emblem = 40 }: { width?: number; emblem?: number }) {
  return (
    <span className="studio-logo">
      <img className="tn-on-light" src="/brand/logos/transparent-wordmark.png" alt={STUDIO_NAME} width={Math.max(width, 240)} height={Math.round(Math.max(width, 240) / 3)} />
      <img className="tn-on-dark" src="/brand/logos/social-icon.jpg" alt={STUDIO_NAME} width={Math.max(emblem, 32)} height={Math.max(emblem, 32)} />
    </span>
  );
}

/** The folded-T emblem on its charcoal ground; works on any theme. */
export function StudioEmblem({ size = 96 }: { size?: number }) {
  return <img className="studio-emblem" src="/brand/logos/social-icon.jpg" alt="" width={Math.max(size, 32)} height={Math.max(size, 32)} />;
}

export function SiteLogoLink() {
  return (
    <Link href="/" className="logo-link" aria-label={`${STUDIO_NAME} home`}>
      <StudioLogo />
    </Link>
  );
}

/** "A Tune Comics & Studios original" endorsement, in words only (no emblem at this size). */
export function Endorsement() {
  return <span className="tn-lockup__endorse">A {STUDIO_NAME} original</span>;
}

/** An IP's mark, with the dark variant when one exists alongside it (name-on-dark.svg). */
export function IpMark({ src, title, className = "ip-mark" }: { src: string | null; title: string; className?: string }) {
  if (!src) return <h1 className="tn-h1">{title}</h1>;
  const dark = onDarkVariant(src);
  return (
    <h1 style={{ margin: 0 }}>
      <img src={src} alt={title} className={`${className}${dark ? " tn-on-light" : ""}`} />
      {dark && <img src={dark} alt={title} className={`${className} tn-on-dark`} />}
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

/** The on-dark file for a brand-kit wordmark (name-wordmark.svg → name-wordmark-on-dark.svg), else null. */
export function onDarkVariant(src: string) {
  return /^\/brand\/logos\/.+-wordmark\.svg$/.test(src) ? src.replace(/\.svg$/, "-on-dark.svg") : null;
}

/** A series mark on a cover fallback: themed IPs sit on dark basalt, so they always get the on-dark file. */
export function CoverMark({ src, theme }: { src: string; theme: string | null | undefined }) {
  const dark = onDarkVariant(src);
  const style = { objectFit: "contain" as const };
  if (dark && theme && theme !== "studio") return <img src={dark} alt="" className="tn-issue__mark" style={style} />;
  return (
    <>
      <img src={src} alt="" className={`tn-issue__mark${dark ? " tn-on-light" : ""}`} style={style} />
      {dark && <img src={dark} alt="" className="tn-issue__mark tn-on-dark" style={style} />}
    </>
  );
}

export function ipClass(theme: string | null | undefined) {
  return theme && theme !== "studio" ? `tn-ip--${theme}` : "";
}
