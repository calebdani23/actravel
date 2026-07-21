import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { catalogStatusLabel, resolveCatalogStatusForDisplay, summarizeCatalogStatuses } from "@/lib/admin/catalog-status";
import { getPendingSafeCancelState } from "@/lib/admin/pending-safe-navigation";
import { getTemplateVariableCatalog, templateChannelLabel, templateVariableSourceLabel } from "@/lib/admin/template-variables";

test("template variable metadata and helper labels stay localized in Spanish", () => {
  const catalog = getTemplateVariableCatalog();

  assert.equal(catalog[0]?.label, "Nombre del viajero");
  assert.match(catalog[0]?.description ?? "", /Nombre principal del contacto/);
  assert.equal(templateVariableSourceLabel("lead"), "Prospecto");
  assert.equal(templateVariableSourceLabel("advisor"), "Asesor asignado");
  assert.equal(templateVariableSourceLabel("system"), "Sistema");
  assert.equal(templateVariableSourceLabel("raw_source"), "Origen no identificado");
  assert.equal(templateChannelLabel("email"), "Email");
  assert.equal(templateChannelLabel("whatsapp"), "WhatsApp");
  assert.equal(templateChannelLabel("fax"), "Canal no identificado");
});

test("pending-safe cancel helper disables navigation while actions are pending", () => {
  assert.deepEqual(getPendingSafeCancelState("/admin/templates", false), { kind: "link", href: "/admin/templates" });
  assert.deepEqual(getPendingSafeCancelState("/admin/templates", true), { kind: "disabled", ariaDisabled: true });
});

test("catalog unknown statuses do not fall back to draft counts or labels", () => {
  assert.equal(catalogStatusLabel("draft"), "Borrador");
  assert.equal(catalogStatusLabel("published"), "Publicado");
  assert.equal(catalogStatusLabel("archived"), "Archivado");
  assert.equal(catalogStatusLabel("mystery"), "Estado no identificado");

  assert.deepEqual(
    summarizeCatalogStatuses(
      [
        { status: "draft" },
        { status: "published" },
        { status: "archived" },
        { status: "mystery" },
      ],
      (row) => row.status !== "published",
    ),
    { draft: 1, published: 1, archived: 1, unknown: 1, incomplete: 3 },
  );

  assert.equal(resolveCatalogStatusForDisplay(undefined), "draft");
  assert.equal(resolveCatalogStatusForDisplay({ status: null }), null);
  assert.equal(resolveCatalogStatusForDisplay({ status: "mystery" }), "mystery");
});

test("phase 4 forms no longer use disabled links for cancel actions", () => {
  const templateForm = readFileSync("components/admin/templates/template-form.tsx", "utf8");
  const catalogSubmitBar = readFileSync("components/admin/catalog/catalog-submit-bar.tsx", "utf8");

  assert.doesNotMatch(templateForm, /asChild disabled=\{pending\}/);
  assert.doesNotMatch(catalogSubmitBar, /asChild disabled=\{pending\}/);
  assert.match(templateForm, /getPendingSafeCancelState/);
  assert.match(catalogSubmitBar, /getPendingSafeCancelState/);
  assert.match(templateForm, /aria-disabled=\{cancelState\.ariaDisabled\}/);
  assert.match(catalogSubmitBar, /aria-disabled=\{cancelState\.ariaDisabled\}/);
});

test("catalog action redirects keep error feedback sanitized and backend-specific details out of UI paths", () => {
  const catalogActions = readFileSync("lib/admin/catalog-actions.ts", "utf8");
  const catalogActionRoute = readFileSync("app/admin/(protected)/catalog/actions.ts", "utf8");
  const catalogPage = readFileSync("app/admin/(protected)/catalog/[resource]/page.tsx", "utf8");

  assert.match(catalogActionRoute, /catalogActionErrorMessage\(error, \{ resource: targetResource, action: actionKind \}\)/);
  assert.match(catalogActionRoute, /console\.error\("\[catalog\] admin action failed", error\)/);
  assert.doesNotMatch(catalogActions, /error\.message\.trim\(\)/);
  assert.match(catalogActions, /CATALOG_ADMIN_FEEDBACK_FOCUS = "feedback"/);
  assert.doesNotMatch(catalogPage, /id=\{row\.id\}/);
  assert.doesNotMatch(catalogPage, /#\$\{row\.id\}/);
  assert.doesNotMatch(catalogPage, /feedbackFocus === row\.id/);
  assert.match(catalogPage, /id="catalog-feedback"/);
});
