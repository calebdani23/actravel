import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { leadSearchInternals } from "@/lib/admin/leads";
import { formatAdminDateTime } from "@/lib/admin/format";

test("lead search splits sanitized terms and keeps useful tokens", () => {
  assert.deepEqual(leadSearchInternals.splitSearchTerms("  Cancun, maria@example.com   "), ["Cancun", "maria@example.com"]);
  assert.deepEqual(leadSearchInternals.splitSearchTerms("a b 1234"), ["1234"]);
});

test("lead search clauses cover summary, source, ids, and related entities", () => {
  const search = leadSearchInternals.buildLeadSearchPlan("cancun lead-1234")!;
  const clauses = leadSearchInternals.buildLeadSearchClauses(search, {
    contactIds: ["contact-1"],
    destinationIds: ["dest-1"],
    leadIds: ["lead-1234"],
  });

  assert.match(clauses.join(","), /summary\.ilike\.%cancun%/i);
  assert.match(clauses.join(","), /source\.ilike\.%lead-1234%/i);
  assert.match(clauses.join(","), /contact_id\.in\.\(contact-1\)/);
  assert.match(clauses.join(","), /destination_id\.in\.\(dest-1\)/);
  assert.match(clauses.join(","), /id\.in\.\(lead-1234\)/);
});

test("lead search also inspects quote request campaign context payload", () => {
  const search = leadSearchInternals.buildLeadSearchPlan("summer sale")!;
  const clauses = leadSearchInternals.buildQuoteRequestSearchClauses(search);

  assert.match(clauses, /payload->>campaignContext\.ilike\.%summer%/i);
  assert.match(clauses, /payload->>campaignContext\.ilike\.%sale%/i);
});

test("lead search date helpers reject impossible dates and inverted ranges", () => {
  assert.equal(leadSearchInternals.validDate("2026-02-31"), undefined);
  assert.equal(leadSearchInternals.validDate("2026-02-28"), "2026-02-28");
  assert.deepEqual(leadSearchInternals.resolveCreatedAtRange({ from: "2026-06-10", to: "2026-06-09" }), {});
  assert.deepEqual(leadSearchInternals.resolveCreatedAtRange({ from: "2026-06-09", to: "2026-06-10" }), { from: "2026-06-09", to: "2026-06-10" });
});

test("lead source labels are localized for CRM surfaces", () => {
  assert.equal(leadSearchInternals.formatLeadSourceLabel("website_quote"), "Cotización web");
  assert.equal(leadSearchInternals.formatLeadSourceLabel("whatsapp_inbound_facebook"), "WhatsApp Facebook");
  assert.equal(leadSearchInternals.formatLeadSourceLabel("manual_asesor"), "Captura manual de asesor");
  assert.equal(leadSearchInternals.formatLeadSourceLabel("whatsapp"), "WhatsApp");
  assert.equal(leadSearchInternals.formatLeadSourceLabel("custom_source"), "Canal no identificado");
});

test("lead display helpers use Spanish fallbacks for internal values", () => {
  assert.equal(leadSearchInternals.formatLeadPriorityLabel("normal"), "Media");
  assert.equal(leadSearchInternals.formatLeadPriorityLabel("internal_only"), "Prioridad no identificada");
  assert.equal(leadSearchInternals.templateDisplayLabel("unknown_template_name"), "Plantilla operativa");
  assert.equal(leadSearchInternals.formatCurrencyAmount(1500, "USD"), "USD 1,500.00");
});

test("lead timeline helpers sanitize unknown operational identifiers instead of exposing raw values", () => {
  const timeline = leadSearchInternals.buildTimeline({
    lead: null,
    events: [
      {
        id: "event-unknown",
        created_at: "2026-07-01T12:00:00.000Z",
        event_type: "provider_sync_failed",
        payload: {},
        profiles: null,
      },
    ],
    notes: [],
    whatsappClicks: [],
    notifications: [],
    sheetLogs: [],
    payments: [
      {
        id: "payment-unknown",
        created_at: "2026-07-01T15:00:00.000Z",
        amount: 1500,
        currency: "MXN",
        status: "provider_pending_review",
        payment_type: "wire_transfer_internal",
      },
    ],
    bookings: [
      {
        id: "booking-unknown",
        created_at: "2026-07-01T16:00:00.000Z",
        booking_code: "AC-999",
        status: "supplier_hold_internal",
        starts_on: "2026-07-20",
      },
    ],
    documents: [
      {
        id: "document-unknown",
        created_at: "2026-07-01T17:00:00.000Z",
        title: "Archivo interno",
        document_type: "supplier_manifest_internal",
        status: "provider_review_pending",
      },
    ],
  });

  const event = timeline.find((item) => item.id === "event-event-unknown");
  const payment = timeline.find((item) => item.id === "payment-payment-unknown");
  const booking = timeline.find((item) => item.id === "booking-booking-unknown");
  const document = timeline.find((item) => item.id === "document-document-unknown");

  assert.equal(event?.label, "Evento operativo");
  assert.equal(payment?.label, "Pago Estado no identificado");
  assert.deepEqual(payment?.metadata, ["Pago operativo", "MXN 1,500.00"]);
  assert.equal(booking?.label, "Reserva Estado no identificado");
  assert.deepEqual(booking?.metadata, ["Código: AC-999", "Inicio: 20/7/2026"]);
  assert.equal(document?.label, "Documento Estado no identificado");
  assert.deepEqual(document?.metadata, ["Documento operativo", "Archivo interno"]);

  const visibleLabels = [event?.label, payment?.label, ...(payment?.metadata ?? []), booking?.label, ...(booking?.metadata ?? []), document?.label, ...(document?.metadata ?? [])].join(" ");
  assert.doesNotMatch(visibleLabels, /provider_sync_failed|provider_pending_review|wire_transfer_internal|supplier_hold_internal|supplier_manifest_internal|provider_review_pending/i);
});

test("lead timeline keeps CRM-friendly labels and hides provider details", () => {
  const timeline = leadSearchInternals.buildTimeline({
    lead: {
      id: "lead-1",
      created_at: "2026-07-01T10:00:00.000Z",
      summary: "Viaje a Cancún",
    },
    events: [
      {
        id: "event-1",
        created_at: "2026-07-01T12:00:00.000Z",
        event_type: "whatsapp_inbound_received",
        payload: { statusLabel: "Propuesta enviada", source: "whatsapp_inbound_facebook", referral: { headline: "Promo verano", source_type: "facebook", ctwa_clid: "secret-id" } },
        profiles: { full_name: "Ada" },
      },
    ],
    notes: [],
    whatsappClicks: [],
    notifications: [
      {
        id: "notification-1",
        created_at: "2026-07-01T13:00:00.000Z",
        channel: "email",
        provider: "resend",
        recipient: "ada@example.com",
        template_name: "client_quote_request_confirmation",
        status: "success",
        error_message: null,
      },
    ],
    sheetLogs: [
      {
        id: "sheet-1",
        created_at: "2026-07-01T14:00:00.000Z",
        sheet_name: "ignored",
        row_id: "123",
        status: "success",
        error_message: null,
      },
    ],
    payments: [
      {
        id: "payment-1",
        created_at: "2026-07-01T15:00:00.000Z",
        amount: 1500,
        currency: "MXN",
        status: "pending",
        payment_type: "deposit",
      },
    ],
    bookings: [
      {
        id: "booking-1",
        created_at: "2026-07-01T16:00:00.000Z",
        booking_code: "AC-001",
        status: "confirmed",
        starts_on: "2026-07-20",
      },
    ],
    documents: [
      {
        id: "document-1",
        created_at: "2026-07-01T17:00:00.000Z",
        title: "Pasaporte",
        document_type: "passport",
        status: "received",
      },
    ],
  });

  const created = timeline.find((item) => item.id === "lead-created-lead-1");
  const event = timeline.find((item) => item.id === "event-event-1");
  const email = timeline.find((item) => item.id === "notification-notification-1");
  const payment = timeline.find((item) => item.id === "payment-payment-1");
  const booking = timeline.find((item) => item.id === "booking-booking-1");
  const document = timeline.find((item) => item.id === "document-document-1");
  const sheet = timeline.find((item) => item.id === "sheet-sheet-1");

  assert.equal(created?.label, "Lead creado");
  assert.deepEqual(event?.metadata, ["Propuesta enviada", "Canal: WhatsApp Facebook", "Anuncio: Promo verano", "Red: facebook"]);
  assert.equal(email?.label, "Correo enviado");
  assert.deepEqual(email?.metadata, ["Plantilla: Confirmación de solicitud de cotización", "Para: ada@example.com"]);
  assert.equal(email?.summary, undefined);
  assert.equal(payment?.label, "Pago pendiente");
  assert.deepEqual(payment?.metadata, ["Anticipo", "MXN 1,500.00"]);
  assert.equal(booking?.label, "Reserva confirmada");
  assert.deepEqual(booking?.metadata, ["Código: AC-001", "Inicio: 20/7/2026"]);
  assert.equal(document?.label, "Documento recibido");
  assert.deepEqual(document?.metadata, ["Pasaporte", "Pasaporte"]);
  assert.equal(sheet?.label, "Sincronización operativa completada");
});

test("lead timeline formats follow-up metadata through shared Spanish helpers", () => {
  const timeline = leadSearchInternals.buildTimeline({
    lead: null,
    events: [
      {
        id: "event-follow-up",
        created_at: "2026-07-01T12:00:00.000Z",
        event_type: "follow_up_registered",
        payload: { followUpAt: "2026-07-03T09:30:00.000Z" },
        profiles: null,
      },
      {
        id: "event-follow-up-invalid",
        created_at: "2026-07-01T13:00:00.000Z",
        event_type: "follow_up_registered",
        payload: { followUpAt: "internal-invalid-date" },
        profiles: null,
      },
    ],
    notes: [],
    whatsappClicks: [],
    notifications: [],
    sheetLogs: [],
    payments: [],
    bookings: [],
    documents: [],
  });

  const validEvent = timeline.find((item) => item.id === "event-event-follow-up");
  const invalidEvent = timeline.find((item) => item.id === "event-event-follow-up-invalid");

  assert.deepEqual(validEvent?.metadata, [`Próximo: ${formatAdminDateTime("2026-07-03T09:30:00.000Z")}`]);
  assert.deepEqual(invalidEvent?.metadata, ["Próximo por definir"]);
  assert.doesNotMatch((validEvent?.metadata ?? []).join(" "), /2026-07-03T09:30:00\.000Z/);
  assert.doesNotMatch((invalidEvent?.metadata ?? []).join(" "), /internal-invalid-date/);
});

test("lead timeline maps WhatsApp page paths to safe Spanish module labels", () => {
  const timeline = leadSearchInternals.buildTimeline({
    lead: null,
    events: [],
    notes: [],
    whatsappClicks: [
      {
        id: "whatsapp-admin",
        created_at: "2026-07-01T12:00:00.000Z",
        phone: "+5215555555555",
        page_path: "/admin/leads/lead-123?status=qualified",
        message: "Hola",
      },
      {
        id: "whatsapp-unknown",
        created_at: "2026-07-01T13:00:00.000Z",
        phone: "+5215555555555",
        page_path: "/internal/private/debug/route",
        message: "Seguimiento",
      },
    ],
    notifications: [],
    sheetLogs: [],
    payments: [],
    bookings: [],
    documents: [],
  });

  const adminClick = timeline.find((item) => item.id === "whatsapp-whatsapp-admin");
  const unknownClick = timeline.find((item) => item.id === "whatsapp-whatsapp-unknown");

  assert.deepEqual(adminClick?.metadata, ["Tel: +5215555555555", "Origen: Módulo de prospectos"]);
  assert.deepEqual(unknownClick?.metadata, ["Tel: +5215555555555", "Origen: Sitio público"]);
  assert.doesNotMatch((adminClick?.metadata ?? []).join(" "), /\/admin\/leads\/lead-123|status=qualified/i);
  assert.doesNotMatch((unknownClick?.metadata ?? []).join(" "), /\/internal\/private\/debug\/route/i);
});

test("advisor auxiliary activity scope stays attached to visible lead ids only", () => {
  const advisorScope = leadSearchInternals.buildAuxiliaryActivityQueryScope({
    leadId: "lead-visible",
    contactId: "contact-1",
    visibleLeadIds: ["lead-visible", "lead-visible-2"],
    restrictToVisibleLeadIds: true,
  });
  const adminScope = leadSearchInternals.buildAuxiliaryActivityQueryScope({
    leadId: "lead-visible",
    contactId: "contact-1",
    visibleLeadIds: ["lead-visible", "lead-visible-2"],
    restrictToVisibleLeadIds: false,
  });

  assert.deepEqual(advisorScope, { mode: "lead_only", leadIds: ["lead-visible", "lead-visible-2"] });
  assert.deepEqual(adminScope, { mode: "lead_or_contact", orClause: "lead_id.eq.lead-visible,contact_id.eq.contact-1" });
});

test("crm lead surfaces keep enterprise labels in Spanish without implying quote versions", () => {
  const leadsPageSource = readFileSync("app/admin/(protected)/leads/page.tsx", "utf8");
  const leadDetailSource = readFileSync("app/admin/(protected)/leads/[id]/page.tsx", "utf8");

  assert.match(leadsPageSource, /Sin asignar/);
  assert.match(leadsPageSource, /Seguimiento vencido/);
  assert.match(leadsPageSource, /Múltiples solicitudes/);
  assert.match(leadsPageSource, /Revisión de duplicados/);
  assert.match(leadDetailSource, /Contacto 360/);
  assert.match(leadDetailSource, /title="Cotizaciones comerciales"/);
  assert.match(leadDetailSource, /Solicitudes del cliente/);
  assert.match(leadDetailSource, /no representan versiones de una cotización comercial/i);
});
