import "server-only";
import { notFound, redirect } from "next/navigation";
import { isAppError } from "./errors";

/** Turns domain errors into the right page response. */
export async function load<T>(p: Promise<T>, returnTo = "/"): Promise<T> {
  try {
    return await p;
  } catch (e) {
    if (isAppError(e)) {
      if (e.code === "not_found") notFound();
      if (e.code === "unauthenticated") redirect(`/login?next=${encodeURIComponent(returnTo)}`);
      if (e.code === "forbidden") redirect("/forbidden");
    }
    throw e;
  }
}
