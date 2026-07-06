import { getTemplateVariableCatalog } from "@/lib/admin/template-variables";
import type { validateTemplatePlaceholders } from "@/lib/admin/template-renderer";

export function parseSelectedTemplateVariables(formData: FormData) {
  const values = formData.getAll("variables");
  return [...new Set(
    values
      .flatMap((value) => typeof value === "string" ? value.split(",") : [])
      .map((item) => item.trim())
      .filter(Boolean),
  )];
}

export function normalizeTemplateVariableSelection(variables: readonly string[]) {
  const sortOrder = new Map<string, number>(getTemplateVariableCatalog().map((item, index) => [item.key, index]));
  return [...new Set(variables)]
    .filter((variable) => sortOrder.has(variable))
    .sort((left, right) => (sortOrder.get(left) ?? 0) - (sortOrder.get(right) ?? 0));
}

export function formatTemplateValidationError(validation: ReturnType<typeof validateTemplatePlaceholders>) {
  return validation.errors.join(" | ");
}
