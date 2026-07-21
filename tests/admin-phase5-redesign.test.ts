import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { dataQualityInternals } from "@/lib/admin/data-quality";
import { adminLogsInternals } from "@/lib/admin/logs";
import { staffRoleLabel } from "@/lib/admin/staff-view";

test("phase 5 account and staff pages use redesigned Spanish admin primitives", () => {
  const staffPage = readFileSync("app/admin/(protected)/staff/page.tsx", "utf8");
  const staffList = readFileSync("components/admin/staff/staff-list.tsx", "utf8");
  const staffCreateForm = readFileSync("components/admin/staff/staff-create-form.tsx", "utf8");
  const accountPage = readFileSync("app/admin/(protected)/account/page.tsx", "utf8");
  const emailForm = readFileSync("components/admin/account/email-change-form.tsx", "utf8");
  const passwordForm = readFileSync("components/admin/account/password-change-form.tsx", "utf8");

  assert.match(staffPage, /PageHeader/);
  assert.match(staffPage, /Usuarios y staff/);
  assert.match(staffPage, /OperationDialog/);
  assert.match(staffList, /StaffEditForm/);
  assert.match(staffList, /StaffDeleteForm/);
  assert.match(staffCreateForm, /Pendiente|Creando…|Crear usuario/);
  assert.match(accountPage, /Mi cuenta/);
  assert.match(accountPage, /Correo y seguridad/);
  assert.match(accountPage, /Contraseña y sesión/);
  assert.match(emailForm, /Solicitar cambio de correo/);
  assert.match(passwordForm, /Actualizar contraseña/);
});

test("phase 5 data quality helpers expose safe issue summaries without raw ids", () => {
  const issues = dataQualityInternals.buildDataQualityIssues({
    generatedAt: "2026-07-21T10:00:00.000Z",
    totalContacts: 3,
    duplicateEmailGroups: [{
      kind: "email",
      normalizedValue: "ada@example.com",
      canonicalContactId: "contact-1",
      contacts: [{
        id: "contact-1",
        displayName: "Ada",
        email: "ada@example.com",
        phone: null,
        normalizedEmail: "ada@example.com",
        normalizedPhone: null,
        createdAt: "2026-07-01T10:00:00.000Z",
        updatedAt: "2026-07-20T10:00:00.000Z",
        totalDependencies: 6,
        dependencyCounts: { leads: 2, quote_requests: 1, bookings: 1, payments: 1, documents: 0, notifications: 1, whatsapp_clicks: 0 },
      }],
      impactSummary: { leads: 2, quote_requests: 1, bookings: 1, payments: 1, documents: 0, notifications: 1, whatsapp_clicks: 0, total: 6 },
      manualMergeGuidance: ["Revisar"],
    }],
    duplicatePhoneGroups: [],
    ambiguousIdentityEvents: 1,
    ambiguousIdentityCases: [{ id: "evt-1", leadId: "lead-1", createdAt: "2026-07-21T09:00:00.000Z", reason: "duplicate_phone", matchedContactIds: ["contact-1", "contact-2"] }],
    strategy: { deferredReason: "pendiente", readinessChecklist: [] },
  });

  const duplicateIssue = issues.find((issue) => issue.type === "duplicate_email");
  const ambiguousIssue = issues.find((issue) => issue.type === "ambiguous_identity");
  assert.equal(issues.length, 2);
  assert.match(duplicateIssue?.summary ?? "", /referencia\(s\)/i);
  assert.doesNotMatch(duplicateIssue?.title ?? "", /contact-1|lead-1/);
  assert.equal(ambiguousIssue?.title, "Coincidencia ambigua: Múltiples contactos con el mismo teléfono");
  assert.doesNotMatch(ambiguousIssue?.title ?? "", /duplicate_phone|contact-1|lead-1/);
  assert.equal(duplicateIssue?.href, "/admin/leads");
});

test("phase 5 log helpers keep safe Spanish severity and channel labels", () => {
  assert.equal(adminLogsInternals.channelLabel("email"), "Correo");
  assert.equal(adminLogsInternals.channelLabel("whatsapp"), "WhatsApp");
  assert.equal(adminLogsInternals.incidentSeverity("failed", "open"), "high");
  assert.equal(adminLogsInternals.incidentSeverity("queued", "open"), "high");
  assert.equal(adminLogsInternals.incidentSeverity("processing", "resolved"), "medium");
});

test("phase 5 role labels keep safe Spanish fallbacks", () => {
  assert.equal(staffRoleLabel("admin"), "Administración");
  assert.equal(staffRoleLabel("marketing"), "Marketing");
  assert.equal(staffRoleLabel("unknown-role"), "No identificado");
});
