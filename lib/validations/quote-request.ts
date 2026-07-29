import { z } from "zod";
import { type Locale } from "@/lib/i18n/config";
import { normalizeEmailIdentity, normalizeWhatsAppIdentity } from "@/lib/leads/contact-normalization";

export const quoteLocales = ["es", "en"] as const;
export const quoteCurrencies = ["MXN", "USD"] as const;
const metaEventIdPattern = /^[a-zA-Z0-9_-]{8,120}$/;

export type QuoteLocale = (typeof quoteLocales)[number];
export type QuoteCurrency = (typeof quoteCurrencies)[number];

export const quoteValidationCopy = {
  es: {
    required: "Este campo es obligatorio.",
    email: "Ingresa un correo válido.",
    whatsapp: "Ingresa un WhatsApp válido con al menos 10 dígitos.",
    adults: "Debe viajar al menos 1 adulto.",
    children: "El número de menores no puede ser negativo.",
    budget: "Ingresa un presupuesto válido.",
    date: "Ingresa una fecha válida.",
    returnDate: "La fecha de regreso debe ser posterior o igual a la salida.",
    consent: "Debes aceptar que te contactemos para atender tu solicitud.",
    invalid: "Revisa los campos marcados.",
    rateLimited: "Recibimos varias solicitudes seguidas. Intenta de nuevo en unos minutos o escríbenos por WhatsApp.",
    server: "No pudimos guardar tu solicitud. Intenta de nuevo o escríbenos por WhatsApp.",
  },
  en: {
    required: "This field is required.",
    email: "Enter a valid email address.",
    whatsapp: "Enter a valid WhatsApp number with at least 10 digits.",
    adults: "At least 1 adult must travel.",
    children: "Children cannot be negative.",
    budget: "Enter a valid budget.",
    date: "Enter a valid date.",
    returnDate: "Return date must be on or after departure date.",
    consent: "You must accept that we contact you about this request.",
    invalid: "Please review the highlighted fields.",
    rateLimited: "We received several requests in a row. Please try again in a few minutes or message us on WhatsApp.",
    server: "We could not save your request. Please try again or message us on WhatsApp.",
  },
} as const;

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const suspiciousControlCharacters = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const requiredString = (message: string) => z.string().trim().min(1, message).max(180);
const optionalTrimmedString = () => z.string().trim().optional().transform((value) => (value === "" ? undefined : value));

function hasSuspiciousControlCharacters(value?: string | null) {
  return Boolean(value && suspiciousControlCharacters.test(value));
}

function isValidDateString(value: string) {
  if (!datePattern.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export function normalizeWhatsApp(value: string) {
  return normalizeWhatsAppIdentity(value);
}

export function normalizeEmail(value?: string | null) {
  return normalizeEmailIdentity(value);
}

export function createQuoteRequestSchema(locale: Locale = "es") {
  const copy = quoteValidationCopy[locale];

  return z.object({
    locale: z.enum(quoteLocales),
    preferredCurrency: z.enum(quoteCurrencies),
    holderName: requiredString(copy.required),
    email: requiredString(copy.required).email(copy.email),
    whatsapp: requiredString(copy.required).refine((value) => normalizeWhatsApp(value).length >= 10, copy.whatsapp),
    origin: requiredString(copy.required),
    mainDestination: requiredString(copy.required),
    departureDate: requiredString(copy.required).refine(isValidDateString, copy.date),
    returnDate: requiredString(copy.required).refine(isValidDateString, copy.date),
    adults: z.number({ error: copy.required }).int().min(1, copy.adults).max(99),
    children: z.number({ error: copy.required }).int().min(0, copy.children).max(99),
    serviceInterest: requiredString(copy.required),
    approximateBudget: z.number({ error: copy.required }).min(0, copy.budget).max(999999999),
    sourceChannel: requiredString(copy.required),
    contactConsent: z.boolean().refine((value) => value === true, copy.consent),
    notes: z.string().trim().max(2000).optional(),
    campaignContext: z.string().trim().max(180).optional(),
    attributionSnapshot: z.string().trim().max(4000).optional(),
    metaLeadEventId: optionalTrimmedString().refine((value) => value === undefined || metaEventIdPattern.test(value), copy.invalid),
    website: z.string().trim().max(0, copy.invalid).optional(),
  }).superRefine((value, ctx) => {
    if (isValidDateString(value.departureDate) && isValidDateString(value.returnDate) && value.returnDate < value.departureDate) {
      ctx.addIssue({ code: "custom", path: ["returnDate"], message: copy.returnDate });
    }
    if (value.adults + value.children > 30) {
      ctx.addIssue({ code: "custom", path: ["adults"], message: copy.invalid });
    }
    for (const field of ["holderName", "email", "whatsapp", "origin", "mainDestination", "serviceInterest", "sourceChannel", "notes", "campaignContext", "attributionSnapshot", "metaLeadEventId"] as const) {
      if (hasSuspiciousControlCharacters(value[field])) {
        ctx.addIssue({ code: "custom", path: [field], message: copy.invalid });
      }
    }
  });
}

export const quoteRequestSchema = createQuoteRequestSchema("es");

export type QuoteRequestFormInput = z.input<ReturnType<typeof createQuoteRequestSchema>>;
export type QuoteRequestInput = z.output<ReturnType<typeof createQuoteRequestSchema>>;

export type QuoteRequestSuccessResponse = {
  ok: true;
  leadReference: string;
  message: string;
  whatsapp: { phone: "529988453455"; text: string; href: string };
};

export type QuoteRequestErrorResponse = {
  ok: false;
  message: string;
  fieldErrors?: Partial<Record<keyof QuoteRequestInput, string[]>>;
};

export type QuoteRequestResponse = QuoteRequestSuccessResponse | QuoteRequestErrorResponse;

export const quoteRequestBaseSchema = z.object({
  locale: z.enum(quoteLocales),
  currency: z.enum(quoteCurrencies),
});

export type QuoteRequestBaseInput = z.infer<typeof quoteRequestBaseSchema>;
