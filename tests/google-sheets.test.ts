import assert from "node:assert/strict";
import test from "node:test";

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
      };
    },
  };
  return { supabase: supabase as never, inserted, updated };
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
  const summary = await deliverQuoteSheetSync({ ...context, supabase }, async () => {
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
  const summary = await deliverQuoteSheetSync({ ...context, supabase }, async ({ row }) => {
    assert.equal(row[18], "lead-123");
    return { rowId: "Leads!A2:S2", raw: { updatedRange: "Leads!A2:S2" } as Json };
  });

  assert.equal(summary.status, "success");
  assert.equal(summary.rowId, "Leads!A2:S2");
  assert.equal(inserted[0].status, "queued");
  assert.equal(updated[0].status, "success");
  assert.equal(updated[0].row_id, "Leads!A2:S2");
});

test("sheet sync turns provider errors into failed log updates", async () => {
  setSheetsEnv();
  const { supabase, inserted, updated } = createSupabaseMock();
  const summary = await deliverQuoteSheetSync({ ...context, supabase }, async () => {
    throw new Error("provider token=secret failed");
  });

  assert.equal(summary.status, "failed");
  assert.equal(inserted[0].status, "queued");
  assert.equal(updated[0].status, "failed");
  assert.match(updated[0].error_message as string, /token=\[redacted\]/);
});
