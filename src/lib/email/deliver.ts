import { after } from "next/server";
import { db } from "../db";
import { deliverDueEmails } from "./outbox";
import { configuredTransport } from "./transport";

/** Sends whatever is due once the current response has gone out, so forms never wait on the email provider. */
export function sendDueEmailsAfterResponse() {
  after(async () => {
    try {
      const report = await deliverDueEmails(db, configuredTransport());
      if (report.failed || report.skipped) console.warn("email delivery", report);
    } catch (e) {
      console.error("email delivery failed", e);
    }
  });
}
