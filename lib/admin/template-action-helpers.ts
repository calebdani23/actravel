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

export function translateTemplateValidationMessage(message: string) {
  if (message.startsWith("Unsupported template variables:")) {
    return `Variables no soportadas: ${message.replace("Unsupported template variables:", "").trim()}`;
  }
  if (message.startsWith("Invalid selected variables:")) {
    return `Variables seleccionadas inválidas: ${message.replace("Invalid selected variables:", "").trim()}`;
  }
  if (message.startsWith("Channel-incompatible variables:")) {
    return `Variables incompatibles con el canal: ${message.replace("Channel-incompatible variables:", "").trim()}`;
  }
  if (message.startsWith("Used variables not selected:")) {
    return `Variables usadas sin seleccionar: ${message.replace("Used variables not selected:", "").trim()}`;
  }
  if (message.startsWith("Selected variables not used:")) {
    return `Variables seleccionadas sin uso: ${message.replace("Selected variables not used:", "").trim()}`;
  }
  return message;
}
