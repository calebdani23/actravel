import type { QuoteRequestInput } from "@/lib/validations/quote-request";

export const LEAD_SHEET_HEADERS = [
  "Fecha",
  "Nombre",
  "WhatsApp",
  "Email",
  "Idioma",
  "Moneda",
  "Origen",
  "Destino",
  "Adultos",
  "Menores",
  "Fechas",
  "Presupuesto",
  "Servicio",
  "Canal",
  "Promoción",
  "Estado",
  "Asesor",
  "Última nota",
  "Lead ID",
] as const;

export type LeadSheetRowContext = {
  leadId: string;
  input: QuoteRequestInput;
  normalizedEmail: string | null;
  normalizedWhatsapp: string;
  createdAt?: string;
  status?: string | null;
  advisor?: string | null;
  promotion?: string | null;
  lastNote?: string | null;
};

function valueOrEmpty(value?: string | number | null) {
  if (value === undefined || value === null) return "";
  return String(value);
}

export function buildLeadSheetRow(context: LeadSheetRowContext): string[] {
  const { input } = context;
  return [
    context.createdAt ?? new Date().toISOString(),
    input.holderName,
    context.normalizedWhatsapp,
    valueOrEmpty(context.normalizedEmail),
    input.locale,
    input.preferredCurrency,
    valueOrEmpty(input.origin),
    input.mainDestination,
    String(input.adults),
    String(input.children),
    `${input.departureDate} — ${input.returnDate}`,
    String(input.approximateBudget),
    input.serviceInterest,
    valueOrEmpty(input.sourceChannel || "website_quote"),
    valueOrEmpty(context.promotion),
    valueOrEmpty(context.status ?? "new"),
    valueOrEmpty(context.advisor),
    valueOrEmpty(context.lastNote ?? input.notes),
    context.leadId,
  ];
}
