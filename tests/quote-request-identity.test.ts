import assert from "node:assert/strict";
import test from "node:test";

import { buildPhoneIdentityVariants, buildSafeContactUpdate, resolveContactIdentity } from "@/lib/leads/quote-request-service";
import { resolveOrCreateContact } from "@/lib/leads/lead-intake-core";
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
};

function contact(overrides: Partial<ContactRow>): ContactRow {
  return {
    id: overrides.id ?? "contact-1",
    first_name: overrides.first_name ?? "Ada",
    last_name: overrides.last_name ?? "Lovelace",
    email: overrides.email ?? "adatest@gmail.com",
    phone: overrides.phone ?? "529988453455",
    preferred_locale: overrides.preferred_locale ?? "es",
    source: overrides.source ?? "website_quote",
    consent_marketing: overrides.consent_marketing ?? true,
    notes: overrides.notes ?? null,
    created_at: overrides.created_at ?? "2026-01-01T00:00:00.000Z",
    updated_at: overrides.updated_at ?? "2026-01-01T00:00:00.000Z",
  };
}

test("quote identity normalizes gmail aliases and defensive WhatsApp formats", () => {
  assert.equal(normalizeEmail(input.email), "adatest@gmail.com");
  assert.equal(normalizeWhatsApp(input.whatsapp), "529988453455");
  assert.deepEqual(buildPhoneIdentityVariants(input.whatsapp), ["529988453455", "5219988453455", "9988453455"]);
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
          assert.equal(selectClause, "id, first_name, last_name, email, phone, preferred_locale, source, consent_marketing, notes, created_at, updated_at");
          return {
            in(column: string, values: string[]) {
              assert.equal(column, "phone");
              assert.deepEqual(values, ["529988453455", "5219988453455", "9988453455"]);
              return Promise.resolve({
                data: [contact({ id: "contact-repeat", email: "adatest@gmail.com", phone: "5219988453455", notes: "Quote request notes: Cliente repetido" })],
                error: null,
              });
            },
            ilike(column: string, value: string) {
              assert.equal(column, "email");
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
