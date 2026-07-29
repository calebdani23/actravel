import assert from "node:assert/strict";
import test from "node:test";

import { CONTACT_NORMALIZATION_PARITY_CASES } from "@/lib/leads/contact-normalization";
import { buildOpportunityPurposeSignature, pickReusableOpportunity } from "@/lib/leads/opportunity-resolver";
import { buildPhoneIdentityVariants, buildSafeContactUpdate, resolveContactIdentity } from "@/lib/leads/quote-request-service";
import { resolveOrCreateContact, resolveOrCreateOpportunityLead } from "@/lib/leads/lead-intake-core";
import type { Database } from "@/lib/supabase/database.types";
import { normalizeEmail, normalizeWhatsApp, type QuoteRequestInput } from "@/lib/validations/quote-request";

type ContactRow = Database["public"]["Tables"]["contacts"]["Row"];

const input: QuoteRequestInput = {
  locale: "es",
  preferredCurrency: "MXN",
  holderName: "Ada Lovelace",
  email: "  Ada.Test+vip@GoogleMail.com ",
  whatsapp: "+52 1 998 845 3455 ext 22",
  origin: "Cancún",
  mainDestination: "Riviera Maya",
  departureDate: "2026-07-01",
  returnDate: "2026-07-07",
  adults: 2,
  children: 0,
  serviceInterest: "Paquete familiar",
  approximateBudget: 50000,
  sourceChannel: "website_quote",
  contactConsent: true,
  notes: "Cliente repetido",
  metaLeadEventId: undefined,
};

function contact(overrides: Partial<ContactRow>): ContactRow {
  return {
    id: overrides.id ?? "contact-1",
    is_test_data: overrides.is_test_data ?? false,
    blocked_at: overrides.blocked_at ?? null,
    blocked_by: overrides.blocked_by ?? null,
    blocked_reason: overrides.blocked_reason ?? null,
    first_name: overrides.first_name ?? "Ada",
    last_name: overrides.last_name ?? "Lovelace",
    email: overrides.email ?? "adatest@gmail.com",
    phone: overrides.phone ?? "529988453455",
    normalized_email: overrides.normalized_email ?? normalizeEmail(overrides.email ?? "adatest@gmail.com"),
    normalized_phone: overrides.normalized_phone ?? normalizeWhatsApp(overrides.phone ?? "529988453455"),
    preferred_locale: overrides.preferred_locale ?? "es",
    source: overrides.source ?? "website_quote",
    consent_marketing: overrides.consent_marketing ?? true,
    notes: overrides.notes ?? null,
    created_at: overrides.created_at ?? "2026-01-01T00:00:00.000Z",
    deleted_at: overrides.deleted_at ?? null,
    deleted_by: overrides.deleted_by ?? null,
    deleted_reason: overrides.deleted_reason ?? null,
    lifecycle_status: overrides.lifecycle_status ?? "active",
    updated_at: overrides.updated_at ?? "2026-01-01T00:00:00.000Z",
  };
}

test("quote identity normalizes gmail aliases and defensive WhatsApp formats", () => {
  assert.equal(normalizeEmail(input.email), "adatest@gmail.com");
  assert.equal(normalizeWhatsApp(input.whatsapp), "529988453455");
  assert.equal(normalizeEmail(" Ａｄａ．Ｔｅｓｔ＋vip＠ＧｏｏｇｌｅＭａｉｌ．ｃｏｍ "), "adatest@gmail.com");
  assert.equal(normalizeWhatsApp("＋５２ １ ９９８ ８４５ ３４５５ ext 22"), "529988453455");
  assert.deepEqual(buildPhoneIdentityVariants(input.whatsapp), ["529988453455", "5219988453455", "9988453455"]);
});

test("quote identity follows the documented contact-normalization parity contract", () => {
  for (const sample of CONTACT_NORMALIZATION_PARITY_CASES.emails) {
    assert.equal(normalizeEmail(sample.input), sample.expected);
  }
  for (const sample of CONTACT_NORMALIZATION_PARITY_CASES.phones) {
    assert.equal(normalizeWhatsApp(sample.input), sample.expected);
  }
});

test("repeat intake resolves to the same existing contact", () => {
  const resolution = resolveContactIdentity({
    candidates: [contact({ id: "contact-repeat", email: "adatest@gmail.com", phone: "5219988453455" })],
    normalizedEmail: normalizeEmail(input.email),
    normalizedWhatsapp: normalizeWhatsApp(input.whatsapp),
  });

  assert.equal(resolution.existingContactId, "contact-repeat");
  assert.equal(resolution.shouldCreateNewContact, false);
  assert.equal(resolution.reason, "phone_and_email");
  assert.equal(resolution.ambiguous, false);
});

test("duplicate phone matches are treated as ambiguous", () => {
  const resolution = resolveContactIdentity({
    candidates: [contact({ id: "contact-a", phone: "529988453455", email: "a@example.com" }), contact({ id: "contact-b", phone: "9988453455", email: "b@example.com" })],
    normalizedEmail: null,
    normalizedWhatsapp: "529988453455",
  });

  assert.equal(resolution.existingContactId, null);
  assert.equal(resolution.shouldCreateNewContact, true);
  assert.equal(resolution.reason, "duplicate_phone");
  assert.equal(resolution.ambiguous, true);
});

test("duplicate email matches are treated as ambiguous", () => {
  const resolution = resolveContactIdentity({
    candidates: [contact({ id: "contact-a", email: "adatest@gmail.com", phone: "529988453455" }), contact({ id: "contact-b", email: "AdaTest@Gmail.com", phone: "5211111111111" })],
    normalizedEmail: "adatest@gmail.com",
    normalizedWhatsapp: "000",
  });

  assert.equal(resolution.existingContactId, null);
  assert.equal(resolution.shouldCreateNewContact, true);
  assert.equal(resolution.reason, "duplicate_email");
  assert.equal(resolution.ambiguous, true);
});

test("split phone and email matches do not blindly attach to either contact", () => {
  const resolution = resolveContactIdentity({
    candidates: [contact({ id: "contact-phone", phone: "529988453455", email: "phone@example.com" }), contact({ id: "contact-email", phone: "529999999999", email: "adatest@gmail.com" })],
    normalizedEmail: "adatest@gmail.com",
    normalizedWhatsapp: "529988453455",
  });

  assert.equal(resolution.existingContactId, null);
  assert.equal(resolution.shouldCreateNewContact, true);
  assert.equal(resolution.reason, "split_phone_email");
  assert.equal(resolution.ambiguous, true);
});

test("matched contacts only fill missing identity fields instead of overwriting", () => {
  const update = buildSafeContactUpdate(contact({ email: "existing@example.com", phone: "529988453455", notes: "Known customer", source: "manual_import" }), input, "adatest@gmail.com", "529988453455");

  assert.deepEqual(update, {});
});

test("matched contacts still backfill blank safe contact fields", () => {
  const update = buildSafeContactUpdate(
    { ...contact({ preferred_locale: "", email: "", phone: "", notes: null }), source: null },
    input,
    "adatest@gmail.com",
    "529988453455",
  );

  assert.deepEqual(update, {
    preferred_locale: "es",
    source: "website_quote",
    email: "adatest@gmail.com",
    phone: "529988453455",
    normalized_email: "adatest@gmail.com",
    normalized_phone: "529988453455",
    notes: "Quote request notes: Cliente repetido",
  });
});

test("resolveOrCreateContact skips empty matched-contact updates and returns the existing contact", async () => {
  let updateCalled = false;

  const supabase = {
    from(table: string) {
      assert.equal(table, "contacts");
      return {
        select(selectClause: string) {
          assert.match(selectClause, /lifecycle_status/);
          assert.match(selectClause, /deleted_at/);
          return {
            in(column: string, values: string[]) {
              assert.equal(column, "normalized_phone");
              assert.deepEqual(values, ["529988453455", "5219988453455", "9988453455"]);
              return Promise.resolve({
                data: [contact({ id: "contact-repeat", email: "adatest@gmail.com", phone: "5219988453455", notes: "Quote request notes: Cliente repetido" })],
                error: null,
              });
            },
            eq(column: string, value: string) {
              assert.equal(column, "normalized_email");
              assert.equal(value, "adatest@gmail.com");
              return Promise.resolve({
                data: [contact({ id: "contact-repeat", email: "adatest@gmail.com", phone: "5219988453455", notes: "Quote request notes: Cliente repetido" })],
                error: null,
              });
            },
          };
        },
        update() {
          updateCalled = true;
          throw new Error("update should be skipped when safe contact update is empty");
        },
      };
    },
  };

  const resolution = await resolveOrCreateContact(supabase as never, {
    name: input.holderName,
    email: normalizeEmail(input.email),
    phone: normalizeWhatsApp(input.whatsapp),
    preferredLocale: input.locale,
    source: input.sourceChannel,
    notes: `Quote request notes: ${input.notes}`,
    consentMarketing: true,
  });

  assert.equal(updateCalled, false);
  assert.equal(resolution.contactId, "contact-repeat");
  assert.equal(resolution.status, "matched_existing");
  assert.equal(resolution.reason, "phone_and_email");
  assert.equal(resolution.ambiguous, false);
});

test("opportunity purpose signatures stay stable across date changes when destination and service match", () => {
  const july = buildOpportunityPurposeSignature({ destinationId: "dest-1", destinationName: "Riviera Maya", serviceId: "svc-1", serviceName: "Paquete familiar" });
  const august = buildOpportunityPurposeSignature({ destinationId: "dest-1", destinationName: "Riviera Maya", serviceId: "svc-1", serviceName: "Paquete familiar" });

  assert.equal(july.reliable, true);
  assert.equal(july.signature, august.signature);
  assert.match(july.signature ?? "", /^opp:v1\|dest:dest-1\|svc:svc-1$/);
});

test("weak opportunity purpose avoids automatic grouping when destination or service is too weak", () => {
  const weak = buildOpportunityPurposeSignature({ destinationName: "", serviceName: "Paquete" });

  assert.equal(weak.reliable, false);
  assert.equal(weak.signature, null);
});

test("reusable opportunity selection prefers non-terminal rows, then latest activity, then deterministic id order", () => {
  const selected = pickReusableOpportunity([
    { id: "lead-terminal", created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-07-05T00:00:00.000Z", lead_statuses: { is_terminal: true } },
    { id: "lead-b", created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-07-10T00:00:00.000Z", lead_statuses: { is_terminal: false } },
    { id: "lead-a", created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-07-10T00:00:00.000Z", lead_statuses: { is_terminal: false } },
  ]);

  assert.equal(selected?.id, "lead-a");
});

test("same contact and same reliable purpose reuses the existing opportunity without resetting workflow fields", async () => {
  let insertCalled = false;
  let rpcCalled = false;

  const supabase = {
    rpc(fn: string, args: Record<string, unknown>) {
      rpcCalled = true;
      assert.equal(fn, "crm_resolve_opportunity_lead");
      assert.equal(args.p_contact_id, "contact-1");
      assert.equal(args.p_source, "website_quote");
      return Promise.resolve({
        data: [{
          lead_id: "lead-open",
          resolution_status: "reused_existing",
          created_new: false,
          review_required: false,
          reliable_purpose: true,
          signature: "opp:v1|dest:dest-1|svc:svc-1",
          signature_version: 1,
          basis: { version: 1 },
        }],
        error: null,
      });
    },
    from(table: string) {
      assert.equal(table, "leads");
      return {
        select() { throw new Error("serialized RPC should bypass manual select path"); },
        update() { throw new Error("serialized RPC should bypass manual update path"); },
        insert() {
          insertCalled = true;
          throw new Error("insert should not run when an opportunity is reused");
        },
      };
    },
  };

  const resolution = await resolveOrCreateOpportunityLead(supabase as never, {
    contactId: "contact-1",
    statusId: "status-new",
    source: "website_quote",
    summary: "Ada · Riviera Maya · 2 viajeros",
    destinationId: "dest-1",
    destinationLabel: "Riviera Maya",
    serviceId: "svc-1",
    serviceLabel: "Paquete familiar",
    travelStartDate: "2026-07-01",
    travelEndDate: "2026-07-07",
    travelersCount: 2,
    budgetMxn: 50000,
  });

  assert.equal(resolution.status, "reused_existing");
  assert.equal(resolution.leadId, "lead-open");
  assert.equal(insertCalled, false);
  assert.equal(rpcCalled, true);
  assert.equal(resolution.serialized, true);
  assert.equal(resolution.reviewRequired, false);
});

test("different or weak purpose creates a new opportunity for the same contact", async () => {
  let insertedRow: Record<string, unknown> | null = null;

  const supabase = {
    rpc() {
      throw new Error("weak-purpose opportunities should not call the serialized RPC");
    },
    from(table: string) {
      assert.equal(table, "leads");
      return {
        select() {
          const builder = {
            eq() { return builder; },
            order() { return builder; },
            limit() { return Promise.resolve({ data: [], error: null }); },
          };
          return builder;
        },
        insert(row: Record<string, unknown>) {
          insertedRow = row;
          return { select() { return { single: async () => ({ data: { id: "lead-new" }, error: null }) }; } };
        },
      };
    },
  };

  const weakResolution = await resolveOrCreateOpportunityLead(supabase as never, {
    contactId: "contact-1",
    statusId: "status-new",
    source: "manual_admin",
    summary: "Manual lead",
    destinationLabel: "",
    serviceLabel: "Paquete",
  });

  assert.equal(weakResolution.status, "created_new");
  assert.equal(weakResolution.signature, null);
  assert.equal(insertedRow?.["opportunity_signature"], null);
  assert.equal(weakResolution.serialized, false);
});

test("advisor-hidden reusable opportunities create a review duplicate without exposing the canonical lead", async () => {
  let selectCalled = false;

  const supabase = {
    rpc(fn: string) {
      assert.equal(fn, "crm_resolve_opportunity_lead");
      return Promise.resolve({
        data: [{
          lead_id: "lead-review",
          resolution_status: "created_duplicate_review",
          created_new: true,
          review_required: true,
          reliable_purpose: true,
          signature: "opp:v1|dest:dest-1|svc:svc-1",
          signature_version: 1,
          basis: { version: 1, reliablePurpose: true },
        }],
        error: null,
      });
    },
    from() {
      selectCalled = true;
      throw new Error("advisor duplicate-review path should stay inside the serialized RPC");
    },
  };

  const resolution = await resolveOrCreateOpportunityLead(supabase as never, {
    contactId: "contact-1",
    statusId: "status-new",
    assignedTo: "advisor-1",
    source: "manual_asesor",
    summary: "Manual lead",
    destinationId: "dest-1",
    destinationLabel: "Riviera Maya",
    serviceId: "svc-1",
    serviceLabel: "Paquete familiar",
  });

  assert.equal(resolution.status, "created_duplicate_review");
  assert.equal(resolution.leadId, "lead-review");
  assert.equal(resolution.reviewRequired, true);
  assert.equal(resolution.serialized, true);
  assert.equal(selectCalled, false);
});

test("serialized RPC unavailability creates an explicit review duplicate instead of silent reuse", async () => {
  let insertRow: Record<string, unknown> | null = null;
  let selectCalled = false;
  let updateCalled = false;

  const supabase = {
    rpc() {
      return Promise.resolve({ error: { code: "PGRST202", message: "Could not find the function public.crm_resolve_opportunity_lead in the schema cache" }, data: null });
    },
    from(table: string) {
      assert.equal(table, "leads");
      return {
        select() {
          selectCalled = true;
          throw new Error("rpc-unavailable reliable-purpose flow must not probe RLS-scoped fallback reuse");
        },
        update() {
          updateCalled = true;
          throw new Error("rpc-unavailable reliable-purpose flow must not update an existing lead");
        },
        insert(row: Record<string, unknown>) {
          insertRow = row;
          return {
            select() {
              return {
                single: async () => ({ data: { id: "lead-review" }, error: null }),
              };
            },
          };
        },
      };
    },
  };

  const resolution = await resolveOrCreateOpportunityLead(supabase as never, {
    contactId: "contact-1",
    statusId: "status-new",
    source: "website_quote",
    summary: "Ada · Riviera Maya · 2 viajeros",
    destinationId: "dest-1",
    destinationLabel: "Riviera Maya",
    serviceId: "svc-1",
    serviceLabel: "Paquete familiar",
    travelStartDate: "2026-07-01",
    travelEndDate: "2026-07-07",
    travelersCount: 2,
    budgetMxn: 50000,
  });

  assert.equal(resolution.status, "resolution_unavailable");
  assert.equal(resolution.reviewRequired, true);
  assert.equal(resolution.reason, "serialized_resolution_unavailable");
  assert.equal(resolution.serialized, false);
  assert.equal(selectCalled, false);
  assert.equal(updateCalled, false);
  assert.equal(insertRow?.["source"], "website_quote");
  assert.equal(insertRow?.["opportunity_signature"], "opp:v1|dest:dest-1|svc:svc-1");
});

test("advisor reliable-purpose intake also uses the explicit resolution-unavailable review path when the RPC is missing", async () => {
  let selectCalled = false;

  const supabase = {
    rpc() {
      return Promise.resolve({ error: { code: "PGRST202", message: "Could not find the function public.crm_resolve_opportunity_lead in the schema cache" }, data: null });
    },
    from(table: string) {
      assert.equal(table, "leads");
      return {
        select() {
          selectCalled = true;
          throw new Error("advisor rpc-unavailable flow must not inspect hidden canonical opportunities through fallback queries");
        },
        update() {
          throw new Error("advisor rpc-unavailable flow must not mutate an existing hidden lead");
        },
        insert() {
          return {
            select() {
              return {
                single: async () => ({ data: { id: "lead-review" }, error: null }),
              };
            },
          };
        },
      };
    },
  };

  const resolution = await resolveOrCreateOpportunityLead(supabase as never, {
    contactId: "contact-1",
    statusId: "status-new",
    assignedTo: "advisor-1",
    source: "manual_asesor",
    summary: "Manual lead",
    destinationId: "dest-1",
    destinationLabel: "Riviera Maya",
    serviceId: "svc-1",
    serviceLabel: "Paquete familiar",
  });

  assert.equal(resolution.status, "resolution_unavailable");
  assert.equal(resolution.reviewRequired, true);
  assert.equal(resolution.reason, "serialized_resolution_unavailable");
  assert.equal(selectCalled, false);
});
