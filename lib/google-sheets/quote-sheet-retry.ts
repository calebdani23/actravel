import "server-only";

import { getGoogleSheetsConfig } from "@/lib/google-sheets/client";
import { buildLeadSheetRow } from "@/lib/google-sheets/lead-row";
import { appendLeadToSheet, type SheetSyncStatus, type SheetSyncSummary } from "@/lib/google-sheets/quote-sheet-sync";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Json, Tables } from "@/lib/supabase/database.types";
import { normalizeEmail, normalizeWhatsApp, type QuoteRequestInput } from "@/lib/validations/quote-request";

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;
type SheetLog = Tables<"sheet_sync_logs">;
type Dependencies = { supabase?: SupabaseAdminClient; append?: typeof appendLeadToSheet; now?: () => string };

export type SheetRetryResult = SheetSyncSummary & { logId: string };

const RETRYABLE_STATUSES: SheetSyncStatus[] = ["failed", "queued"];

function sanitizeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Google Sheets sync failed";
  return message.replace(/(key|token|secret|password|private[_-]?key)=[^\s]+/gi, "$1=[redacted]").slice(0, 500);
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

function basePayload(values: { log: SheetLog; input: QuoteRequestInput; metadata?: Json }): Json {
  return { quoteRequestId: values.log.quote_request_id, leadId: values.log.lead_id, locale: values.input.locale, destination: values.input.mainDestination, service: values.input.serviceInterest, metadata: values.metadata ?? null };
}

async function loadQuoteRequest(supabase: SupabaseAdminClient, log: SheetLog) {
  const quoteRequestId = log.quote_request_id ?? stringValue(asRecord(log.payload).quoteRequestId);
  if (!quoteRequestId) throw new Error("Sheet sync log is missing quoteRequestId");
  const { data, error } = await supabase.from("quote_requests").select("id, payload").eq("id", quoteRequestId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Quote request was not found for Sheet retry");
  return { id: data.id as string, input: inputFromPayload(data.payload as Json) };
}

async function claimLog(supabase: SupabaseAdminClient, log: SheetLog, actorId: string, now: string) {
  const { data, error } = await supabase.from("sheet_sync_logs").update({ status: "processing", attempt_count: (log.attempt_count ?? 0) + 1, last_attempt_at: now, locked_at: now, last_retried_by: actorId, error_message: null }).eq("id", log.id).in("status", RETRYABLE_STATUSES).select("*").maybeSingle();
  if (error) throw new Error(error.message);
  return data as SheetLog | null;
}

async function finishLog(supabase: SupabaseAdminClient, id: string, input: Partial<SheetLog>) {
  const { error } = await supabase.from("sheet_sync_logs").update({ ...input, locked_at: null, last_attempt_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function retrySheetSyncLog(logId: string, actorId: string, dependencies: Dependencies = {}): Promise<SheetRetryResult> {
  const supabase = dependencies.supabase ?? createSupabaseAdminClient();
  const now = dependencies.now?.() ?? new Date().toISOString();
  const { data: loaded, error } = await supabase.from("sheet_sync_logs").select("*").eq("id", logId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!loaded) throw new Error("Sheet sync log was not found");
  const log = loaded as SheetLog;

  if (log.status === "success" && log.row_id) return { kind: "quote_request_sheet_sync", status: "success", logId, rowId: log.row_id, reason: "Google Sheets row already appended; retry skipped." };
  if (log.status === "processing" || log.status === "ambiguous" || log.status === "skipped") return { kind: "quote_request_sheet_sync", status: log.status, logId, rowId: log.row_id, reason: `Google Sheets log is ${log.status}; manual retry skipped.` };
  if (!RETRYABLE_STATUSES.includes(log.status)) throw new Error(`Sheet sync status ${log.status} is not retryable`);

  const claimed = await claimLog(supabase, log, actorId, now);
  if (!claimed) {
    const { data: latest } = await supabase.from("sheet_sync_logs").select("status,row_id").eq("id", logId).maybeSingle();
    const status = (latest?.status ?? "processing") as SheetSyncStatus;
    return { kind: "quote_request_sheet_sync", status, logId, rowId: (latest?.row_id as string | null) ?? null, reason: `Google Sheets log is ${status}; retry claim skipped.` };
  }

  let quote: Awaited<ReturnType<typeof loadQuoteRequest>> | null = null;
  try {
    quote = await loadQuoteRequest(supabase, claimed);
    const config = getGoogleSheetsConfig();
    if ("missing" in config) {
      const reason = `Google Sheets sync retry failed: missing ${config.missing.join(", ")}.`;
      await finishLog(supabase, logId, { status: "failed", error_message: reason, payload: basePayload({ log: claimed, input: quote.input, metadata: { missing: config.missing } }) });
      return { kind: "quote_request_sheet_sync", status: "failed", logId, rowId: null, reason };
    }
    const row = buildLeadSheetRow({ leadId: claimed.lead_id ?? "", input: quote.input, normalizedEmail: normalizeEmail(quote.input.email), normalizedWhatsapp: normalizeWhatsApp(quote.input.whatsapp) });
    const result = await (dependencies.append ?? appendLeadToSheet)({ config, row });
    const payload = basePayload({ log: claimed, input: quote.input, metadata: { rowId: result.rowId, provider: result.raw ?? null } });
    try {
      await finishLog(supabase, logId, { status: "success", error_message: null, row_id: result.rowId, payload });
    } catch (updateError) {
      const reason = `Log update failed after append: ${sanitizeError(updateError)}`;
      try {
        await finishLog(supabase, logId, { status: "ambiguous", error_message: reason, row_id: result.rowId, payload });
      } catch {}
      return { kind: "quote_request_sheet_sync", status: "ambiguous", logId, rowId: result.rowId, reason };
    }
    return { kind: "quote_request_sheet_sync", status: "success", logId, rowId: result.rowId };
  } catch (appendError) {
    const reason = sanitizeError(appendError);
    await finishLog(supabase, logId, { status: "failed", error_message: reason, payload: quote ? basePayload({ log: claimed, input: quote.input }) : claimed.payload });
    return { kind: "quote_request_sheet_sync", status: "failed", logId, rowId: null, reason };
  }
}

export const sheetRetryInternals = { inputFromPayload };
