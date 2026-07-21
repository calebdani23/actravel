import assert from "node:assert/strict";
import test from "node:test";

import { adminLogsInternals } from "@/lib/admin/logs";
import { formatAdminDate, formatAdminDateTime, formatAdminDateWindowLabel, formatAdminFollowUpLabel, formatAdminLeadChipStructuredValue, formatAdminModuleLabelFromPath, formatAdminTravelerCount, formatAdminUtcWindowStartLabel } from "@/lib/admin/format";

test("admin format helpers keep Spanish date semantics and null-safe date fallback", () => {
  assert.equal(formatAdminDate("2026-07-20"), new Date("2026-07-20T00:00:00").toLocaleDateString("es-MX"));
  assert.equal(formatAdminDate(), "Por definir");
  assert.equal(formatAdminDate("fecha-invalida"), "Por definir");
  assert.equal(formatAdminDateTime("2026-07-20T15:45:00.000Z"), new Date("2026-07-20T15:45:00.000Z").toLocaleString("es-MX"));
  assert.equal(formatAdminDateTime("fecha-invalida"), "Por definir");
  assert.equal(
    formatAdminDateWindowLabel("2026-07-21T12:00:00.000Z", "próximos 7 días"),
    `${new Date("2026-07-21T12:00:00.000Z").toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · próximos 7 días`,
  );
  assert.equal(
    formatAdminUtcWindowStartLabel("2026-07-21T00:00:00.000Z"),
    `Desde ${new Date("2026-07-21T00:00:00.000Z").toLocaleString("es-MX")} UTC`,
  );
});

test("admin follow-up and module helpers keep operator-safe labels", () => {
  assert.equal(
    formatAdminFollowUpLabel("2026-07-20T15:45:00.000Z"),
    `Próximo: ${new Date("2026-07-20T15:45:00.000Z").toLocaleString("es-MX")}`,
  );
  assert.equal(formatAdminFollowUpLabel("fecha-invalida"), "Próximo por definir");
  assert.equal(formatAdminFollowUpLabel(), undefined);

  assert.equal(adminLogsInternals.whatsappModuleLabel("/admin/leads/lead-123"), "Módulo de prospectos");
  assert.equal(adminLogsInternals.whatsappModuleLabel("/admin/logs"), "Módulo de registros");
  assert.equal(adminLogsInternals.whatsappModuleLabel("admin-lead-detail"), "Detalle del prospecto");
  assert.equal(adminLogsInternals.whatsappModuleLabel("admin-lead-detail-template"), "Seguimiento con plantilla");
  assert.equal(adminLogsInternals.whatsappModuleLabel("admin-log-retry"), "Reintento desde registros");
  assert.equal(adminLogsInternals.whatsappModuleLabel("admin-alias-desconocido"), "Módulo administrativo");
  assert.equal(adminLogsInternals.whatsappModuleLabel("/cotizacion/cancun"), "Sitio público");
  assert.equal(adminLogsInternals.whatsappModuleLabel("/admin/internal/secret"), "Módulo administrativo");
  assert.equal(formatAdminModuleLabelFromPath("/admin/leads/lead-123"), "Módulo de prospectos");
  assert.equal(formatAdminModuleLabelFromPath("/admin/dashboard"), "Panel operativo");
  assert.equal(formatAdminModuleLabelFromPath("admin-lead-detail"), "Detalle del prospecto");
  assert.equal(formatAdminModuleLabelFromPath("admin-lead-detail-template"), "Seguimiento con plantilla");
  assert.equal(formatAdminModuleLabelFromPath("admin-log-retry"), "Reintento desde registros");
  assert.equal(formatAdminModuleLabelFromPath("/admin/internal/secret"), "Módulo administrativo");
  assert.equal(formatAdminModuleLabelFromPath("admin-alias-desconocido"), "Módulo administrativo");
  assert.doesNotMatch(formatAdminModuleLabelFromPath("admin-alias-desconocido"), /admin-alias-desconocido/i);
  assert.equal(formatAdminModuleLabelFromPath("quote-confirmation"), "Sitio público");
});

test("admin traveler count helper localizes singular and plural labels", () => {
  assert.equal(formatAdminTravelerCount(1), "1 viajero");
  assert.equal(formatAdminTravelerCount(2), "2 viajeros");
  assert.equal(formatAdminTravelerCount(1200), "1,200 viajeros");
  assert.equal(formatAdminTravelerCount(null), "0 viajeros");
});

test("admin lead filter chip helper keeps known labels and hides unknown structured values", () => {
  assert.equal(
    formatAdminLeadChipStructuredValue("status", "proposal_sent", [{ value: "proposal_sent", label: "Propuesta enviada" }]),
    "Propuesta enviada",
  );
  assert.equal(
    formatAdminLeadChipStructuredValue("destination", "dest-1", [{ value: "dest-1", label: "Cancún" }]),
    "Cancún",
  );
  assert.equal(
    formatAdminLeadChipStructuredValue("advisor", "advisor-1", [{ value: "advisor-1", label: "Ada Lovelace" }]),
    "Ada Lovelace",
  );
  assert.equal(formatAdminLeadChipStructuredValue("advisor", "unassigned", []), "Sin asignar");

  assert.equal(formatAdminLeadChipStructuredValue("status", "internal_status_slug", []), "Estado no identificado");
  assert.equal(formatAdminLeadChipStructuredValue("destination", "550e8400-e29b-41d4-a716-446655440000", []), "Destino no identificado");
  assert.equal(formatAdminLeadChipStructuredValue("advisor", "provider_admin_alias", []), "Asesor no identificado");
  assert.doesNotMatch(formatAdminLeadChipStructuredValue("status", "internal_status_slug", []), /internal_status_slug/i);
  assert.doesNotMatch(formatAdminLeadChipStructuredValue("destination", "550e8400-e29b-41d4-a716-446655440000", []), /550e8400-e29b-41d4-a716-446655440000/i);
  assert.doesNotMatch(formatAdminLeadChipStructuredValue("advisor", "provider_admin_alias", []), /provider_admin_alias/i);
});

test("admin notification status helper hides unknown raw statuses from operators", () => {
  assert.equal(adminLogsInternals.notificationStatusLabel("queued"), "En cola");
  assert.equal(adminLogsInternals.notificationStatusLabel("provider_internal_status"), "Estado no identificado");
  assert.doesNotMatch(adminLogsInternals.notificationStatusLabel("provider_internal_status"), /provider_internal_status/i);
});
