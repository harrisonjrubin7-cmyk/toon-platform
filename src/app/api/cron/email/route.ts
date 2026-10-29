import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { deliverDueEmails } from "@/lib/email/outbox";
import { configuredTransport } from "@/lib/email/transport";

export const dynamic = "force-dynamic";

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

/** Sends due emails, including scheduled release notices. Called by Vercel Cron with CRON_SECRET. */
export async function GET(req: Request) {
  if (!authorized(req)) return Response.json({ ok: false }, { status: 401 });
  const report = await deliverDueEmails(db, configuredTransport(), 200);
  return Response.json({ ok: !report.skipped, ...report }, { status: report.skipped ? 503 : 200 });
}
