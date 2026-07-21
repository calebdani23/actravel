import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { adminLogsInternals } from "@/lib/admin/logs";
import { dashboardInternals } from "@/lib/admin/dashboard";

test("dashboard alerts escalate ambiguous incidents and otherwise report healthy state", () => {
  const critical = dashboardInternals.buildDashboardAlerts({
    counts: { leadsToday: 5, failedEmails: 1, openAmbiguousIncidents: 2, whatsappClicks: 9, overdueFollowUps: 0, pendingPayments: 0, upcomingBookings: 0 },
  });

  assert.equal(critical[0].level, "critical");
  assert.match(critical[0].detail, /2 registro\(s\)/);

  const healthy = dashboardInternals.buildDashboardAlerts({
    counts: { leadsToday: 2, failedEmails: 0, openAmbiguousIncidents: 0, whatsappClicks: 4, overdueFollowUps: 0, pendingPayments: 0, upcomingBookings: 0 },
  });

  assert.equal(healthy[0].level, "healthy");
});

test("dashboard alerts do not depend on recent incident samples for ambiguous backlog", () => {
  const alerts = dashboardInternals.buildDashboardAlerts({
    counts: { leadsToday: 1, failedEmails: 0, openAmbiguousIncidents: 1, whatsappClicks: 3, overdueFollowUps: 0, pendingPayments: 0, upcomingBookings: 0 },
  });

  assert.equal(alerts[0].level, "critical");
  assert.equal(alerts[0].title, "Hay incidentes ambiguos abiertos");
});

test("dashboard channel aggregation stays exact across large result sets", () => {
  const rows = Array.from({ length: 501 }, (_, index) => ({ source: index < 300 ? "website_quote" : index < 500 ? "whatsapp" : null }));

  const counts = dashboardInternals.countLeadSources(rows);
  const sorted = dashboardInternals.sortLeadChannelCounts(counts);

  assert.deepEqual(sorted, [
    { source: "website_quote", label: "Cotización web", count: 300 },
    { source: "whatsapp", label: "WhatsApp", count: 200 },
    { source: "sin_canal", label: "Canal no identificado", count: 1 },
  ]);
});

test("dashboard aggregations keep full lead and advisor counts beyond prior sample sizes", () => {
  const leads = Array.from({ length: 250 }, (_, index) => ({
    id: `lead-${index}`,
    source: index < 200 ? "website_quote" : "whatsapp",
    created_at: "2026-07-01T10:00:00.000Z",
    updated_at: `2026-07-${String((index % 9) + 1).padStart(2, "0")}T10:00:00.000Z`,
    status_id: `status-${index < 210 ? "new" : "won"}`,
    assigned_to: index < 205 ? "advisor-1" : null,
    contact_id: `contact-${index}`,
    summary: null,
    lead_statuses: index < 210 ? { name: "new", label_es: "Nuevo" } : { name: "won", label_es: "Ganado" },
    profiles: index < 205 ? { full_name: "Ada" } : null,
    contacts: { first_name: "Contacto", last_name: `${index}` },
  }));

  assert.deepEqual(dashboardInternals.buildStatusBreakdown(leads), [
    { status: "new", label: "Nuevo", count: 210 },
    { status: "won", label: "Ganado", count: 40 },
  ]);

  assert.deepEqual(dashboardInternals.buildAdvisorPerformance(leads), [
    { advisorId: "advisor-1", advisorName: "Ada", count: 205 },
    { advisorId: null, advisorName: "Sin asignar", count: 45 },
  ]);
});

test("lead detail actions revalidate dashboard only after successful lead mutations", () => {
  const source = readFileSync("app/admin/(protected)/leads/[id]/actions.ts", "utf8");

  for (const actionName of ["updateLeadStatusAction", "assignLeadAction", "addLeadNoteAction", "registerFollowUpAction"]) {
    const actionStart = source.indexOf(`export async function ${actionName}`);
    const actionEnd = source.indexOf("export async function", actionStart + 1);
    const actionSource = source.slice(actionStart, actionEnd === -1 ? undefined : actionEnd);
    const guardIndex = actionSource.indexOf("if (error)");
    const noteGuardIndex = actionSource.indexOf("if (noteError)");
    const failureIndex = Math.max(guardIndex, noteGuardIndex);
    const dashboardIndex = actionSource.indexOf('revalidatePath("/admin/dashboard")');

    assert.notEqual(actionStart, -1);
    assert.notEqual(dashboardIndex, -1);
    assert.ok(failureIndex < dashboardIndex, `${actionName} should revalidate dashboard only after success guards`);
  }
});

test("admin log incident helpers normalize recent notification rows", () => {
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

  assert.equal(notificationIncident.source, "email");
  assert.equal(notificationIncident.retryEligible, true);
  assert.equal(adminLogsInternals.shouldShowIncident(notificationIncident), true);
  assert.equal(notificationIncident.title, "Confirmación de solicitud de cotización");
});

test("admin log display helpers sanitize template identifiers and backend error text", () => {
  const rawTemplate = "internal/provider_template.v2";
  const rawError = "Function send_notification failed: relation notification_logs does not exist";

  assert.equal(adminLogsInternals.notificationTemplateLabel(rawTemplate), "Plantilla operativa");
  assert.equal(adminLogsInternals.notificationOperatorSummary({
    status: "failed",
    incidentStatus: "open",
    errorMessage: rawError,
  }), "La incidencia requiere revisión.");
  assert.equal(adminLogsInternals.notificationOperatorSummary({
    status: "failed",
    incidentStatus: "resolved",
    errorMessage: rawError,
  }), "No se pudo completar el envío.");
  assert.equal(adminLogsInternals.partialLoadMessage([rawError]), "Parte del historial no pudo cargarse por completo. Intenta actualizar la vista.");

  assert.doesNotMatch(adminLogsInternals.notificationTemplateLabel(rawTemplate), /internal\/provider_template\.v2/);
  assert.doesNotMatch(adminLogsInternals.notificationOperatorSummary({
    status: "failed",
    incidentStatus: "open",
    errorMessage: rawError,
  }) ?? "", /send_notification|notification_logs|relation/i);
  assert.doesNotMatch(adminLogsInternals.partialLoadMessage([rawError]) ?? "", /send_notification|notification_logs|relation/i);
});

test("admin log action helpers return safe validation and backend failure messages", () => {
  assert.throws(() => adminLogsInternals.requiredNotificationLogId(new FormData()), /registro válido/i);

  const invalidIncidentStatus = new FormData();
  invalidIncidentStatus.set("incidentStatus", "drop_table");
  assert.throws(() => adminLogsInternals.requiredIncidentStatus(invalidIncidentStatus), /estado de incidencia válido/i);

  const rawError = new Error("Function send_notification failed: relation notification_logs does not exist");
  assert.equal(adminLogsInternals.sanitizeLogActionError("retry", rawError), "No se pudo solicitar el reintento del envío. Intenta nuevamente.");
  assert.equal(adminLogsInternals.sanitizeLogActionError("incident-status", rawError), "No se pudo actualizar la incidencia. Intenta nuevamente.");
  assert.doesNotMatch(adminLogsInternals.sanitizeLogActionError("retry", rawError), /function|notification_logs|relation/i);
});

test("admin log incident presentation stays Spanish-safe for unknown templates and provider failures", () => {
  const incident = adminLogsInternals.buildNotificationIncident({
    id: "notif-2",
    attempt_count: 1,
    channel: "email",
    contact_id: null,
    created_at: "2026-06-09T10:00:00.000Z",
    error_message: "ResendError: 550 provider timeout on table internal_logs",
    incident_status: "open",
    incident_updated_at: "2026-06-09T11:00:00.000Z",
    incident_updated_by: null,
    last_attempt_at: null,
    last_retried_by: null,
    lead_id: null,
    locked_at: null,
    payload: {},
    provider: "resend",
    provider_message_id: "msg_123",
    recipient: "ada@example.com",
    sent_at: null,
    status: "ambiguous",
    template_name: "internal/provider_template.v2",
    updated_at: "2026-06-09T11:00:00.000Z",
    contacts: null,
  });

  assert.equal(incident.title, "Plantilla operativa");
  assert.equal(incident.errorMessage, "La incidencia requiere revisión.");
  assert.doesNotMatch(incident.title, /internal\/provider_template\.v2/);
  assert.doesNotMatch(incident.errorMessage ?? "", /ResendError|internal_logs|msg_123/i);
});

test("phase 2 admin surfaces route visible admin dates and traveler counts through shared helpers", () => {
  const logsPageSource = readFileSync("app/admin/(protected)/logs/page.tsx", "utf8");
  const primitivesSource = readFileSync("components/admin/admin-primitives.tsx", "utf8");
  const leadsPageSource = readFileSync("app/admin/(protected)/leads/page.tsx", "utf8");
  const leadDetailSource = readFileSync("app/admin/(protected)/leads/[id]/page.tsx", "utf8");
  const dashboardPageSource = readFileSync("app/admin/(protected)/dashboard/page.tsx", "utf8");
  const dashboardSource = readFileSync("lib/admin/dashboard.ts", "utf8");
  const leadsSource = readFileSync("lib/admin/leads.ts", "utf8");

  assert.match(logsPageSource, /Intentos:\s*\{formatAdminInteger\(row\.attempt_count \?\? 0\)\}/);
  assert.match(logsPageSource, /notificationStatusLabel\(row\.status\)/);
  assert.match(logsPageSource, /whatsappModuleLabel\(row\.page_path\)/);
  assert.match(logsPageSource, /formatAdminDateTime\(row\.created_at\)/);
  assert.match(logsPageSource, /formatAdminDateTime\(row\.last_attempt_at\)/);
  assert.match(logsPageSource, /formatAdminDateTime\(row\.incident_updated_at\)/);
  assert.match(logsPageSource, /formatAdminDateTime\(row\.createdAt\)/);
  assert.match(logsPageSource, /formatAdminDateTime\(row\.created_at\)/);
  assert.match(primitivesSource, /formatAdminDateTime\(item\.at\)/);
  assert.match(dashboardPageSource, /formatAdminDateWindowLabel\(today, "próximos 7 días"\)/);
  assert.match(dashboardSource, /formatAdminUtcWindowStartLabel\(utcDayStart\)/);
  assert.match(leadsSource, /formatAdminFollowUpLabel\(payloadString\(payload, "followUpAt"\)\)/);
  assert.match(leadsPageSource, /appendAdminSearchParams\(`\/admin\/leads\/\$\{lead\.id\}`, params\)/);
  assert.match(leadsPageSource, /const crmBaseHref = `\/admin\/leads\$\{currentQuery\}`/);
  assert.match(leadDetailSource, /const crmBaseHref = `\/admin\/leads\$\{buildAdminSearchQueryString\(currentSearchParams\)\}`/);
  assert.match(leadDetailSource, /<Link href=\{crmBaseHref\}>Volver al CRM<\/Link>/);
  assert.match(leadsSource, /formatAdminModuleLabelFromPath\(click\.page_path\)/);

  assert.match(leadsPageSource, /return `\$\{range\} · \$\{formatAdminTravelerCount\(travelersCount\)\}`/);
  assert.match(leadsPageSource, /filters\.from \? `Desde: \$\{formatAdminDate\(filters\.from\)\}` : null/);
  assert.match(leadsPageSource, /filters\.to \? `Hasta: \$\{formatAdminDate\(filters\.to\)\}` : null/);
  assert.match(leadDetailSource, /\{ label: "Viajeros", value: formatAdminTravelerCount\(lead\.travelers_count\) \}/);

  assert.doesNotMatch(dashboardSource, /lead\(s\)/i);
  assert.match(dashboardSource, /requieren contacto comercial o reprogramación\./);
});
