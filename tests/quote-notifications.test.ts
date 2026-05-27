import assert from "node:assert/strict";
import test from "node:test";

import { renderQuoteEmail } from "@/lib/email/templates/quote-request";
import { deliverQuoteNotification } from "@/lib/leads/quote-notification-core";
import type { Json } from "@/lib/supabase/database.types";
import type { QuoteRequestInput } from "@/lib/validations/quote-request";

const input: QuoteRequestInput = {
  locale: "en",
  preferredCurrency: "USD",
  holderName: "Ada <Lovelace>",
  email: "ada@example.com",
  whatsapp: "+1 555 100 2000",
  origin: "Cancun",
  mainDestination: "Riviera Maya",
  departureDate: "2026-07-01",
  returnDate: "2026-07-07",
  adults: 2,
  children: 1,
  serviceInterest: "Family package",
  approximateBudget: 3500,
  sourceChannel: "website_quote",
  contactConsent: true,
  notes: "Need <vegan> options",
};

test("quote email templates render English copy, placeholders, and escaped HTML", () => {
  const rendered = renderQuoteEmail({ templateName: "client_quote_request_confirmation", input: { ...input, notes: "" }, leadId: "12345678-abcd", quoteRequestId: "quote-1", normalizedEmail: "ada@example.com", whatsappHref: "https://wa.me/123" });
  assert.match(rendered.subject, /We received your AC Travel request/);
  assert.match(rendered.text, /Notes: —/);
  assert.doesNotMatch(rendered.text, /{{|}}/);
  assert.match(rendered.html, /Ada &lt;Lovelace&gt;/);
});

test("notification lifecycle records queued then sent with provider metadata", async () => {
  process.env.RESEND_API_KEY = "test-key";
  process.env.EMAIL_FROM = "AC Travel <noreply@example.com>";
  const inserted: Array<{ status: string; reason?: string; payload: Json }> = [];
  const updated: Array<{ status: string; providerMessageId?: string; payload: Json }> = [];

  const summary = await deliverQuoteNotification({
    plan: { templateName: "admin_quote_request_received", recipient: "admin@example.com" },
    context: { quoteRequestId: "quote-1", leadId: "12345678-abcd", contactId: "contact-1", locale: "en", destination: "Riviera Maya" },
    render: () => ({ subject: "Subject", text: "Text", html: "<p>Text</p>", metadata: { templateName: "admin_quote_request_received" } }),
    insertLog: async (value) => { inserted.push(value); return { id: "log-1" }; },
    updateLog: async (_id, value) => { updated.push(value); },
    send: async () => ({ provider: "resend", messageId: "msg_123", raw: { id: "msg_123" } }),
  });

  assert.equal(summary.status, "sent");
  assert.equal(inserted[0].status, "queued");
  assert.equal(updated[0].status, "sent");
  assert.equal(updated[0].providerMessageId, "msg_123");
  assert.deepEqual((updated[0].payload as Record<string, unknown>).provider, { name: "resend", messageId: "msg_123", raw: { id: "msg_123" } });
});

test("notification lifecycle skips absent client email and fails provider errors without throwing", async () => {
  delete process.env.RESEND_API_KEY;
  process.env.EMAIL_FROM = "noreply@example.com";
  const skipped = await deliverQuoteNotification({
    plan: { templateName: "client_quote_request_confirmation", recipient: null, skipReason: "Client email was not provided" },
    context: { quoteRequestId: "quote-1", leadId: "12345678-abcd", contactId: "contact-1", locale: "en", destination: "Riviera Maya" },
    render: () => { throw new Error("render should not run"); },
    insertLog: async () => ({ id: "log-2" }),
    updateLog: async () => undefined,
    send: async () => { throw new Error("send should not run"); },
  });
  assert.equal(skipped.status, "skipped");
  assert.equal(skipped.reason, "Client email was not provided");

  process.env.RESEND_API_KEY = "test-key";
  const failedUpdates: Array<{ status: string; error?: string | null }> = [];
  const failed = await deliverQuoteNotification({
    plan: { templateName: "admin_quote_request_received", recipient: "admin@example.com" },
    context: { quoteRequestId: "quote-1", leadId: "12345678-abcd", contactId: "contact-1", locale: "en", destination: "Riviera Maya" },
    render: () => ({ subject: "Subject", text: "Text", html: "<p>Text</p>", metadata: {} }),
    insertLog: async () => ({ id: "log-3" }),
    updateLog: async (_id, value) => { failedUpdates.push(value); },
    send: async () => { throw new Error("provider token=secret failed"); },
  });
  assert.equal(failed.status, "failed");
  assert.equal(failedUpdates[0].status, "failed");
  assert.match(failedUpdates[0].error ?? "", /token=\[redacted\]/);
});

test("notification lifecycle avoids duplicate send when an existing log is already sent", async () => {
  let sendCalled = false;
  const summary = await deliverQuoteNotification({
    plan: { templateName: "admin_quote_request_received", recipient: "admin@example.com" },
    context: { quoteRequestId: "quote-1", leadId: "12345678-abcd", contactId: "contact-1", locale: "en", destination: "Riviera Maya" },
    render: () => ({ subject: "Subject", text: "Text", html: "<p>Text</p>", metadata: {} }),
    insertLog: async () => ({ id: "log-4", existingStatus: "sent", providerMessageId: "msg_existing" }),
    updateLog: async () => undefined,
    send: async () => {
      sendCalled = true;
      return { provider: "resend", messageId: "msg_should_not_send" };
    },
  });

  assert.equal(summary.status, "sent");
  assert.match(summary.reason ?? "", /already sent/i);
  assert.equal(sendCalled, false);
});
