import type { Json } from "@/lib/supabase/database.types";
import type { QuoteRequestInput } from "@/lib/validations/quote-request";

export type NotificationStatus = "queued" | "sent" | "failed" | "skipped";
export type NotificationSummary = { kind: string; status: NotificationStatus; reason?: string; recipient?: string | null };
export type SendResult = { provider: "resend"; messageId?: string; raw?: Json };
export type InsertLogResult = { id: string; existingStatus?: NotificationStatus; providerMessageId?: string | null };

export type NotificationPlan = {
  templateName: "admin_quote_request_received" | "client_quote_request_confirmation";
  recipient: string | null;
  skipReason?: string;
};

export function getEmailReadiness(recipient?: string | null) {
  if (!process.env.RESEND_API_KEY) return { ready: false, reason: "RESEND_API_KEY is not configured" };
  if (!process.env.EMAIL_FROM) return { ready: false, reason: "EMAIL_FROM is not configured" };
  if (!recipient) return { ready: false, reason: "Recipient email is not configured" };
  return { ready: true, reason: null };
}

export function buildQuoteNotificationPlans(input: QuoteRequestInput, normalizedEmail: string | null): NotificationPlan[] {
  return [
    { templateName: "admin_quote_request_received", recipient: process.env.EMAIL_ADMIN ?? null },
    { templateName: "client_quote_request_confirmation", recipient: normalizedEmail, skipReason: normalizedEmail ? undefined : "Client email was not provided" },
  ];
}

export function sanitizeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Email delivery failed";
  return message.replace(/(key|token|secret|password)=[^\s]+/gi, "$1=[redacted]").slice(0, 500);
}

export function baseNotificationPayload(values: { quoteRequestId: string; leadId: string; locale: string; destination: string; template?: Json; provider?: Json }): Json {
  return { quoteRequestId: values.quoteRequestId, leadId: values.leadId, locale: values.locale, destination: values.destination, template: values.template ?? null, provider: values.provider ?? null };
}

export async function deliverQuoteNotification(values: {
  plan: NotificationPlan;
  context: { quoteRequestId: string; leadId: string; contactId: string; locale: string; destination: string };
  render: () => { subject: string; text: string; html: string; metadata: Json };
  insertLog: (input: { status: "queued" | "skipped"; reason?: string; payload: Json }) => Promise<InsertLogResult>;
  updateLog: (id: string, input: { status: "sent" | "failed" | "skipped"; error?: string | null; providerMessageId?: string; payload: Json }) => Promise<void>;
  send: (input: { to: string; subject: string; text: string; html: string }) => Promise<SendResult>;
}) {
  const readiness = values.plan.skipReason ? { ready: false, reason: values.plan.skipReason } : getEmailReadiness(values.plan.recipient);
  const payload = baseNotificationPayload({ quoteRequestId: values.context.quoteRequestId, leadId: values.context.leadId, locale: values.context.locale, destination: values.context.destination });
  let logId: string | null = null;
  try {
    const log = await values.insertLog({ status: readiness.ready ? "queued" : "skipped", reason: readiness.reason ?? undefined, payload });
    logId = log.id;
    if (log.existingStatus === "sent") {
      return {
        kind: values.plan.templateName,
        status: "sent" as const,
        reason: "Notification already sent previously; skipped duplicate send.",
        recipient: values.plan.recipient,
      };
    }
    if (!readiness.ready || !values.plan.recipient) return { kind: values.plan.templateName, status: "skipped" as const, reason: readiness.reason ?? undefined, recipient: values.plan.recipient };

    const rendered = values.render();
    const result = await values.send({ to: values.plan.recipient, subject: rendered.subject, text: rendered.text, html: rendered.html });
    let updateWarning: string | undefined;
    try {
      await values.updateLog(logId, {
        status: "sent",
        providerMessageId: result.messageId,
        payload: baseNotificationPayload({ quoteRequestId: values.context.quoteRequestId, leadId: values.context.leadId, locale: values.context.locale, destination: values.context.destination, template: rendered.metadata, provider: { name: result.provider, messageId: result.messageId ?? null, raw: result.raw ?? null } }),
      });
    } catch (error) {
      updateWarning = `Log update failed after send: ${sanitizeError(error)}`;
    }
    return { kind: values.plan.templateName, status: "sent" as const, recipient: values.plan.recipient, reason: updateWarning };
  } catch (error) {
    const reason = sanitizeError(error);
    if (logId) {
      try {
        await values.updateLog(logId, { status: "failed", error: reason, payload });
      } catch (updateError) {
        return {
          kind: values.plan.templateName,
          status: "failed" as const,
          reason: `${reason} | Log update failed: ${sanitizeError(updateError)}`,
          recipient: values.plan.recipient,
        };
      }
    }
    return { kind: values.plan.templateName, status: "failed" as const, reason, recipient: values.plan.recipient };
  }
}
