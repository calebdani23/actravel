import type { QuoteRequestInput } from "@/lib/validations/quote-request";

export type QuoteEmailTemplateName = "admin_quote_request_received" | "client_quote_request_confirmation";

export type QuoteEmailContext = {
  templateName: QuoteEmailTemplateName;
  input: QuoteRequestInput;
  leadId: string;
  quoteRequestId: string;
  normalizedEmail: string | null;
  whatsappHref: string;
};

type ViewModel = {
  locale: "es" | "en";
  name: string;
  destination: string;
  dates: string;
  travelers: string;
  currencyBudget: string;
  origin: string;
  service: string;
  email: string;
  whatsapp: string;
  notes: string;
  leadReference: string;
  quoteRequestId: string;
  whatsappHref: string;
};

const placeholder = "—";

function clean(value?: string | number | null) {
  if (value === undefined || value === null || value === "") return placeholder;
  return String(value);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char] ?? char);
}

function model(context: QuoteEmailContext): ViewModel {
  const { input } = context;
  return {
    locale: input.locale,
    name: clean(input.holderName),
    destination: clean(input.mainDestination),
    dates: `${clean(input.departureDate)} → ${clean(input.returnDate)}`,
    travelers: `${input.adults + input.children} (${input.adults} adultos, ${input.children} menores)`,
    currencyBudget: `${input.preferredCurrency} ${new Intl.NumberFormat(input.locale === "es" ? "es-MX" : "en-US").format(input.approximateBudget)}`,
    origin: clean(input.origin),
    service: clean(input.serviceInterest),
    email: clean(context.normalizedEmail),
    whatsapp: clean(input.whatsapp),
    notes: clean(input.notes),
    leadReference: context.leadId.slice(0, 8).toUpperCase(),
    quoteRequestId: context.quoteRequestId,
    whatsappHref: context.whatsappHref,
  };
}

function linesFor(templateName: QuoteEmailTemplateName, vm: ViewModel) {
  const label = vm.locale === "es"
    ? { destination: "Destino", dates: "Fechas", travelers: "Viajeros", budget: "Presupuesto", origin: "Origen", service: "Servicio", email: "Email", whatsapp: "WhatsApp", notes: "Notas", lead: "Lead", quote: "Solicitud", follow: "Continuar por WhatsApp" }
    : { destination: "Destination", dates: "Dates", travelers: "Travelers", budget: "Budget", origin: "Origin", service: "Service", email: "Email", whatsapp: "WhatsApp", notes: "Notes", lead: "Lead", quote: "Request", follow: "Continue on WhatsApp" };
  const greeting = templateName === "admin_quote_request_received"
    ? (vm.locale === "es" ? `Nueva solicitud de cotización de ${vm.name}.` : `New quote request from ${vm.name}.`)
    : (vm.locale === "es" ? `Hola ${vm.name}, recibimos tu solicitud de viaje.` : `Hi ${vm.name}, we received your travel request.`);
  return [
    greeting,
    `${label.destination}: ${vm.destination}`,
    `${label.dates}: ${vm.dates}`,
    `${label.travelers}: ${vm.travelers}`,
    `${label.budget}: ${vm.currencyBudget}`,
    `${label.origin}: ${vm.origin}`,
    `${label.service}: ${vm.service}`,
    `${label.email}: ${vm.email}`,
    `${label.whatsapp}: ${vm.whatsapp}`,
    `${label.notes}: ${vm.notes}`,
    `${label.lead}: ${vm.leadReference}`,
    `${label.quote}: ${vm.quoteRequestId}`,
    `${label.follow}: ${vm.whatsappHref}`,
  ];
}

export function renderQuoteEmail(context: QuoteEmailContext) {
  const vm = model(context);
  const subject = context.templateName === "admin_quote_request_received"
    ? (vm.locale === "es" ? `Nueva cotización AC Travel · ${vm.destination}` : `New AC Travel quote · ${vm.destination}`)
    : (vm.locale === "es" ? `Recibimos tu solicitud AC Travel · ${vm.destination}` : `We received your AC Travel request · ${vm.destination}`);
  const lines = linesFor(context.templateName, vm);
  return {
    subject,
    text: lines.join("\n"),
    html: `<div>${lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}</div>`,
    metadata: { locale: vm.locale, templateName: context.templateName, leadReference: vm.leadReference, destination: vm.destination },
  };
}
