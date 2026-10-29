"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({ links, className, label }: { links: { href: string; label: string }[]; className: string; label?: string }) {
  const path = usePathname();
  return (
    <nav className={className} aria-label={label ?? (className === "studio-nav" ? "Studio" : "Main")}>
      {links.map((l) => {
        // A section root such as "/play" is only active on itself when its children have their own links.
        const exact = l.href === "/" || links.some((o) => o.href !== l.href && o.href.startsWith(l.href + "/"));
        const active = exact ? path === l.href : path === l.href || path.startsWith(l.href + "/");
        return (
          <Link key={l.href} href={l.href} aria-current={active ? "page" : undefined}>
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
