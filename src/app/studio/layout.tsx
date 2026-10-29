import { requirePageRole } from "@/lib/auth/session";
import { permissions } from "@/lib/roles";
import { NavLinks } from "@/components/nav";

export const metadata = { title: { default: "Studio", template: "%s · Studio · Toon" }, robots: { index: false } };

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const actor = await requirePageRole("editor", "/studio");
  return (
    <div className="studio-shell">
      <aside>
        <p className="label" style={{ marginBottom: 8 }}>Studio</p>
        <NavLinks
          className="studio-nav"
          links={[
            { href: "/studio", label: "Series" },
            ...(permissions.manageUsers(actor) ? [{ href: "/studio/users", label: "People and roles" }] : []),
            ...(permissions.viewActivity(actor) ? [{ href: "/studio/activity", label: "Activity log" }] : []),
          ]}
        />
      </aside>
      <div className="stack">{children}</div>
    </div>
  );
}
