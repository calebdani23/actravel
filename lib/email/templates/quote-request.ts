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
  travelerBreakdown: string;
  currencyBudget: string;
  origin: string;
  service: string;
  email: string;
  whatsapp: string;
  notes: string;
  sourceChannel: string;
  contactConsent: string;
  leadReference: string;
  quoteRequestId: string;
  whatsappHref: string;
};

type Audience = "admin" | "client";

type EmailSection = {
  title: string;
  rows: Array<{ label: string; value: string }>;
};

type ShellInput = {
  locale: "es" | "en";
  previewText: string;
  eyebrow: string;
  title: string;
  intro: string;
  sections: EmailSection[];
  primaryCta?: { label: string; href: string };
  secondaryNote?: string;
  signatureLines: string[];
  footerNote: string;
  references: string[];
};

const placeholder = "—";
const brandName = "AC Travel";

function clean(value?: string | number | null) {
  if (value === undefined || value === null || value === "") return placeholder;
  return String(value);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char] ?? char);
}

function localeLabels(locale: "es" | "en") {
  return locale === "es"
    ? {
      adults: "adultos",
      children: "menores",
      travelers: "viajeros",
      yes: "Sí",
      no: "No",
      leadReference: "Referencia del lead",
      quoteRequestId: "ID de solicitud",
      customer: "Cliente",
      destination: "Destino",
      dates: "Fechas",
      service: "Servicio",
      travelerBreakdown: "Viajeros",
      budget: "Presupuesto",
      email: "Email",
      whatsapp: "WhatsApp",
      origin: "Origen",
      notes: "Notas",
      sourceChannel: "Canal",
      contactConsent: "Consentimiento de contacto",
      continueWhatsApp: "Continuar por WhatsApp",
      contactWhatsApp: "Contactar por WhatsApp",
      greeting: "Hola",
      bestRegards: "Saludos,",
      team: "Equipo AC Travel",
      advisors: "Asesores de viaje",
      requestReceived: "Solicitud recibida",
      newQuoteRequest: "Nueva solicitud de cotización",
      tripSummary: "Resumen del viaje",
      budgetAndContact: "Presupuesto y contacto",
      whatHappensNext: "Qué sigue",
      leadSummary: "Resumen del lead",
      travelerAndBudget: "Viajeros y presupuesto",
      contactDetails: "Datos de contacto",
      internalNotes: "Notas internas",
    }
    : {
      adults: "adults",
      children: "children",
      travelers: "travelers",
      yes: "Yes",
      no: "No",
      leadReference: "Lead reference",
      quoteRequestId: "Quote request ID",
      customer: "Customer",
      destination: "Destination",
      dates: "Dates",
      service: "Service",
      travelerBreakdown: "Travelers",
      budget: "Budget",
      email: "Client email",
      whatsapp: "Client WhatsApp",
      origin: "Origin",
      notes: "Notes",
      sourceChannel: "Source channel",
      contactConsent: "Contact consent",
      continueWhatsApp: "Continue on WhatsApp",
      contactWhatsApp: "Contact by WhatsApp",
      greeting: "Hi",
      bestRegards: "Best regards,",
      team: "AC Travel Team",
      advisors: "Travel advisors",
      requestReceived: "Request received",
      newQuoteRequest: "New quote request",
      tripSummary: "Trip summary",
      budgetAndContact: "Budget and contact",
      whatHappensNext: "What happens next",
      leadSummary: "Lead summary",
      travelerAndBudget: "Travelers and budget",
      contactDetails: "Contact details",
      internalNotes: "Internal notes",
    };
}

function model(context: QuoteEmailContext): ViewModel {
  const { input } = context;
  const labels = localeLabels(input.locale);
  return {
    locale: input.locale,
    name: clean(input.holderName),
    destination: clean(input.mainDestination),
    dates: `${clean(input.departureDate)} → ${clean(input.returnDate)}`,
    travelers: `${input.adults + input.children} ${labels.travelers}`,
    travelerBreakdown: `${input.adults + input.children} ${labels.travelers} (${input.adults} ${labels.adults}, ${input.children} ${labels.children})`,
    currencyBudget: `${input.preferredCurrency} ${new Intl.NumberFormat(input.locale === "es" ? "es-MX" : "en-US").format(input.approximateBudget)}`,
    origin: clean(input.origin),
    service: clean(input.serviceInterest),
    email: clean(context.normalizedEmail),
    whatsapp: clean(input.whatsapp),
    notes: clean(input.notes),
    sourceChannel: clean(input.sourceChannel),
    contactConsent: input.contactConsent ? labels.yes : labels.no,
    leadReference: context.leadId.slice(0, 8).toUpperCase(),
    quoteRequestId: context.quoteRequestId,
    whatsappHref: context.whatsappHref,
  };
}

function renderSectionHtml(section: EmailSection) {
  return `<div style="margin:0 0 20px;"><p style="margin:0 0 10px;font-size:13px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#8a5a2b;">${escapeHtml(section.title)}</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${section.rows.map((row) => `<tr><td style="padding:0 0 8px;vertical-align:top;font-size:14px;line-height:20px;color:#6b5b4f;width:170px;"><strong>${escapeHtml(row.label)}:</strong></td><td style="padding:0 0 8px;vertical-align:top;font-size:14px;line-height:20px;color:#1f2937;">${escapeHtml(row.value)}</td></tr>`).join("")}</table></div>`;
}

function renderSectionText(section: EmailSection) {
  return [section.title, ...section.rows.map((row) => `${row.label}: ${row.value}`)].join("\n");
}

function renderShell(input: ShellInput) {
  const textBlocks = [
    brandName,
    input.eyebrow,
    input.title,
    input.intro,
    ...input.sections.map(renderSectionText),
    input.primaryCta ? `${input.primaryCta.label}: ${input.primaryCta.href}` : null,
    input.secondaryNote ?? null,
    ...input.signatureLines,
    input.footerNote,
    ...input.references,
  ].filter(Boolean);

  const html = `<div style="background:#f6f3ee;margin:0;padding:24px 12px;"><div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(input.previewText)}</div><div style="margin:0 auto;max-width:640px;"><div style="background:#1f4d4f;padding:24px 28px;border-radius:20px 20px 0 0;"><p style="margin:0 0 8px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#f9d9b1;">${escapeHtml(brandName)}</p><h1 style="margin:0;font-size:28px;line-height:34px;color:#ffffff;">${escapeHtml(input.eyebrow)}</h1><p style="margin:10px 0 0;font-size:14px;line-height:22px;color:#d7ebe7;">${escapeHtml(input.previewText)}</p></div><div style="background:#ffffff;padding:28px;border:1px solid #e7ddd2;border-top:0;border-radius:0 0 20px 20px;"><p style="margin:0 0 8px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#8a5a2b;">${escapeHtml(input.eyebrow)}</p><h2 style="margin:0 0 12px;font-size:24px;line-height:30px;color:#1f2937;">${escapeHtml(input.title)}</h2><p style="margin:0 0 24px;font-size:15px;line-height:24px;color:#4b5563;">${escapeHtml(input.intro)}</p>${input.sections.map(renderSectionHtml).join("")}${input.primaryCta ? `<div style="margin:0 0 20px;"><a href="${escapeHtml(input.primaryCta.href)}" style="display:inline-block;background:#1f4d4f;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:999px;font-size:14px;font-weight:700;">${escapeHtml(input.primaryCta.label)}</a></div>` : ""}${input.secondaryNote ? `<p style="margin:0 0 24px;font-size:13px;line-height:21px;color:#6b7280;">${escapeHtml(input.secondaryNote)}</p>` : ""}<div style="margin:24px 0 0;padding-top:20px;border-top:1px solid #e5e7eb;"><p style="margin:0;font-size:14px;line-height:22px;color:#1f2937;">${input.signatureLines.map((line) => escapeHtml(line)).join("<br />")}</p></div><div style="margin:24px 0 0;padding-top:18px;border-top:1px solid #f1f5f9;"><p style="margin:0 0 10px;font-size:12px;line-height:19px;color:#6b7280;">${escapeHtml(input.footerNote)}</p><p style="margin:0;font-size:12px;line-height:19px;color:#9ca3af;">${input.references.map((line) => escapeHtml(line)).join("<br />")}</p></div></div></div></div>`;

  return { html, text: textBlocks.join("\n\n") };
}

function renderAdminQuoteEmail(vm: ViewModel) {
  const label = localeLabels(vm.locale);
  const content = renderShell({
    locale: vm.locale,
    previewText: vm.locale === "es" ? `Nueva cotización para ${vm.destination}. Revisa los datos del lead y da seguimiento rápido.` : `New quote request for ${vm.destination}. Review the lead details and follow up quickly.`,
    eyebrow: label.newQuoteRequest,
    title: vm.locale === "es" ? `${vm.name} pidió apoyo para ${vm.destination}` : `${vm.name} requested help with ${vm.destination}`,
    intro: vm.locale === "es" ? "Este correo resume la solicitud recibida desde el formulario público para que el equipo comercial actúe sin demora." : "This email summarizes the request submitted through the public quote form so the sales team can act quickly.",
    sections: [
      { title: label.leadSummary, rows: [{ label: label.leadReference, value: vm.leadReference }, { label: label.quoteRequestId, value: vm.quoteRequestId }, { label: label.customer, value: vm.name }, { label: label.destination, value: vm.destination }, { label: label.service, value: vm.service }, { label: label.dates, value: vm.dates }] },
      { title: label.travelerAndBudget, rows: [{ label: label.travelerBreakdown, value: vm.travelerBreakdown }, { label: label.budget, value: vm.currencyBudget }, { label: label.origin, value: vm.origin }] },
      { title: label.contactDetails, rows: [{ label: label.email, value: vm.email }, { label: label.whatsapp, value: vm.whatsapp }, { label: label.sourceChannel, value: vm.sourceChannel }, { label: label.contactConsent, value: vm.contactConsent }] },
      { title: label.internalNotes, rows: [{ label: label.notes, value: vm.notes }] },
    ],
    primaryCta: { label: label.contactWhatsApp, href: vm.whatsappHref },
    secondaryNote: vm.locale === "es" ? "Si algún dato difiere del panel admin o Supabase, usa esos registros como fuente de verdad antes de responder." : "If any detail differs from the admin panel or Supabase, use those records as the source of truth before replying.",
    signatureLines: [label.bestRegards, label.team, label.advisors],
    footerNote: vm.locale === "es" ? "Generado por el formulario de cotización de AC Travel. Usa la referencia del lead y el ID de solicitud para el seguimiento interno." : "Generated by the AC Travel quote form. Use the lead reference and quote request ID for internal follow-up.",
    references: [`${label.leadReference}: ${vm.leadReference}`, `${label.quoteRequestId}: ${vm.quoteRequestId}`],
  });

  return {
    subject: vm.locale === "es" ? `Nueva cotización AC Travel · ${vm.destination}` : `New AC Travel quote · ${vm.destination}`,
    text: content.text,
    html: content.html,
    metadata: { locale: vm.locale, templateName: "admin_quote_request_received", leadReference: vm.leadReference, destination: vm.destination, audience: "admin" satisfies Audience },
  };
}

function renderClientQuoteEmail(vm: ViewModel) {
  const label = localeLabels(vm.locale);
  const content = renderShell({
    locale: vm.locale,
    previewText: vm.locale === "es" ? `Recibimos tu solicitud para ${vm.destination} y un asesor la revisará pronto.` : `We received your request for ${vm.destination} and an advisor will review it soon.`,
    eyebrow: label.requestReceived,
    title: vm.locale === "es" ? `${label.greeting} ${vm.name}, ya tenemos tu solicitud` : `${label.greeting} ${vm.name}, we have your request`,
    intro: vm.locale === "es" ? "Gracias por confiar en AC Travel. Nuestro equipo revisará tu viaje y te compartirá opciones y siguientes pasos por canales oficiales." : "Thank you for trusting AC Travel. Our team will review your trip and share options and next steps through our official channels.",
    sections: [
      { title: label.tripSummary, rows: [{ label: label.destination, value: vm.destination }, { label: label.dates, value: vm.dates }, { label: label.travelerBreakdown, value: vm.travelerBreakdown }, { label: label.service, value: vm.service }, { label: label.notes, value: vm.notes }] },
      { title: label.budgetAndContact, rows: [{ label: label.budget, value: vm.currencyBudget }, { label: label.origin, value: vm.origin }, { label: "Email", value: vm.email }, { label: "WhatsApp", value: vm.whatsapp }] },
      { title: label.whatHappensNext, rows: [{ label: brandName, value: vm.locale === "es" ? "Un asesor revisará tu solicitud, validará cualquier dato faltante y te contactará para preparar opciones de viaje." : "An advisor will review your request, confirm any missing details, and contact you to prepare travel options." }, { label: vm.locale === "es" ? "Importante" : "Important", value: vm.locale === "es" ? "Este correo automático no solicita pagos. El seguimiento será por canales oficiales de AC Travel." : "This automated email does not request payment. Follow-up will happen through official AC Travel channels." }] },
    ],
    primaryCta: { label: label.continueWhatsApp, href: vm.whatsappHref },
    secondaryNote: vm.locale === "es" ? "Si prefieres continuar por WhatsApp, usa el botón anterior para retomar tu solicitud con el contexto correcto." : "If you prefer to continue on WhatsApp, use the button above to resume your request with the right context.",
    signatureLines: [label.bestRegards, label.team, label.advisors],
    footerNote: vm.locale === "es" ? "Correo transaccional relacionado con tu solicitud de cotización en AC Travel." : "Transactional email related to your AC Travel quote request.",
    references: [`${label.leadReference}: ${vm.leadReference}`, `${label.quoteRequestId}: ${vm.quoteRequestId}`],
  });

  return {
    subject: vm.locale === "es" ? `Recibimos tu solicitud AC Travel · ${vm.destination}` : `We received your AC Travel request · ${vm.destination}`,
    text: content.text,
    html: content.html,
    metadata: { locale: vm.locale, templateName: "client_quote_request_confirmation", leadReference: vm.leadReference, destination: vm.destination, audience: "client" satisfies Audience },
  };
}

export function renderQuoteEmail(context: QuoteEmailContext) {
  const vm = model(context);
  return context.templateName === "admin_quote_request_received" ? renderAdminQuoteEmail(vm) : renderClientQuoteEmail(vm);
}
