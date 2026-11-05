"use server";
import { randomUUID } from "node:crypto";
import { acceptCustomerQuote, requestCustomerQuoteChange } from "@/lib/customer/quote-actions";
import type { QuoteActionState } from "@/components/customer/quote-actions";

type ViewedQuote = { quoteId: string; versionId: string; expectedLock: number;
  termsId: string | null; termsHash: string | null; documentHash: string | null };
const messages = {
  ACCESS_DENIED: "Customer access could not be verified. Sign in again.",
  INVALID_INPUT: "Confirm consent or enter a change request of 1–2,000 characters (up to 8,000 UTF-8 bytes).",
  NOT_AVAILABLE: "This proposal is no longer available for this action. Reload to review its status.",
  CONFLICT: "This submission identity was already used with different details. Reload before submitting a different request.",
  STALE_QUOTE: "The proposal changed. Reload and review the current version before submitting.",
  ACCEPTED_PROPOSAL_EXISTS: "An accepted proposal already exists. Contact your advisor; it cannot be replaced here.",
  TERMS_REQUIRED: "Acceptance is unavailable until approved terms are published.",
  TERMS_CHANGED: "The approved terms changed. Reload and review them before accepting.",
  RATE_LIMITED: "Too many change requests. Please wait before submitting another request.",
  PERSISTENCE_FAILURE: "We could not confirm this submission. Retry with the same details.",
};
export async function customerQuoteAction(view: ViewedQuote, previous: QuoteActionState, form: FormData): Promise<QuoteActionState> {
  const intent = form.get("intent"), operation = intent === "accept" || intent === "change" ? intent : null;
  const base = { quoteId: view.quoteId, versionId: view.versionId, expectedLock: view.expectedLock };
  const result = operation === "accept" ? await acceptCustomerQuote({ ...base, requestId: form.get("acceptRequestId"),
    termsId: view.termsId, termsHash: view.termsHash, documentHash: view.documentHash, consent: form.get("consent") === "on" })
    : await requestCustomerQuoteChange(operation === "change" ? { ...base, requestId: form.get("changeRequestId"), body: form.get("body") } : null);
  return {
    status: result.ok ? "success" : "failure", operation,
    sequence: Number.isSafeInteger(previous.sequence) ? previous.sequence + 1 : 1,
    nextRequestId: result.ok && operation === "change" ? randomUUID() : previous.nextRequestId,
    message: !result.ok ? messages[result.code] : "acceptanceId" in result
      ? `Proposal accepted. Receipt ${result.acceptanceId}, recorded at ${result.acceptedAt}.`
      : `Change request recorded. Reference ${result.requestId}.`,
  };
}
