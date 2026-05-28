import assert from "node:assert/strict";
import test from "node:test";

import {
  extractTemplateVariables,
  leadTemplateVariables,
  renderMessageTemplate,
  validateTemplatePlaceholders,
} from "@/lib/admin/template-renderer";

test("renders message templates with lead variables and empty missing values", () => {
  const variables = leadTemplateVariables({ contactName: "Ada", destination: "Riviera Maya", travelersCount: 3, advisorName: null });

  assert.equal(
    renderMessageTemplate("Hola {{ name }}, viaje: {{destination}} / {{travelers}} / {{advisor}} / {{missing}}", variables),
    "Hola Ada, viaje: Riviera Maya / 3 / AC Travel /",
  );
});

test("extracts unique sorted placeholders from template text", () => {
  assert.deepEqual(extractTemplateVariables("{{destination}} {{ name }} {{name}} {{startDate}}"), ["destination", "name", "startDate"]);
});

test("validates unknown, undeclared, and unused variables", () => {
  const result = validateTemplatePlaceholders({
    subject: "Viaje a {{destination}}",
    body: "Hola {{name}}, código {{customCode}}",
    declaredVariables: ["name", "unused"],
  });

  assert.equal(result.isValid, false);
  assert.deepEqual(result.usedVariables, ["customCode", "destination", "name"]);
  assert.deepEqual(result.unknownVariables, ["customCode"]);
  assert.deepEqual(result.undeclaredVariables, ["customCode", "destination"]);
  assert.deepEqual(result.unusedDeclaredVariables, ["unused"]);
});
