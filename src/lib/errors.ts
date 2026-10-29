export type ErrorCode = "unauthenticated" | "forbidden" | "not_found" | "invalid" | "conflict";

export class AppError extends Error {
  constructor(public code: ErrorCode, message: string, public fields?: Record<string, string>) {
    super(message);
    this.name = "AppError";
  }
}

export const isAppError = (e: unknown): e is AppError => e instanceof AppError;

/** Shape returned to forms by server actions. */
export type ActionState = { ok?: boolean; error?: string; fields?: Record<string, string>; message?: string } | undefined;

export function toActionState(e: unknown): ActionState {
  if (isAppError(e)) return { error: e.message, fields: e.fields };
  console.error(e);
  return { error: "Something went wrong. Please try again." };
}
