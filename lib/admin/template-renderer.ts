export type TemplateVariables = Record<string, string | number | null | undefined>;

export const SUPPORTED_LEAD_TEMPLATE_VARIABLES = [
  "name",
  "destination",
  "startDate",
  "endDate",
  "travelers",
  "budget",
  "advisor",
  "status",
] as const;

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
  supportedVariables?: readonly string[];
}) {
  const usedVariables = new Set([
    ...extractTemplateVariables(input.subject),
    ...extractTemplateVariables(input.body),
  ]);
  const declaredVariables = new Set(input.declaredVariables ?? []);
  const supportedVariables = new Set(input.supportedVariables ?? SUPPORTED_LEAD_TEMPLATE_VARIABLES);

  const undeclaredVariables = [...usedVariables].filter((variable) => declaredVariables.size > 0 && !declaredVariables.has(variable)).sort();
  const unknownVariables = [...usedVariables].filter((variable) => !supportedVariables.has(variable)).sort();
  const unusedDeclaredVariables = [...declaredVariables].filter((variable) => !usedVariables.has(variable)).sort();

  return {
    usedVariables: [...usedVariables].sort(),
    undeclaredVariables,
    unknownVariables,
    unusedDeclaredVariables,
    isValid: unknownVariables.length === 0,
  };
}

export function leadTemplateVariables(input: {
  contactName?: string | null;
  destination?: string | null;
  travelStartDate?: string | null;
  travelEndDate?: string | null;
  travelersCount?: number | null;
  budget?: string | null;
  advisorName?: string | null;
  status?: string | null;
}) {
  return {
    name: input.contactName ?? "",
    destination: input.destination ?? "",
    startDate: input.travelStartDate ?? "",
    endDate: input.travelEndDate ?? "",
    travelers: input.travelersCount ?? "",
    budget: input.budget ?? "",
    advisor: input.advisorName ?? "AC Travel",
    status: input.status ?? "",
  } satisfies TemplateVariables;
}
