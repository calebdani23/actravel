export type MessageTemplateChannel = "email" | "whatsapp";
export type TemplateVariableSource = "lead" | "advisor" | "system";
export type TemplateVariableValue = string | number | null | undefined;
export type TemplateVariables = Record<string, TemplateVariableValue>;

export type LeadTemplateVariableInput = {
  contactName?: string | null;
  destination?: string | null;
  travelStartDate?: string | null;
  travelEndDate?: string | null;
  travelersCount?: number | null;
  budget?: string | null;
  advisorName?: string | null;
  status?: string | null;
};

export type TemplateVariableDefinition = {
  key: string;
  label: string;
  description: string;
  source: TemplateVariableSource;
  channels: readonly MessageTemplateChannel[];
  example: string | number;
  leadResolver?: (input: LeadTemplateVariableInput) => TemplateVariableValue;
};

export const TEMPLATE_VARIABLE_CATALOG = [
  {
    key: "name",
    label: "Traveler name",
    description: "Primary contact or traveler display name.",
    source: "lead",
    channels: ["email", "whatsapp"],
    example: "María",
    leadResolver: (input) => input.contactName ?? "",
  },
  {
    key: "destination",
    label: "Destination",
    description: "Requested destination for the trip.",
    source: "lead",
    channels: ["email", "whatsapp"],
    example: "Riviera Maya",
    leadResolver: (input) => input.destination ?? "",
  },
  {
    key: "startDate",
    label: "Start date",
    description: "Requested departure date.",
    source: "lead",
    channels: ["email", "whatsapp"],
    example: "2026-07-15",
    leadResolver: (input) => input.travelStartDate ?? "",
  },
  {
    key: "endDate",
    label: "End date",
    description: "Requested return date.",
    source: "lead",
    channels: ["email", "whatsapp"],
    example: "2026-07-20",
    leadResolver: (input) => input.travelEndDate ?? "",
  },
  {
    key: "travelers",
    label: "Travelers",
    description: "Traveler count for the request.",
    source: "lead",
    channels: ["email", "whatsapp"],
    example: 2,
    leadResolver: (input) => input.travelersCount ?? "",
  },
  {
    key: "budget",
    label: "Budget",
    description: "Budget text captured from the lead.",
    source: "lead",
    channels: ["email", "whatsapp"],
    example: "$45,000 MXN",
    leadResolver: (input) => input.budget ?? "",
  },
  {
    key: "advisor",
    label: "Advisor",
    description: "Assigned advisor name with AC Travel fallback.",
    source: "advisor",
    channels: ["email", "whatsapp"],
    example: "AC Travel",
    leadResolver: (input) => input.advisorName ?? "AC Travel",
  },
  {
    key: "status",
    label: "Lead status",
    description: "Current lead status label.",
    source: "system",
    channels: ["email", "whatsapp"],
    example: "Cotizando",
    leadResolver: (input) => input.status ?? "",
  },
] as const satisfies readonly TemplateVariableDefinition[];

const VARIABLE_BY_KEY = new Map<string, TemplateVariableDefinition>(TEMPLATE_VARIABLE_CATALOG.map((item) => [item.key, item]));

export const SUPPORTED_LEAD_TEMPLATE_VARIABLES = TEMPLATE_VARIABLE_CATALOG.map((item) => item.key);

export function getTemplateVariableCatalog(channel?: MessageTemplateChannel) {
  if (!channel) return [...TEMPLATE_VARIABLE_CATALOG];
  return TEMPLATE_VARIABLE_CATALOG.filter((item) => item.channels.includes(channel));
}

export function getTemplateVariableDefinition(key: string) {
  return VARIABLE_BY_KEY.get(key);
}

export function getTemplateVariableExamples(channel?: MessageTemplateChannel): TemplateVariables {
  return Object.fromEntries(getTemplateVariableCatalog(channel).map((item) => [item.key, item.example]));
}

export function isTemplateVariableSupportedForChannel(key: string, channel?: MessageTemplateChannel) {
  const definition = getTemplateVariableDefinition(key);
  if (!definition) return false;
  return !channel || definition.channels.includes(channel);
}

export function leadTemplateVariables(input: LeadTemplateVariableInput): TemplateVariables {
  return Object.fromEntries(
    TEMPLATE_VARIABLE_CATALOG.map((item) => [item.key, item.leadResolver ? item.leadResolver(input) : ""]),
  );
}
