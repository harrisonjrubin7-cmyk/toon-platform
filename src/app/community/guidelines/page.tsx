import Link from "next/link";
import { TERMS_VERSION } from "@/lib/domain/community/shared";

export const metadata = { title: "Community guidelines" };

/*
 * DRAFT terms written for the platform build. They are not legal advice and must be
 * reviewed by the studio's lawyer before public launch (tracked in docs/DECISIONS.md).
 */
export default function Guidelines() {
  return (
    <article className="stack" style={{ maxWidth: "70ch" }}>
      <p className="tn-eyebrow">Version {TERMS_VERSION} · draft pending legal review</p>
      <h1 className="tn-h1">Community guidelines and creator terms</h1>
      <p>The community is where readers make and share their own comics, spinoffs and story ideas. These rules keep it a place people want to be.</p>

      <h2 className="tn-h3">Who can join</h2>
      <p>You must be 18 or older. The site is for mature readers. Every post is rated Mature (18+) or Teen (13+, no sex and no graphic gore) so it can be shown to the right readers if a teen line opens later.</p>

      <h2 className="tn-h3">Your work stays yours</h2>
      <ul>
        <li>You keep ownership of the original comics, art and ideas you post.</li>
        <li>By posting, you let Tune Comics & Studio host, display and share your post on this site and in links to it, for as long as it&apos;s up. That permission ends when you delete it, apart from copies in backups for a short time.</li>
        <li>Only upload art you made or have permission to use. Don&apos;t trace or repost other people&apos;s work.</li>
        <li>Posting an idea doesn&apos;t give the studio any rights to it, and the studio doesn&apos;t accept pitches for its own slate through the community.</li>
      </ul>

      <h2 className="tn-h3">Spinoffs and fan works</h2>
      <ul>
        <li>When the studio allows it, you may make free, non-commercial fan works with the studio&apos;s characters and worlds, like Volcano Racers.</li>
        <li>Fan works are labelled as not official canon. The characters and worlds remain the studio&apos;s; you own only what you added.</li>
        <li>Don&apos;t sell fan works, use the studio&apos;s logos as your own, or present your work as official.</li>
      </ul>

      <h2 className="tn-h3">Not allowed, ever</h2>
      <ul>
        <li>Any sexual or sexualised content involving minors, including drawn or fictional characters who are or look under 18. We remove it, ban the account and report it to the authorities.</li>
        <li>Sexually explicit content. Mature means mature themes, violence and language, not pornography.</li>
        <li>Sexual or degrading content about real people, and anything that shares someone&apos;s private information.</li>
        <li>Harassment, hate speech, threats, or encouraging self-harm.</li>
        <li>Spam, scams and impersonation.</li>
      </ul>

      <h2 className="tn-h3">How moderation works</h2>
      <ul>
        <li>Anyone signed in can report a post, comment or profile. A child-safety report hides the post straight away until the studio reviews it. Other posts are hidden automatically after several people report them.</li>
        <li>Studio editors review reports. They can restore, hide or remove posts, and pause someone&apos;s ability to post. You&apos;ll get a notification explaining what happened.</li>
        <li>The house rule is &ldquo;toon physics, real scars&rdquo;, and lettering never covers the art: speech, captions and sound effects go in the strip under each panel.</li>
      </ul>
      <p><Link href="/community">Back to the community</Link></p>
    </article>
  );
}
