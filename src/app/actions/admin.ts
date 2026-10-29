"use server";
import { revalidatePath } from "next/cache";
import { withTx } from "@/lib/db";
import { currentActor } from "@/lib/auth/session";
import { setUserDisabled, setUserRole } from "@/lib/domain/accounts";
import { toActionState, type ActionState } from "@/lib/errors";

export async function setRoleAction(_: ActionState, f: FormData): Promise<ActionState> {
  try {
    await withTx(async (tx) => setUserRole(tx, await currentActor(), String(f.get("userId")), f.get("role")));
  } catch (e) {
    return toActionState(e);
  }
  revalidatePath("/studio/users");
  return { ok: true, message: "Role updated." };
}

export async function setDisabledAction(_: ActionState, f: FormData): Promise<ActionState> {
  try {
    await withTx(async (tx) => setUserDisabled(tx, await currentActor(), String(f.get("userId")), f.get("disabled") === "1"));
  } catch (e) {
    return toActionState(e);
  }
  revalidatePath("/studio/users");
  return { ok: true, message: f.get("disabled") === "1" ? "Account disabled." : "Account enabled." };
}
