import Link from "next/link";
import { RULES } from "@/lib/game/engine";
import { DECK_RULES } from "@/lib/game/cards";

export const metadata = { title: "How to play" };

export default function Rules() {
  return (
    <article className="stack" style={{ maxWidth: "70ch" }}>
      <h1 className="tn-h1">How to play</h1>
      <p className="tn-eyebrow">Toon physics. Real scars.</p>
      <p>Two teams race. The first to reach <strong>{RULES.finish} distance</strong> wins. If nobody gets there in {RULES.turnLimit} turns each, whoever is further ahead wins.</p>
      <h2>Your turn</h2>
      <ol>
        <li>Draw a card (the first player skips this on turn 1) and get fuel equal to your turn number, up to {RULES.maxFuel}.</li>
        <li>Spend fuel to play cards. <strong>Racers</strong> go on your track (up to {RULES.trackSlots}). <strong>Cars</strong> go to a racer who drives. <strong>Tricks</strong> happen at once. <strong>Field</strong> cards stay in play.</li>
        <li>Each racer may do one thing: <strong>bump</strong> an enemy racer, or use its <strong>ability</strong>. Racers that just arrived can only race.</li>
        <li>End your turn. Every racer who didn&apos;t act (and isn&apos;t spun out) <strong>races</strong> and adds its pace to your distance.</li>
      </ol>
      <h2>Damage: bounce, cars and scars</h2>
      <p>Every racer has <strong>bounce</strong>. Gag damage hits bounce first, and bounce pops back at the start of your turn. That&apos;s toon physics.</p>
      <p>Damage that gets past bounce hits the racer&apos;s <strong>car</strong> next. A car that runs out of armor accordions and goes back to your hand, ready for the next panel.</p>
      <p>Anything left becomes <strong>scars</strong>. Scars never heal. When scars reach a racer&apos;s grit, they&apos;re out of the race. Some cards, like the Sticker Drone and the airship&apos;s claw, deal scars straight away.</p>
      <h2>Card numbers</h2>
      <p>Game numbers come from the printed stats: pace is Speed ÷ 3, punch is Power ÷ 3, grit is Grit, bounce is Toon ÷ 4 (all rounded up). Cars add pace, armor and sometimes punch or bounce; a racer in their own car gets +1 pace.</p>
      <h2>Decks</h2>
      <p>Exactly {DECK_RULES.size} cards, at least {DECK_RULES.minRacers} racers, up to {DECK_RULES.maxCopies} copies of a card and 1 of each Legendary character (a Full Art card counts as that character). You can only use cards you own.</p>
      <p><Link href="/play/battle">Start a race</Link></p>
      <p className="muted small">These rules and card numbers are a first draft for the studio to approve.</p>
    </article>
  );
}
