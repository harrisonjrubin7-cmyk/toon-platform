import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { currentActor } from "@/lib/auth/session";
import { permissions } from "@/lib/roles";
import { logoutAction } from "./actions/auth";
import { SiteLogoLink } from "@/components/brand";
import { NavLinks } from "@/components/nav";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Tune Comics & Studio", template: "%s · Tune Comics & Studio" },
  description: "Read the comics and watch the shows from Tune Comics & Studio. Grown-up stories, made by hand.",
  icons: { icon: "/brand/logos/tune-icon-tile.svg" }, // interim favicon until the 16 px emblem exists
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const actor = await currentActor();
  return (
    <html lang="en">
      <head>
        {/* Brand kit CSS is served verbatim from public/brand so a new kit drops in unchanged. */}
        {/* eslint-disable-next-line @next/next/no-css-tags */}
        <link rel="stylesheet" href="/brand/tokens/tokens.css" />
        {/* eslint-disable-next-line @next/next/no-css-tags */}
        <link rel="stylesheet" href="/brand/tokens/components.css" />
      </head>
      <body className="tn-body">
        <a className="skip-link" href="#main">Skip to content</a>
        <header className="site-header">
          <div className="container">
            <SiteLogoLink />
            <NavLinks
              className="site-nav"
              links={[
                { href: "/comics", label: "Comics" },
                { href: "/shows", label: "Shows" },
                { href: "/series", label: "Series" },
                { href: "/search", label: "Search" },
                { href: "/play", label: "Card game" },
                ...(actor ? [{ href: "/library", label: "My library" }] : []),
                ...(permissions.viewStudio(actor) ? [{ href: "/studio", label: "Studio" }] : []),
              ]}
            />
            {actor ? (
              <form action={logoutAction} className="row" style={{ gap: 6 }}>
                <span className="tn-supporting muted" title={actor.email}>{actor.displayName}</span>
                <button className="tn-btn tn-btn--ghost sm" type="submit">Sign out</button>
              </form>
            ) : (
              <div className="row" style={{ gap: 6 }}>
                <Link className="tn-btn tn-btn--ghost sm" href="/login">Sign in</Link>
                <Link className="tn-btn tn-btn--primary sm" href="/signup">Join</Link>
              </div>
            )}
          </div>
        </header>
        <main id="main" tabIndex={-1}>
          <div className="container">{children}</div>
        </main>
        <footer className="site-footer">
          <div className="container spread">
            <span>© {new Date().getUTCFullYear()} Tune Comics & Studio. For mature readers.</span>
            <span className="row"><Link href="/series">All series</Link><Link href="/search">Search</Link></span>
          </div>
        </footer>
      </body>
    </html>
  );
}
