import assert from "node:assert/strict";
import test from "node:test";

import { retrySheetSyncLog } from "@/lib/google-sheets/quote-sheet-retry";
import { deliverQuoteSheetSync } from "@/lib/google-sheets/quote-sheet-sync";
import { buildLeadSheetRow, LEAD_SHEET_HEADERS } from "@/lib/google-sheets/lead-row";
import type { Json } from "@/lib/supabase/database.types";
import type { QuoteRequestInput } from "@/lib/validations/quote-request";

const input: QuoteRequestInput = {
  locale: "en",
  preferredCurrency: "USD",
  holderName: "Ada Lovelace",
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
  notes: "Need vegan options",
};

function clearSheetsEnv() {
  delete process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
  delete process.env.GOOGLE_SHEETS_PRIVATE_KEY;
  delete process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  delete process.env.GOOGLE_SHEETS_LEADS_TAB;
}

function setSheetsEnv() {
  process.env.GOOGLE_SHEETS_CLIENT_EMAIL = "service@example.iam.gserviceaccount.com";
  process.env.GOOGLE_SHEETS_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\\ntest\\n-----END PRIVATE KEY-----";
  process.env.GOOGLE_SHEETS_SPREADSHEET_ID = "spreadsheet-1";
  process.env.GOOGLE_SHEETS_LEADS_TAB = "Leads";
}

function createSupabaseMock() {
  const inserted: Array<Record<string, unknown>> = [];
  const updated: Array<Record<string, unknown>> = [];
  const existingByKey = new Map<string, Record<string, unknown>>();
  const supabase = {
    from(table: string) {
      assert.equal(table, "sheet_sync_logs");
      return {
        insert(row: Record<string, unknown>) {
          inserted.push(row);
          return { select: () => ({ single: async () => ({ data: { id: `log-${inserted.length}` }, error: null }) }) };
        },
        update(row: Record<string, unknown>) {
          updated.push(row);
          return { eq: async () => ({ error: null }) };
        },
        select() {
          return {
            eq(_column: string, value: string) {
              return { maybeSingle: async () => ({ data: existingByKey.get(value) ?? null, error: null }) };
            },
          };
        },
      };
    },
  };
  return { supabase, inserted, updated, existingByKey };
}

const context = { leadId: "lead-123", quoteRequestId: "quote-123", input, normalizedEmail: "ada@example.com", normalizedWhatsapp: "15551002000" };

test("lead row mapping preserves the documented column order", () => {
  const row = buildLeadSheetRow({ ...context, createdAt: "2026-05-27T00:00:00.000Z", promotion: null, advisor: null });
  assert.equal(LEAD_SHEET_HEADERS.length, 19);
  assert.deepEqual(row, [
    "2026-05-27T00:00:00.000Z",
    "Ada Lovelace",
    "15551002000",
    "ada@example.com",
    "en",
    "USD",
    "Cancun",
    "Riviera Maya",
    "2",
    "1",
    "2026-07-01 — 2026-07-07",
    "3500",
    "Family package",
    "website_quote",
    "",
    "new",
    "",
    "Need vegan options",
    "lead-123",
  ]);
});

test("sheet sync skips missing config without calling Google", async () => {
  clearSheetsEnv();
  const { supabase, inserted, updated } = createSupabaseMock();
  let appendCalled = false;
  const summary = await deliverQuoteSheetSync({ ...context, supabase: supabase as never }, async () => {
    appendCalled = true;
    return { rowId: null };
  });

  assert.equal(summary.status, "skipped");
  assert.equal(appendCalled, false);
  assert.equal(inserted[0].status, "skipped");
  assert.match(inserted[0].error_message as string, /GOOGLE_SHEETS_CLIENT_EMAIL/);
  assert.equal(updated.length, 0);
});

test("sheet sync records queued then success with row reference", async () => {
  setSheetsEnv();
  const { supabase, inserted, updated } = createSupabaseMock();
  const summary = await deliverQuoteSheetSync({ ...context, supabase: supabase as never }, async ({ row }) => {
    assert.equal(row[18], "lead-123");
    return { rowId: "Leads!A2:S2", raw: { updatedRange: "Leads!A2:S2" } as Json };
  });

  assert.equal(summary.status, "success");
  assert.equal(summary.rowId, "Leads!A2:S2");
  assert.equal(inserted[0].status, "queued");
  assert.equal(inserted[0].quote_request_id, "quote-123");
  assert.equal(inserted[0].idempotency_key, "quote:quote-123:sheet:Leads:push");
  assert.equal(updated[0].status, "success");
  assert.equal(updated[0].row_id, "Leads!A2:S2");
});

test("sheet sync turns provider errors into failed log updates", async () => {
  setSheetsEnv();
  const { supabase, inserted, updated } = createSupabaseMock();
  const summary = await deliverQuoteSheetSync({ ...context, supabase: supabase as never }, async () => {
    throw new Error("provider token=secret failed");
  });

  assert.equal(summary.status, "failed");
  assert.equal(inserted[0].status, "queued");
  assert.equal(updated[0].status, "failed");
  assert.match(updated[0].error_message as string, /token=\[redacted\]/);
});

test("sheet sync skips duplicate append when existing idempotency key already succeeded", async () => {
  setSheetsEnv();
  const { supabase, inserted, updated, existingByKey } = createSupabaseMock();
  const key = "quote:quote-123:sheet:Leads:push";
  existingByKey.set(key, { id: "log-existing", status: "success", row_id: "Leads!A2:S2" });
  const originalFrom = supabase.from;
  supabase.from = (table: string) => {
    const query = originalFrom(table);
    return {
      ...query,
      insert(row: Record<string, unknown>) {
        inserted.push(row);
        return { select: () => ({ single: async () => ({ data: null, error: new Error("duplicate key") }) }) };
      },
    };
  };
  let appendCalls = 0;

  const summary = await deliverQuoteSheetSync({ ...context, supabase: supabase as never }, async () => {
    appendCalls += 1;
    return { rowId: "Leads!A3:S3" };
  });

  assert.equal(summary.status, "success");
  assert.equal(summary.rowId, "Leads!A2:S2");
  assert.match(summary.reason ?? "", /already appended/i);
  assert.equal(appendCalls, 0);
  assert.equal(updated.length, 0);
});

test("sheet sync marks ambiguous when log update fails after append", async () => {
  setSheetsEnv();
  const { supabase, updated } = createSupabaseMock();
  let updateCalls = 0;
  const originalFrom = supabase.from;
  supabase.from = (table: string) => {
    const query = originalFrom(table);
    return {
      ...query,
      update(row: Record<string, unknown>) {
        updateCalls += 1;
        updated.push(row);
        return { eq: async () => ({ error: updateCalls === 1 ? new Error("database token=secret failed") : null }) };
      },
    };
  };

  const summary = await deliverQuoteSheetSync({ ...context, supabase: supabase as never }, async () => ({ rowId: "Leads!A2:S2" }));

  assert.equal(summary.status, "success");
  assert.match(summary.reason ?? "", /Log update failed after append/);
  assert.equal(updated[1].status, "ambiguous");
  assert.match(updated[1].error_message as string, /token=\[redacted\]/);
});

function createSheetRetryMock(status = "failed", rowId: string | null = null) {
  const quotePayload = { ...input, email: "ada@example.com", whatsapp: "15551002000" };
  const log = { id: "sheet-log", created_at: new Date().toISOString(), lead_id: "lead-123", direction: "push", sheet_name: "Leads", row_id: rowId, status, error_message: "failed", payload: { quoteRequestId: "quote-123" }, quote_request_id: "quote-123", idempotency_key: "quote:quote-123:sheet:Leads:push", attempt_count: 0, last_attempt_at: null, locked_at: null, last_retried_by: null, updated_at: new Date().toISOString() } as Record<string, unknown>;
  const updated: Array<Record<string, unknown>> = [];
  const supabase = {
    from(table: string) {
      return {
        select() {
          return { eq: (_column: string, value: string) => ({ maybeSingle: async () => (table === "quote_requests" ? { data: { id: value, payload: quotePayload }, error: null } : { data: log.id === value ? log : null, error: null }) }) };
        },
        update(row: Record<string, unknown>) {
          const builder = {
            eq: (_column: string, value: string) => {
              Object.assign(builder, { id: value });
              return builder;
            },
            in: (_column: string, allowed: string[]) => {
              Object.assign(builder, { allowed });
              return builder;
            },
            select: () => builder,
            maybeSingle: async () => {
              if ((builder as { id?: string }).id !== log.id || !((builder as { allowed?: string[] }).allowed ?? []).includes(log.status as string)) return { data: null, error: null };
              Object.assign(log, row);
              updated.push(row);
              return { data: log, error: null };
            },
            then: (resolve: (value: { error: Error | null }) => void) => {
              Object.assign(log, row);
              updated.push(row);
              resolve({ error: null });
            },
          };
          return builder;
        },
      };
    },
  };
  return { supabase, log, updated };
}

test("sheet retry claims failed log and appends exactly once", async () => {
  setSheetsEnv();
  const { supabase, updated } = createSheetRetryMock("failed");
  let appendCalls = 0;
  const result = await retrySheetSyncLog("sheet-log", "actor-1", { supabase: supabase as never, now: () => "2026-05-27T00:00:00.000Z", append: async ({ row }) => { appendCalls += 1; assert.equal(row[18], "lead-123"); return { rowId: "Leads!A2:S2" }; } });

  assert.equal(result.status, "success");
  assert.equal(result.rowId, "Leads!A2:S2");
  assert.equal(appendCalls, 1);
  assert.equal(updated[0].status, "processing");
  assert.equal(updated[1].status, "success");
  assert.equal(updated[0].last_retried_by, "actor-1");
});

test("sheet retry skips terminal success without duplicate append", async () => {
  setSheetsEnv();
  const { supabase, updated } = createSheetRetryMock("success", "Leads!A2:S2");
  let appendCalls = 0;
  const result = await retrySheetSyncLog("sheet-log", "actor-1", { supabase: supabase as never, append: async () => { appendCalls += 1; return { rowId: "Leads!A3:S3" }; } });

  assert.equal(result.status, "success");
  assert.equal(result.rowId, "Leads!A2:S2");
  assert.equal(appendCalls, 0);
  assert.equal(updated.length, 0);
});

test("sheet retry skips append when a concurrent retry already claimed the log", async () => {
  setSheetsEnv();
  const { supabase, log, updated } = createSheetRetryMock("failed");
  let appendCalls = 0;
  let firstSelect = true;
  const originalFrom = supabase.from;

  supabase.from = (table: string) => {
    const query = originalFrom(table);
    if (table !== "sheet_sync_logs") return query;
    return {
      ...query,
      select() {
        return {
          eq: (_column: string, value: string) => ({
            maybeSingle: async () => {
              if (value !== log.id) return { data: null, error: null };
              if (firstSelect) {
                firstSelect = false;
                queueMicrotask(() => { log.status = "processing"; });
                return { data: { ...log, status: "failed" }, error: null };
              }
              return { data: { status: log.status, row_id: log.row_id }, error: null };
            },
          }),
        };
      },
    };
  };

  const result = await retrySheetSyncLog("sheet-log", "actor-1", { supabase: supabase as never, append: async () => { appendCalls += 1; return { rowId: "Leads!A3:S3" }; } });

  assert.equal(result.status, "processing");
  assert.match(result.reason ?? "", /retry claim skipped/i);
  assert.equal(appendCalls, 0);
  assert.equal(updated.length, 0);
});
