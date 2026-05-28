import "server-only";

import { createGoogleSheetsClient, getGoogleSheetsConfig, quoteSheetName, type GoogleSheetsConfig } from "@/lib/google-sheets/client";
import { buildLeadSheetRow } from "@/lib/google-sheets/lead-row";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import type { QuoteRequestInput } from "@/lib/validations/quote-request";

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;

export type SheetSyncStatus = "queued" | "processing" | "success" | "skipped" | "failed" | "ambiguous";
export type SheetSyncSummary = { kind: "quote_request_sheet_sync"; status: SheetSyncStatus; reason?: string; rowId?: string | null };

type ProcessQuoteSheetSyncInput = {
  supabase: SupabaseAdminClient;
  leadId: string;
  quoteRequestId: string;
  input: QuoteRequestInput;
  normalizedEmail: string | null;
  normalizedWhatsapp: string;
};

type AppendValues = (input: { config: GoogleSheetsConfig; row: string[] }) => Promise<{ rowId: string | null; raw?: Json }>;

function sanitizeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Google Sheets sync failed";
  return message.replace(/(key|token|secret|password|private[_-]?key)=[^\s]+/gi, "$1=[redacted]").slice(0, 500);
}

function basePayload(values: ProcessQuoteSheetSyncInput, metadata?: Json): Json {
  return {
    quoteRequestId: values.quoteRequestId,
    leadId: values.leadId,
    locale: values.input.locale,
    destination: values.input.mainDestination,
    service: values.input.serviceInterest,
    metadata: metadata ?? null,
  };
}

export function quoteSheetIdempotencyKey(values: { quoteRequestId: string; sheetName: string }) {
  return `quote:${values.quoteRequestId}:sheet:${values.sheetName}:push`;
}

type SheetLogResult = { id: string; existingStatus?: SheetSyncStatus; rowId?: string | null };

async function insertLog(supabase: SupabaseAdminClient, values: { leadId: string; quoteRequestId: string; sheetName: string; status: "queued" | "skipped"; reason?: string; payload: Json }): Promise<SheetLogResult> {
  const idempotencyKey = quoteSheetIdempotencyKey({ quoteRequestId: values.quoteRequestId, sheetName: values.sheetName });
  const inserted = await supabase
    .from("sheet_sync_logs")
    .insert({
      lead_id: values.leadId,
      quote_request_id: values.quoteRequestId,
      idempotency_key: idempotencyKey,
      direction: "push",
      sheet_name: values.sheetName,
      row_id: null,
      status: values.status,
      error_message: values.reason ?? null,
      payload: values.payload,
    })
    .select("id")
    .single();
  if (!inserted.error && inserted.data?.id) return { id: inserted.data.id as string };
  const existing = await supabase
    .from("sheet_sync_logs")
    .select("id,status,row_id")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (existing.data?.id) return { id: existing.data.id as string, existingStatus: existing.data.status as SheetSyncStatus, rowId: existing.data.row_id as string | null };
  throw inserted.error ?? new Error("Unable to create Google Sheets sync log");
}

async function updateLog(supabase: SupabaseAdminClient, id: string, values: { status: SheetSyncStatus; error?: string | null; rowId?: string | null; payload: Json }) {
  const { error } = await supabase
    .from("sheet_sync_logs")
    .update({ status: values.status, error_message: values.error ?? null, row_id: values.rowId ?? null, payload: values.payload, last_attempt_at: new Date().toISOString(), locked_at: null })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function appendLeadToSheet({ config, row }: { config: GoogleSheetsConfig; row: string[] }) {
  const sheets = createGoogleSheetsClient(config);
  const response = await sheets.spreadsheets.values.append({
    spreadsheetId: config.spreadsheetId,
    range: `${quoteSheetName(config.leadsTab)}!A:S`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [row] },
  });
  const rowId = response.data.updates?.updatedRange ?? response.data.tableRange ?? null;
  return { rowId, raw: { updatedRange: response.data.updates?.updatedRange ?? null, tableRange: response.data.tableRange ?? null } satisfies Json };
}

export async function deliverQuoteSheetSync(values: ProcessQuoteSheetSyncInput, appendValues: AppendValues = appendLeadToSheet): Promise<SheetSyncSummary> {
  const config = getGoogleSheetsConfig();
  const missing = "missing" in config ? config.missing : [];
  const sheetName = "missing" in config ? process.env.GOOGLE_SHEETS_LEADS_TAB ?? "leads" : config.leadsTab;
  let logId: string | null = null;

  try {
    if ("missing" in config) {
      const reason = `Google Sheets sync skipped: missing ${missing.join(", ")}.`;
      await insertLog(values.supabase, { leadId: values.leadId, quoteRequestId: values.quoteRequestId, sheetName, status: "skipped", reason, payload: basePayload(values, { missing }) });
      return { kind: "quote_request_sheet_sync", status: "skipped", reason };
    }

    const log = await insertLog(values.supabase, { leadId: values.leadId, quoteRequestId: values.quoteRequestId, sheetName, status: "queued", payload: basePayload(values) });
    logId = log.id;
    if (log.existingStatus === "success" && log.rowId) {
      return { kind: "quote_request_sheet_sync", status: "success", rowId: log.rowId, reason: "Google Sheets row already appended previously; skipped duplicate append." };
    }
    if (log.existingStatus === "processing" || log.existingStatus === "ambiguous" || log.existingStatus === "skipped") {
      return { kind: "quote_request_sheet_sync", status: log.existingStatus, rowId: log.rowId, reason: `Google Sheets log is ${log.existingStatus}; skipped duplicate append.` };
    }
    const row = buildLeadSheetRow({ leadId: values.leadId, input: values.input, normalizedEmail: values.normalizedEmail, normalizedWhatsapp: values.normalizedWhatsapp });
    const result = await appendValues({ config, row });
    try {
      await updateLog(values.supabase, logId, { status: "success", rowId: result.rowId, payload: basePayload(values, { rowId: result.rowId, provider: result.raw ?? null }) });
    } catch (error) {
      const reason = `Log update failed after append: ${sanitizeError(error)}`;
      try {
        await updateLog(values.supabase, logId, { status: "ambiguous", error: reason, rowId: result.rowId, payload: basePayload(values, { rowId: result.rowId }) });
      } catch {
        // Keep returning the append result; the warning makes the row a manual-review case.
      }
      return { kind: "quote_request_sheet_sync", status: "success", rowId: result.rowId, reason };
    }
    return { kind: "quote_request_sheet_sync", status: "success", rowId: result.rowId };
  } catch (error) {
    const reason = sanitizeError(error);
    if (logId) {
      try {
        await updateLog(values.supabase, logId, { status: "failed", error: reason, payload: basePayload(values) });
      } catch (updateError) {
        return { kind: "quote_request_sheet_sync", status: "failed", reason: `${reason} | Log update failed: ${sanitizeError(updateError)}` };
      }
    }
    return { kind: "quote_request_sheet_sync", status: "failed", reason };
  }
}

export async function processQuoteSheetSync(values: ProcessQuoteSheetSyncInput): Promise<SheetSyncSummary> {
  return deliverQuoteSheetSync(values);
}
