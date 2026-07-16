import "server-only";

import { quoteWhatsAppMessage } from "@/lib/content/public-site";
import { sendEmail } from "@/lib/email/provider";
import { renderQuoteEmail } from "@/lib/email/templates/quote-request";
import { baseNotificationPayload, sanitizeError, type NotificationStatus } from "@/lib/leads/quote-notification-core";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Json, Tables } from "@/lib/supabase/database.types";
import { normalizeEmail, type QuoteRequestInput } from "@/lib/validations/quote-request";
import { buildAbsoluteTrackedWhatsAppUrl } from "@/lib/whatsapp/link";

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;
type NotificationLog = Tables<"notification_logs">;
type Dependencies = { supabase?: SupabaseAdminClient; send?: typeof sendEmail; now?: () => string };

export type NotificationRetryResult = { kind: "notification_retry"; status: NotificationStatus; logId: string; reason?: string; recipient?: string | null };

const WHATSAPP_PHONE = "529988453455" as const;
const RETRYABLE_STATUSES: NotificationStatus[] = ["failed", "queued"];

function isRetryableStatus(status: string): status is NotificationStatus {
  return RETRYABLE_STATUSES.includes(status as NotificationStatus);
}

function asRecord(value: Json): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : null;
}

function numberValue(value: unknown) {
  return typeof value === "number" ? value : Number(value ?? 0);
}

function incidentStatusForNotification(status: NotificationStatus) {
  return status === "sent" || status === "skipped" ? "resolved" : "open";
}

function inputFromPayload(payload: Json): QuoteRequestInput {
  const data = asRecord(payload);
  return {
    locale: data.locale === "en" ? "en" : "es",
    preferredCurrency: data.preferredCurrency === "USD" ? "USD" : "MXN",
    holderName: stringValue(data.holderName) ?? "Cliente AC Travel",
    email: stringValue(data.email) ?? "",
    whatsapp: stringValue(data.whatsapp) ?? "0000000000",
    origin: stringValue(data.origin) ?? "Origen no especificado",
    mainDestination: stringValue(data.mainDestination) ?? stringValue(data.destination) ?? "Destino no especificado",
    departureDate: stringValue(data.departureDate) ?? "2099-01-01",
    returnDate: stringValue(data.returnDate) ?? stringValue(data.departureDate) ?? "2099-01-01",
    adults: Math.max(1, numberValue(data.adults)),
    children: Math.max(0, numberValue(data.children)),
    serviceInterest: stringValue(data.serviceInterest) ?? stringValue(data.service) ?? "Servicio no especificado",
    approximateBudget: Math.max(0, numberValue(data.approximateBudget)),
    sourceChannel: stringValue(data.sourceChannel) ?? "admin_retry",
    contactConsent: data.contactConsent === false ? false : true,
    notes: stringValue(data.notes) ?? undefined,
  };
}

async function loadQuoteRequest(supabase: SupabaseAdminClient, log: NotificationLog) {
  const quoteRequestId = stringValue(asRecord(log.payload).quoteRequestId);
  if (!quoteRequestId) throw new Error("Notification log is missing quoteRequestId");
  const { data, error } = await supabase.from("quote_requests").select("id, payload").eq("id", quoteRequestId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Quote request was not found for notification retry");
  return { id: data.id as string, input: inputFromPayload(data.payload as Json) };
}

async function claimLog(supabase: SupabaseAdminClient, log: NotificationLog, actorId: string, now: string) {
  const { data, error } = await supabase.from("notification_logs").update({ status: "processing", attempt_count: (log.attempt_count ?? 0) + 1, last_attempt_at: now, locked_at: now, last_retried_by: actorId, error_message: null, incident_status: "open", incident_updated_at: now, incident_updated_by: actorId }).eq("id", log.id).in("status", RETRYABLE_STATUSES).select("*").maybeSingle();
  if (error) throw new Error(error.message);
  return data as NotificationLog | null;
}

async function finishLog(supabase: SupabaseAdminClient, id: string, actorId: string, input: Partial<NotificationLog>) {
  const nextStatus = typeof input.status === "string" ? (input.status as NotificationStatus) : null;
  const { error } = await supabase.from("notification_logs").update({ ...input, locked_at: null, last_attempt_at: new Date().toISOString(), ...(nextStatus ? { incident_status: incidentStatusForNotification(nextStatus), incident_updated_at: new Date().toISOString(), incident_updated_by: actorId } : {}) }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function retryNotificationLog(logId: string, actorId: string, dependencies: Dependencies = {}): Promise<NotificationRetryResult> {
  const supabase = dependencies.supabase ?? createSupabaseAdminClient();
  const now = dependencies.now?.() ?? new Date().toISOString();
  const { data: loaded, error } = await supabase.from("notification_logs").select("*").eq("id", logId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!loaded) throw new Error("Notification log was not found");
  const log = loaded as NotificationLog;

  if (log.status === "sent") return { kind: "notification_retry", status: "sent", logId, recipient: log.recipient, reason: "Notification already sent; retry skipped." };
  if (log.status === "processing" || log.status === "ambiguous" || log.status === "skipped") return { kind: "notification_retry", status: log.status, logId, recipient: log.recipient, reason: `Notification log is ${log.status}; manual retry skipped.` };
  if (!isRetryableStatus(log.status)) throw new Error(`Notification status ${log.status} is not retryable`);

  const claimed = await claimLog(supabase, log, actorId, now);
  if (!claimed) {
    const { data: latest } = await supabase.from("notification_logs").select("status").eq("id", logId).maybeSingle();
    const status = (latest?.status ?? "processing") as NotificationStatus;
    return { kind: "notification_retry", status, logId, recipient: log.recipient, reason: `Notification log is ${status}; retry claim skipped.` };
  }

  try {
    const quote = await loadQuoteRequest(supabase, claimed);
    const normalizedEmail = normalizeEmail(quote.input.email);
    const whatsappHref = buildAbsoluteTrackedWhatsAppUrl({ message: quoteWhatsAppMessage(quote.input.locale, quote.input.holderName, quote.input.mainDestination), phone: WHATSAPP_PHONE, locale: quote.input.locale, pagePath: "admin-log-retry", leadId: claimed.lead_id ?? undefined, contactId: claimed.contact_id ?? undefined });
    if (!claimed.recipient || (claimed.template_name !== "admin_quote_request_received" && claimed.template_name !== "client_quote_request_confirmation")) throw new Error("Notification log is missing a retryable recipient or template");
    const rendered = renderQuoteEmail({ templateName: claimed.template_name, input: quote.input, leadId: claimed.lead_id ?? "unknown", quoteRequestId: quote.id, normalizedEmail, whatsappHref }) as { subject: string; text: string; html: string; metadata: Json };
    const result = await (dependencies.send ?? sendEmail)({ to: claimed.recipient, subject: rendered.subject, text: rendered.text, html: rendered.html });
    const payload = baseNotificationPayload({ quoteRequestId: quote.id, leadId: claimed.lead_id ?? "", locale: quote.input.locale, destination: quote.input.mainDestination, template: rendered.metadata, provider: { name: result.provider, messageId: result.messageId ?? null, raw: result.raw ?? null } });
    try {
        await finishLog(supabase, logId, actorId, { status: "sent", error_message: null, provider_message_id: result.messageId ?? null, sent_at: now, payload });
      } catch (updateError) {
        const reason = `Log update failed after send: ${sanitizeError(updateError)}`;
        try {
          await finishLog(supabase, logId, actorId, { status: "ambiguous", error_message: reason, provider_message_id: result.messageId ?? null, payload });
        } catch {}
        return { kind: "notification_retry", status: "ambiguous", logId, recipient: claimed.recipient, reason };
      }
      return { kind: "notification_retry", status: "sent", logId, recipient: claimed.recipient };
  } catch (sendError) {
    const reason = sanitizeError(sendError);
    await finishLog(supabase, logId, actorId, { status: "failed", error_message: reason });
    return { kind: "notification_retry", status: "failed", logId, recipient: claimed.recipient, reason };
  }
}

export const notificationRetryInternals = { inputFromPayload };
