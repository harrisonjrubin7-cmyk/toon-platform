import { NavLinks } from "@/components/nav";
import "./play.css";

export const metadata = { title: { default: "Volcano Racers: The Card Game", template: "%s · Volcano Racers cards" } };

export default function PlayLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="play tn-ip--volcano-racers">
      <NavLinks
        className="play-nav"
        label="Card game"
        links={[
          { href: "/play", label: "Garage" },
          { href: "/play/battle", label: "Battle" },
          { href: "/play/packs", label: "Packs" },
          { href: "/play/collection", label: "Collection" },
          { href: "/play/decks", label: "Decks" },
          { href: "/play/rules", label: "How to play" },
        ]}
      />
      <div style={{ marginTop: 20 }}>{children}</div>
    </div>
  );
}
