import assert from "node:assert/strict";
import test from "node:test";

import {
  getTemplateVariableCatalog,
  getTemplateVariableExamples,
  extractTemplateVariables,
  leadTemplateVariables,
  renderMessageTemplate,
  SUPPORTED_LEAD_TEMPLATE_VARIABLES,
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

test("catalog preserves supported key order and metadata coverage", () => {
  assert.deepEqual(SUPPORTED_LEAD_TEMPLATE_VARIABLES, ["name", "destination", "startDate", "endDate", "travelers", "budget", "advisor", "status"]);

  const catalog = getTemplateVariableCatalog();
  assert.equal(catalog.length, SUPPORTED_LEAD_TEMPLATE_VARIABLES.length);

  for (const item of catalog) {
    assert.ok(item.key);
    assert.ok(item.label);
    assert.ok(item.description);
    assert.ok(item.source);
    assert.ok(item.channels.length > 0);
    assert.notEqual(item.example, undefined);
    assert.equal(typeof item.leadResolver, "function");
  }
});

test("catalog examples come from the shared variable catalog", () => {
  assert.deepEqual(getTemplateVariableExamples(), {
    name: "María",
    destination: "Riviera Maya",
    startDate: "2026-07-15",
    endDate: "2026-07-20",
    travelers: 2,
    budget: "$45,000 MXN",
    advisor: "AC Travel",
    status: "Cotizando",
  });
});

test("validates unknown, undeclared, invalid declared, and unused variables", () => {
  const result = validateTemplatePlaceholders({
    subject: "Viaje a {{destination}}",
    body: "Hola {{name}}, código {{customCode}}",
    declaredVariables: ["name", "unused", "invalidKey"],
  });

  assert.equal(result.isValid, false);
  assert.deepEqual(result.usedVariables, ["customCode", "destination", "name"]);
  assert.deepEqual(result.unknownVariables, ["customCode"]);
  assert.deepEqual(result.undeclaredVariables, ["customCode", "destination"]);
  assert.deepEqual(result.invalidDeclaredVariables, ["invalidKey", "unused"]);
  assert.deepEqual(result.unusedDeclaredVariables, []);
  assert.match(result.errors.join("\n"), /customCode/);
});

test("used but undeclared valid variables are save-blocking", () => {
  const result = validateTemplatePlaceholders({
    body: "Hola {{name}}, seguimos con {{destination}}",
    declaredVariables: ["name"],
    channel: "whatsapp",
  });

  assert.equal(result.isValid, false);
  assert.deepEqual(result.undeclaredVariables, ["destination"]);
  assert.match(result.errors.join("\n"), /destination/);
});

test("selected but unused valid variables are warnings only", () => {
  const result = validateTemplatePlaceholders({
    body: "Hola {{name}}",
    declaredVariables: ["name", "destination"],
    channel: "whatsapp",
  });

  assert.equal(result.isValid, true);
  assert.deepEqual(result.unusedDeclaredVariables, ["destination"]);
  assert.deepEqual(result.warnings, ["Selected variables not used: destination"]);
});

test("channel incompatible variables are blocked for used and declared keys", () => {
  const result = validateTemplatePlaceholders({
    body: "Hola {{name}} {{subjectLine}}",
    declaredVariables: ["name", "subjectLine"],
    channel: "whatsapp",
    supportedVariables: ["name", "subjectLine"],
  });

  assert.equal(result.isValid, false);
  assert.deepEqual(result.channelIncompatibleVariables, ["subjectLine"]);
});

test("lead template variables preserve current fallbacks", () => {
  assert.deepEqual(leadTemplateVariables({ contactName: null, advisorName: null, travelersCount: null }), {
    name: "",
    destination: "",
    startDate: "",
    endDate: "",
    travelers: "",
    budget: "",
    advisor: "AC Travel",
    status: "",
  });
});
