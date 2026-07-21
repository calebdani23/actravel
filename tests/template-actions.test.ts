import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  formatTemplateValidationError,
  normalizeTemplateVariableSelection,
  parseSelectedTemplateVariables,
} from "@/lib/admin/template-action-helpers";
import { buildTemplateRedirectTarget, TEMPLATE_FEEDBACK_FOCUS } from "@/lib/admin/template-feedback";
import { validateTemplatePlaceholders } from "@/lib/admin/template-renderer";

test("parseSelectedTemplateVariables supports repeated fields and comma fallback", () => {
  const formData = new FormData();
  formData.append("variables", "destination");
  formData.append("variables", "name, budget");
  formData.append("variables", "destination");

  assert.deepEqual(parseSelectedTemplateVariables(formData), ["destination", "name", "budget"]);
});

test("normalizeTemplateVariableSelection keeps catalog order and drops invalid keys", () => {
  assert.deepEqual(normalizeTemplateVariableSelection(["status", "name", "unknown", "destination", "name"]), ["name", "destination", "status"]);
});

test("formatTemplateValidationError joins actionable validation errors", () => {
  const validation = validateTemplatePlaceholders({
    body: "Hola {{name}} {{destnation}}",
    declaredVariables: ["name"],
    channel: "whatsapp",
  });

  assert.equal(validation.isValid, false);
  assert.match(formatTemplateValidationError(validation), /Unsupported template variables: destnation/);
  assert.match(formatTemplateValidationError(validation), /Used variables not selected: destnation/);
});

test("template admin workspace uses safe redirect feedback and spanish editor copy", () => {
  const actions = readFileSync("app/admin/(protected)/templates/actions.ts", "utf8");
  const page = readFileSync("app/admin/(protected)/templates/page.tsx", "utf8");
  const form = readFileSync("components/admin/templates/template-form.tsx", "utf8");
  const helpers = readFileSync("lib/admin/template-action-helpers.ts", "utf8");

  assert.match(actions, /buildTemplateRedirectTarget/);
  assert.match(actions, /redirect\(buildTemplateRedirectTarget/);
  assert.match(actions, /\[templates\] admin action failed/);
  assert.match(actions, /Plantilla actualizada correctamente\./);
  assert.match(actions, /Plantilla creada correctamente\./);
  assert.match(actions, /Plantilla eliminada:/);
  assert.match(page, /Nueva plantilla/);
  assert.match(page, /Variables disponibles/);
  assert.match(page, /WhatsApp/);
  assert.match(page, /Email/);
  assert.match(page, /Revisar variables/);
  assert.match(form, /Configuración básica/);
  assert.match(form, /Contenido bilingüe/);
  assert.match(form, /Variables y validación/);
  assert.match(form, /Estado y vista previa/);
  assert.match(form, /Copiar ES/);
  assert.match(form, /Copiar EN/);
  assert.match(form, /Validación lista/);
  assert.match(form, /LocalizedEditorTabs/);
  assert.match(helpers, /Variables no soportadas:/);
  assert.match(helpers, /Variables usadas sin seleccionar:/);
});

test("template redirect focus stays generic and never includes raw template ids", () => {
  assert.equal(
    buildTemplateRedirectTarget({ status: "success", message: "Plantilla actualizada correctamente.", focus: true }),
    `/admin/templates?status=success&message=Plantilla+actualizada+correctamente.&focus=${TEMPLATE_FEEDBACK_FOCUS}`,
  );

  const page = readFileSync("app/admin/(protected)/templates/page.tsx", "utf8");

  assert.match(page, /id="template-feedback"/);
  assert.doesNotMatch(page, /id=\{template\.id\}/);
  assert.doesNotMatch(page, /feedbackFocus === template\.id/);
});
