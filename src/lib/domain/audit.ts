import type { Queryable } from "../db";

export async function audit(q: Queryable, actorId: string | null, action: string, entityType: string, entityId: string | null, detail: Record<string, unknown> = {}) {
  await q.query(
    "insert into audit_log (actor_id, action, entity_type, entity_id, detail) values ($1,$2,$3,$4,$5)",
    [actorId, action, entityType, entityId, JSON.stringify(detail)],
  );
}
