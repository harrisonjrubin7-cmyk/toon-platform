import { db } from "@/lib/db";
import { requirePageRole, safeNext } from "@/lib/auth/session";
import { getMyProfile } from "@/lib/domain/community/profiles";
import { storageMode } from "@/lib/storage";
import { ProfileForm } from "@/components/community/forms";

export const metadata = { title: "Creator profile" };

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const actor = await requirePageRole("reader", "/create/profile");
  const profile = await getMyProfile(db, actor);
  const next = safeNext((await searchParams).next, "/create");
  return (
    <div className="stack" style={{ maxWidth: 640 }}>
      <h1 className="tn-h1">{profile ? "Your creator profile" : "Set up your creator profile"}</h1>
      {profile && !profile.termsCurrent && <div className="tn-notice" role="status">The community guidelines changed. Please review and accept them to keep posting.</div>}
      <p className="muted">Your profile is public. It shows your handle, picture, bio, and the comics and ideas you post.</p>
      <ProfileForm userId={actor.id} mode={storageMode()} initial={profile && { handle: profile.handle, bio: profile.bio, avatarUrl: profile.avatarUrl }} next={next} />
    </div>
  );
}
