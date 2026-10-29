import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const started = Date.now();
  try {
    await db.query("select 1");
    return Response.json({ ok: true, db: "up", ms: Date.now() - started, commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null });
  } catch {
    return Response.json({ ok: false, db: "down" }, { status: 503 });
  }
}
