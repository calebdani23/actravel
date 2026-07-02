import assert from "node:assert/strict";
import test from "node:test";

import { processWhatsAppWebhookPayload, setWhatsappInboundDependenciesForTests } from "@/lib/leads/whatsapp-inbound-service";

function createSupabaseStub(options?: { duplicate?: boolean; failLead?: boolean }) {
  const rows: Array<{ table: string; values: unknown }> = [];
  return {
    rows,
    client: {
      from(table: string) {
        return {
          insert(values: unknown) {
            rows.push({ table, values });
            if (table === "whatsapp_inbound_messages" && options?.duplicate) return { select: () => ({ single: async () => ({ data: null, error: { code: "23505", message: "duplicate" } }) }) };
            if (table === "contacts") return { select: () => ({ single: async () => ({ data: { id: "contact-1" }, error: null }) }) };
            if (table === "leads") {
              if (options?.failLead) return { select: () => ({ single: async () => ({ data: null, error: new Error("lead failed") }) }) };
              return { select: () => ({ single: async () => ({ data: { id: "lead-1" }, error: null }) }) };
            }
            return { select: () => ({ single: async () => ({ data: { id: `${table}-1` }, error: null }) }) };
          },
          update(values: unknown) {
            rows.push({ table: `${table}:update`, values });
            return { eq: async () => ({ error: null }) };
          },
          select() {
            return {
              eq() { return { maybeSingle: async () => ({ data: { id: "status-1" }, error: null }) }; },
              order() { return { limit: () => ({ maybeSingle: async () => ({ data: { id: "status-1" }, error: null }) }) }; },
              in: async () => ({ data: [], error: null }),
              ilike: async () => ({ data: [], error: null }),
            };
          },
        };
      },
    },
  };
}

const validPayload = {
  object: "whatsapp_business_account",
  entry: [{ changes: [{ field: "messages", value: { metadata: { phone_number_id: "phone-123" }, contacts: [{ wa_id: "5219988453455", profile: { name: "Ada" } }], messages: [{ id: "wamid-1", from: "5219988453455", type: "text", text: { body: "!Hola! Quiero mas informacion." }, referral: { source_type: "facebook", ctwa_clid: "clid-1" } }] } }] }],
};

test("processWhatsAppWebhookPayload creates exactly one lead for a valid inbound trigger", async () => {
  const stub = createSupabaseStub();
  setWhatsappInboundDependenciesForTests({ createSupabaseClient: () => stub.client as never, now: () => "2026-07-02T00:00:00.000Z" });
  const result = await processWhatsAppWebhookPayload(validPayload, { phoneNumberId: "phone-123" });
  assert.equal(result.results[0]?.status, "lead_created");
  assert.equal(stub.rows.filter((row) => row.table === "leads").length, 1);
});

test("processWhatsAppWebhookPayload treats duplicate Meta message ids as idempotent", async () => {
  const stub = createSupabaseStub({ duplicate: true });
  setWhatsappInboundDependenciesForTests({ createSupabaseClient: () => stub.client as never, now: () => "2026-07-02T00:00:00.000Z" });
  const result = await processWhatsAppWebhookPayload(validPayload, { phoneNumberId: "phone-123" });
  assert.equal(result.results[0]?.status, "duplicate");
  assert.equal(stub.rows.filter((row) => row.table === "leads").length, 0);
});

test.after(() => setWhatsappInboundDependenciesForTests(null));
