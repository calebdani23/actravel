import assert from "node:assert/strict";
import test from "node:test";

import { adminLogsInternals } from "@/lib/admin/logs";
import { dashboardInternals } from "@/lib/admin/dashboard";

test("dashboard alerts escalate ambiguous incidents and otherwise report healthy state", () => {
  const critical = dashboardInternals.buildDashboardAlerts({
    counts: { leadsToday: 5, failedEmails: 1, failedSheetSyncs: 0, openAmbiguousIncidents: 2, whatsappClicks: 9 },
  });

  assert.equal(critical[0].level, "critical");
  assert.match(critical[0].detail, /2 registro\(s\)/);

  const healthy = dashboardInternals.buildDashboardAlerts({
    counts: { leadsToday: 2, failedEmails: 0, failedSheetSyncs: 0, openAmbiguousIncidents: 0, whatsappClicks: 4 },
  });

  assert.equal(healthy[0].level, "healthy");
});

test("dashboard alerts do not depend on recent incident samples for ambiguous backlog", () => {
  const alerts = dashboardInternals.buildDashboardAlerts({
    counts: { leadsToday: 1, failedEmails: 0, failedSheetSyncs: 0, openAmbiguousIncidents: 1, whatsappClicks: 3 },
  });

  assert.equal(alerts[0].level, "critical");
  assert.equal(alerts[0].title, "Hay incidentes ambiguos abiertos");
});

test("dashboard channel aggregation stays exact across large result sets", () => {
  const rows = Array.from({ length: 501 }, (_, index) => ({ source: index < 300 ? "website_quote" : index < 500 ? "whatsapp" : null }));

  const counts = dashboardInternals.countLeadSources(rows);
  const sorted = dashboardInternals.sortLeadChannelCounts(counts);

  assert.deepEqual(sorted, [
    { source: "website_quote", count: 300 },
    { source: "whatsapp", count: 200 },
    { source: "sin_canal", count: 1 },
  ]);
});

test("admin log incident helpers normalize recent notification and sheet rows", () => {
  const notificationIncident = adminLogsInternals.buildNotificationIncident({
    id: "notif-1",
    attempt_count: 1,
    channel: "email",
    contact_id: null,
    created_at: "2026-06-09T10:00:00.000Z",
    error_message: "Provider failed",
    incident_status: "open",
    incident_updated_at: "2026-06-09T11:00:00.000Z",
    incident_updated_by: null,
    last_attempt_at: null,
    last_retried_by: null,
    lead_id: null,
    locked_at: null,
    payload: {},
    provider: "resend",
    provider_message_id: null,
    recipient: "ada@example.com",
    sent_at: null,
    status: "failed",
    template_name: "client_quote_request_confirmation",
    updated_at: "2026-06-09T11:00:00.000Z",
    contacts: null,
  });

  const sheetIncident = adminLogsInternals.buildSheetIncident({
    id: "sheet-1",
    attempt_count: 2,
    created_at: "2026-06-09T09:00:00.000Z",
    direction: "push",
    error_message: "Sheets append failed",
    idempotency_key: "quote:1:sheet:Leads:push",
    incident_status: "resolved",
    incident_updated_at: "2026-06-09T10:00:00.000Z",
    incident_updated_by: null,
    last_attempt_at: null,
    last_retried_by: null,
    lead_id: null,
    locked_at: null,
    payload: {},
    quote_request_id: "quote-1",
    row_id: null,
    sheet_name: "Leads",
    status: "failed",
    updated_at: "2026-06-09T10:00:00.000Z",
  });

  assert.equal(notificationIncident.source, "email");
  assert.equal(notificationIncident.retryEligible, true);
  assert.equal(sheetIncident.source, "sheets");
  assert.equal(sheetIncident.incidentStatus, "resolved");
  assert.equal(adminLogsInternals.shouldShowIncident(sheetIncident), true);
});
