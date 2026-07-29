import assert from "node:assert/strict";
import test from "node:test";

import { dataQualityInternals } from "@/lib/admin/data-quality";
import type { Database } from "@/lib/supabase/database.types";
import { normalizeEmail, normalizeWhatsApp } from "@/lib/validations/quote-request";

type ContactRow = Database["public"]["Tables"]["contacts"]["Row"];

function contact(overrides: Partial<ContactRow>): ContactRow {
  return {
    id: overrides.id ?? "contact-1",
    is_test_data: overrides.is_test_data ?? false,
    blocked_at: overrides.blocked_at ?? null,
    blocked_by: overrides.blocked_by ?? null,
    blocked_reason: overrides.blocked_reason ?? null,
    first_name: overrides.first_name ?? "Ada",
    last_name: overrides.last_name ?? "Lovelace",
    email: overrides.email ?? null,
    phone: overrides.phone ?? null,
    normalized_email: overrides.normalized_email ?? normalizeEmail(overrides.email ?? null),
    normalized_phone: overrides.normalized_phone ?? (overrides.phone ? normalizeWhatsApp(overrides.phone) : null),
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

test("data quality groups normalized duplicates and recommends canonical by dependency weight", () => {
  const dependencyIndex = dataQualityInternals.buildDependencyIndex({
    leads: [{ id: "lead-1", contact_id: "contact-b" }, { id: "lead-2", contact_id: "contact-b" }],
    quoteRequests: [{ id: "quote-1", contact_id: "contact-b" }],
    bookings: [{ id: "booking-1", contact_id: "contact-a" }],
    payments: [{ id: "payment-1", contact_id: "contact-b" }],
    documents: [{ id: "document-1", contact_id: "contact-a" }],
    notifications: [{ id: "notification-1", contact_id: "contact-b" }, { id: "notification-2", contact_id: "contact-b" }],
    whatsappClicks: [{ id: "wa-1", contact_id: "contact-a" }],
  });

  const groups = dataQualityInternals.buildDuplicateGroupPlans(
    [
      contact({ id: "contact-a", email: " Ada.Test+vip@GoogleMail.com ", phone: "+52 998 845 3455", created_at: "2026-01-01T00:00:00.000Z" }),
      contact({ id: "contact-b", email: "adatest@gmail.com", phone: "529988453455", created_at: "2026-02-01T00:00:00.000Z" }),
      contact({ id: "contact-c", email: "unique@example.com", phone: "5219988453455", created_at: "2026-03-01T00:00:00.000Z" }),
    ],
    dependencyIndex,
  );

  const emailGroup = groups.find((group) => group.kind === "email");
  const phoneGroup = groups.find((group) => group.kind === "phone");

  assert.equal(emailGroup?.normalizedValue, "adatest@gmail.com");
  assert.equal(emailGroup?.canonicalContactId, "contact-b");
  assert.equal(emailGroup?.impactSummary.total, 9);
  assert.equal(emailGroup?.contacts[0]?.id, "contact-b");

  assert.equal(phoneGroup?.normalizedValue, "529988453455");
  assert.equal(phoneGroup?.canonicalContactId, "contact-b");
  assert.equal(phoneGroup?.impactSummary.leads, 2);
  assert.equal(phoneGroup?.contacts.length, 3);
});

test("data quality ambiguous identity cases expose recent reasons and matched contacts", () => {
  const cases = dataQualityInternals.buildAmbiguousIdentityCases([
    {
      id: "evt-1",
      lead_id: "lead-1",
      created_at: "2026-06-09T10:00:00.000Z",
      payload: {
        quoteRequestId: "quote-1",
        identityResolution: {
          reason: "duplicate_phone",
          matchedContactIds: ["contact-a", "contact-b"],
        },
      },
    },
  ]);

  assert.deepEqual(cases, [
    {
      id: "evt-1",
      leadId: "lead-1",
      createdAt: "2026-06-09T10:00:00.000Z",
      reason: "duplicate_phone",
      matchedContactIds: ["contact-a", "contact-b"],
    },
  ]);
});

test("data quality issue labels map ambiguous reasons to safe Spanish text with generic fallback", () => {
  assert.equal(dataQualityInternals.ambiguousIdentityReasonLabel("duplicate_phone"), "Múltiples contactos con el mismo teléfono");
  assert.equal(dataQualityInternals.ambiguousIdentityReasonLabel("split_phone_email"), "Teléfono y correo apuntan a contactos distintos");
  assert.equal(dataQualityInternals.ambiguousIdentityReasonLabel("raw_provider_timeout:msg_123"), "La causa exacta requiere revisión manual");
});
