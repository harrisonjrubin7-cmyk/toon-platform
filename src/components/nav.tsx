"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({ links, className }: { links: { href: string; label: string }[]; className: string }) {
  const path = usePathname();
  return (
    <nav className={className} aria-label={className === "studio-nav" ? "Studio" : "Main"}>
      {links.map((l) => {
        const active = l.href === "/" ? path === "/" : path === l.href || path.startsWith(l.href + "/");
        return (
          <Link key={l.href} href={l.href} aria-current={active ? "page" : undefined}>
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
