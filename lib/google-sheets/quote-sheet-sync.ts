import "server-only";

import { createGoogleSheetsClient, getGoogleSheetsConfig, quoteSheetName, type GoogleSheetsConfig } from "@/lib/google-sheets/client";
import { buildLeadSheetRow } from "@/lib/google-sheets/lead-row";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import type { QuoteRequestInput } from "@/lib/validations/quote-request";

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;

export type SheetSyncStatus = "success" | "skipped" | "failed";
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

async function insertLog(supabase: SupabaseAdminClient, values: { leadId: string; sheetName: string; status: "queued" | "skipped"; reason?: string; payload: Json }) {
  const { data, error } = await supabase
    .from("sheet_sync_logs")
    .insert({
      lead_id: values.leadId,
      direction: "push",
      sheet_name: values.sheetName,
      row_id: null,
      status: values.status,
      error_message: values.reason ?? null,
      payload: values.payload,
    })
    .select("id")
    .single();
  if (error || !data?.id) throw new Error(error?.message ?? "Unable to create Google Sheets sync log");
  return data.id as string;
}

async function updateLog(supabase: SupabaseAdminClient, id: string, values: { status: SheetSyncStatus; error?: string | null; rowId?: string | null; payload: Json }) {
  const { error } = await supabase
    .from("sheet_sync_logs")
    .update({ status: values.status, error_message: values.error ?? null, row_id: values.rowId ?? null, payload: values.payload })
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
      await insertLog(values.supabase, { leadId: values.leadId, sheetName, status: "skipped", reason, payload: basePayload(values, { missing }) });
      return { kind: "quote_request_sheet_sync", status: "skipped", reason };
    }

    logId = await insertLog(values.supabase, { leadId: values.leadId, sheetName, status: "queued", payload: basePayload(values) });
    const row = buildLeadSheetRow({ leadId: values.leadId, input: values.input, normalizedEmail: values.normalizedEmail, normalizedWhatsapp: values.normalizedWhatsapp });
    const result = await appendValues({ config, row });
    try {
      await updateLog(values.supabase, logId, { status: "success", rowId: result.rowId, payload: basePayload(values, { rowId: result.rowId, provider: result.raw ?? null }) });
    } catch (error) {
      return { kind: "quote_request_sheet_sync", status: "success", rowId: result.rowId, reason: `Log update failed after append: ${sanitizeError(error)}` };
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
