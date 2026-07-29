import "server-only";

import { sendEmail } from "@/lib/email/provider";
import { renderQuoteEmail } from "@/lib/email/templates/quote-request";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { areExternalBoundariesDisabled, externalBoundarySkipReason } from "@/lib/runtime/external-boundaries";
import type { Json } from "@/lib/supabase/database.types";
import type { QuoteRequestInput } from "@/lib/validations/quote-request";
import { buildQuoteNotificationPlans, deliverQuoteNotification, type InsertLogResult, type NotificationSummary } from "@/lib/leads/quote-notification-core";

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;

type ProcessQuoteNotificationsInput = {
  supabase: SupabaseAdminClient;
  leadId: string;
  contactId: string;
  quoteRequestId: string;
  input: QuoteRequestInput;
  normalizedEmail: string | null;
  adminWhatsAppHref: string;
  clientWhatsAppHref: string;
};

function incidentStatusForNotification(status: "queued" | "skipped" | "sent" | "failed" | "ambiguous") {
  return status === "sent" || status === "skipped" ? "resolved" : "open";
}

export function buildQuoteNotificationLogRow(values: { leadId: string; contactId: string; quoteRequestId: string; recipient: string | null; templateName: string; status: "queued" | "skipped"; reason?: string; payload: Json }) {
  return {
    lead_id: values.leadId,
    contact_id: values.contactId,
    quote_request_id: values.quoteRequestId,
    channel: "email",
    provider: "resend",
    recipient: values.recipient,
    template_name: values.templateName,
    status: values.status,
    error_message: values.reason ?? null,
    payload: values.payload,
    incident_status: incidentStatusForNotification(values.status),
    incident_updated_at: new Date().toISOString(),
  };
}

export function buildQuoteNotificationLookup(values: { quoteRequestId: string; recipient: string | null; templateName: string }) {
  return {
    quoteRequestId: values.quoteRequestId,
    channel: "email" as const,
    recipient: values.recipient ?? "",
    templateName: values.templateName,
  };
}

async function insertLog(supabase: SupabaseAdminClient, values: { leadId: string; contactId: string; quoteRequestId: string; recipient: string | null; templateName: string; status: "queued" | "skipped"; reason?: string; payload: Json }): Promise<InsertLogResult> {
  const row = buildQuoteNotificationLogRow(values);
  const inserted = await supabase.from("notification_logs").insert(row).select("id").single();
  if (!inserted.error && inserted.data?.id) return { id: inserted.data.id as string };
  const lookup = buildQuoteNotificationLookup({ quoteRequestId: values.quoteRequestId, recipient: values.recipient, templateName: values.templateName });
  const existing = await supabase
    .from("notification_logs")
    .select("id,status,provider_message_id")
    .eq("quote_request_id", lookup.quoteRequestId)
    .eq("channel", lookup.channel)
    .eq("recipient", lookup.recipient)
    .eq("template_name", lookup.templateName)
    .maybeSingle();
  if (existing.data?.id) {
    return {
      id: existing.data.id as string,
      existingStatus: existing.data.status as InsertLogResult["existingStatus"],
      providerMessageId: existing.data.provider_message_id as string | null,
    };
  }
  throw inserted.error ?? new Error("Unable to create notification log");
}

async function updateLog(supabase: SupabaseAdminClient, id: string, values: { status: "sent" | "failed" | "skipped" | "ambiguous"; error?: string | null; providerMessageId?: string; payload: Json }) {
  const { error } = await supabase
    .from("notification_logs")
    .update({ status: values.status, error_message: values.error ?? null, provider_message_id: values.providerMessageId ?? null, sent_at: values.status === "sent" ? new Date().toISOString() : null, payload: values.payload, last_attempt_at: new Date().toISOString(), locked_at: null, incident_status: incidentStatusForNotification(values.status), incident_updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function processQuoteNotifications(values: ProcessQuoteNotificationsInput): Promise<NotificationSummary[]> {
  const summaries: NotificationSummary[] = [];
  const plans = buildQuoteNotificationPlans(values.input, values.normalizedEmail);

  if (areExternalBoundariesDisabled()) {
    const reason = externalBoundarySkipReason("email");
    for (const plan of plans) {
      await insertLog(values.supabase, {
        leadId: values.leadId,
        contactId: values.contactId,
        quoteRequestId: values.quoteRequestId,
        recipient: plan.recipient,
        templateName: plan.templateName,
        status: "skipped",
        reason,
        payload: { quoteRequestId: values.quoteRequestId, leadId: values.leadId, locale: values.input.locale, destination: values.input.mainDestination, disabledForE2E: true } satisfies Json,
      });
      summaries.push({ kind: plan.templateName, status: "skipped", reason, recipient: plan.recipient });
    }
    return summaries;
  }

  for (const plan of plans) {
    const summary = await deliverQuoteNotification({
      plan,
       context: { quoteRequestId: values.quoteRequestId, leadId: values.leadId, contactId: values.contactId, locale: values.input.locale, destination: values.input.mainDestination },
       render: () => renderQuoteEmail({ templateName: plan.templateName, input: values.input, leadId: values.leadId, quoteRequestId: values.quoteRequestId, normalizedEmail: values.normalizedEmail, adminWhatsAppHref: values.adminWhatsAppHref, clientWhatsAppHref: values.clientWhatsAppHref }) as { subject: string; text: string; html: string; metadata: Json },
      insertLog: ({ status, reason, payload }) => insertLog(values.supabase, { leadId: values.leadId, contactId: values.contactId, quoteRequestId: values.quoteRequestId, recipient: plan.recipient, templateName: plan.templateName, status, reason, payload }),
      updateLog: (id, input) => updateLog(values.supabase, id, input),
      send: sendEmail,
    });
    summaries.push(summary);
  }
  return summaries;
}

export const quoteNotificationInternals = {
  buildQuoteNotificationLogRow,
  buildQuoteNotificationLookup,
};
