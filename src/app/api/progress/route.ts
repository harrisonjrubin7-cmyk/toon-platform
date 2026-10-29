import { z } from "zod";
import { db } from "@/lib/db";
import { currentActor } from "@/lib/auth/session";
import { saveProgress } from "@/lib/domain/catalog";
import { isAppError } from "@/lib/errors";

const body = z.object({ releaseId: z.string().uuid(), position: z.number().int().min(0), completed: z.boolean().default(false) });

export async function POST(request: Request) {
  const actor = await currentActor();
  if (!actor) return new Response(null, { status: 204 }); // visitors: nothing to save
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Bad request" }, { status: 400 });
  try {
    await saveProgress(db, actor, parsed.data.releaseId, parsed.data.position, parsed.data.completed);
    return new Response(null, { status: 204 });
  } catch (e) {
    if (isAppError(e)) return Response.json({ error: e.message }, { status: e.code === "not_found" ? 404 : 400 });
    throw e;
  }
}
