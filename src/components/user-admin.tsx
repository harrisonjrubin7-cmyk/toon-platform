"use client";
import { useActionState } from "react";
import { setDisabledAction, setRoleAction } from "@/app/actions/admin";
import { FormAlert, SubmitButton } from "./forms";

export function UserRowControls({ userId, role, disabled, isSelf }: { userId: string; role: string; disabled: boolean; isSelf: boolean }) {
  const [rs, roleAct] = useActionState(setRoleAction, undefined);
  const [ds, disAct] = useActionState(setDisabledAction, undefined);
  return (
    <div className="stack">
      <form action={roleAct} className="row">
        <input type="hidden" name="userId" value={userId} />
        <label className="visually-hidden" htmlFor={`role-${userId}`}>Role</label>
        <select id={`role-${userId}`} name="role" defaultValue={role} className="tn-field__input" style={{ width: "auto" }}>
          <option value="reader">Reader</option>
          <option value="editor">Editor</option>
          <option value="admin">Admin</option>
        </select>
        <SubmitButton className="tn-btn sm" pendingText="Saving…">Save role</SubmitButton>
      </form>
      {!isSelf && (
        <form action={disAct}>
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="disabled" value={disabled ? "0" : "1"} />
          <SubmitButton className={`tn-btn sm ${disabled ? "" : "tn-btn--danger"}`} pendingText="Saving…">{disabled ? "Enable account" : "Disable account"}</SubmitButton>
        </form>
      )}
      <FormAlert state={rs} />
      <FormAlert state={ds} />
    </div>
  );
}
