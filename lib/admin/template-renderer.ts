import {
  getTemplateVariableCatalog,
  getTemplateVariableExamples,
  isTemplateVariableSupportedForChannel,
  leadTemplateVariables,
  SUPPORTED_LEAD_TEMPLATE_VARIABLES,
  type LeadTemplateVariableInput,
  type MessageTemplateChannel,
  type TemplateVariables,
} from "./template-variables";

export {
  getTemplateVariableCatalog,
  getTemplateVariableExamples,
  leadTemplateVariables,
  SUPPORTED_LEAD_TEMPLATE_VARIABLES,
  type LeadTemplateVariableInput,
  type MessageTemplateChannel,
  type TemplateVariables,
};

const PLACEHOLDER_PATTERN = /{{\s*([a-zA-Z0-9_]+)\s*}}/g;

export function renderMessageTemplate(text: string, variables: TemplateVariables) {
  return text
    .replace(PLACEHOLDER_PATTERN, (_match, key: string) => {
      const value = variables[key];
      return value === null || value === undefined ? "" : String(value);
    })
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function extractTemplateVariables(text: string | null | undefined) {
  const variables = new Set<string>();
  for (const match of text?.matchAll(PLACEHOLDER_PATTERN) ?? []) {
    variables.add(match[1]);
  }
  return [...variables].sort();
}

export function validateTemplatePlaceholders(input: {
  subject?: string | null;
  body: string;
  declaredVariables?: readonly string[];
  channel?: MessageTemplateChannel;
  requireDeclared?: boolean;
  supportedVariables?: readonly string[];
}) {
  const usedVariables = new Set([
    ...extractTemplateVariables(input.subject),
    ...extractTemplateVariables(input.body),
  ]);
  const declaredVariables = [...new Set(input.declaredVariables ?? [])].sort();
  const declaredVariableSet = new Set(declaredVariables);
  const supportedVariables = new Set(input.supportedVariables ?? SUPPORTED_LEAD_TEMPLATE_VARIABLES);
  const requireDeclared = input.requireDeclared ?? Boolean(input.declaredVariables);

  const unknownVariables = [...usedVariables].filter((variable) => !supportedVariables.has(variable)).sort();
  const invalidDeclaredVariables = declaredVariables.filter((variable) => !supportedVariables.has(variable)).sort();
  const undeclaredVariables = [...usedVariables].filter((variable) => requireDeclared && !declaredVariableSet.has(variable)).sort();
  const unusedDeclaredVariables = declaredVariables.filter((variable) => !usedVariables.has(variable) && supportedVariables.has(variable)).sort();

  const channelIncompatibleVariables = input.channel
    ? [...new Set([
      ...[...usedVariables].filter((variable) => supportedVariables.has(variable) && !isTemplateVariableSupportedForChannel(variable, input.channel)),
      ...declaredVariables.filter((variable) => supportedVariables.has(variable) && !isTemplateVariableSupportedForChannel(variable, input.channel)),
    ])].sort()
    : [];

  const errors = [
    unknownVariables.length ? `Unsupported template variables: ${unknownVariables.join(", ")}` : null,
    invalidDeclaredVariables.length ? `Invalid selected variables: ${invalidDeclaredVariables.join(", ")}` : null,
    channelIncompatibleVariables.length ? `Channel-incompatible variables: ${channelIncompatibleVariables.join(", ")}` : null,
    undeclaredVariables.length ? `Used variables not selected: ${undeclaredVariables.join(", ")}` : null,
  ].filter((value): value is string => Boolean(value));

  const warnings = [
    unusedDeclaredVariables.length ? `Selected variables not used: ${unusedDeclaredVariables.join(", ")}` : null,
  ].filter((value): value is string => Boolean(value));

  return {
    usedVariables: [...usedVariables].sort(),
    declaredVariables,
    undeclaredVariables,
    unknownVariables,
    unusedDeclaredVariables,
    channelIncompatibleVariables,
    invalidDeclaredVariables,
    errors,
    warnings,
    isValid: errors.length === 0,
  };
}
