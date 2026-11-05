"use server";
import { claimCustomerQuoteWork, manageCustomerQuoteWork } from "@/lib/admin/customer-quote-work";
import type { QuoteFeedbackState } from "@/components/customer/quote-actions";

export async function customerQuoteWorkAction(eventId: string, previous: QuoteFeedbackState, form: FormData): Promise<QuoteFeedbackState> {
  const command = form.get("command");
  const parts = typeof command === "string" ? command.split(":") : [];
  const result = command === "claim" ? await claimCustomerQuoteWork(eventId)
    : await manageCustomerQuoteWork(parts.length === 2 ? { eventId, requestId: parts[1], targetStatus: parts[0],
      cancelReason: parts[0] === "canceled" ? form.get("cancelReason") : null } : null);
  return {
    status: result.ok ? "success" : "failure", sequence: Number.isSafeInteger(previous.sequence) ? previous.sequence + 1 : 1,
    message: result.ok ? command === "claim" ? "Assignment refreshed." : "Task action recorded."
      : "The work item could not be updated. Retry the same action or reload to check its current status.",
  };
}
