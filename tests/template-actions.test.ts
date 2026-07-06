import assert from "node:assert/strict";
import test from "node:test";

import {
  formatTemplateValidationError,
  normalizeTemplateVariableSelection,
  parseSelectedTemplateVariables,
} from "@/lib/admin/template-action-helpers";
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
