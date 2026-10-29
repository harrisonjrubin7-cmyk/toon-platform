"use client";
export function sendProgress(releaseId: string, position: number, completed: boolean, signedIn: boolean) {
  if (!signedIn) return;
  const body = JSON.stringify({ releaseId, position, completed });
  fetch("/api/progress", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(() => {
    /* best effort: the next save will catch up */
  });
}
