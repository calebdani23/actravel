import { z } from "zod";
import { formatAdminCurrency } from "@/lib/admin/format";

export const quoteVersionCurrencyValues = ["MXN", "USD"] as const;
export const quoteVersionStatusValues = ["draft", "sent", "accepted", "rejected", "expired"] as const;

export type QuoteVersionCurrency = (typeof quoteVersionCurrencyValues)[number];
export type QuoteVersionStatus = (typeof quoteVersionStatusValues)[number];

const activeQuoteVersionStatuses = ["draft", "sent"] as const;

function optionalText(maxLength: number) {
  return z.preprocess(
    (value) => typeof value === "string" ? value.trim() || undefined : value,
    z.string().max(maxLength).optional(),
  );
}

const optionalMoney = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}, z.number().min(0, "Usa un monto igual o mayor a 0.").optional());

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

const optionalDate = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed || undefined;
}, z.string().refine(isIsoDate, "Usa una fecha válida.").optional());

const optionalIdempotencyKey = z.preprocess(
  (value) => typeof value === "string" ? value.trim() || undefined : value,
  z.string().max(120, "La solicitud ya no es válida. Vuelve a abrir el formulario.").regex(/^[a-zA-Z0-9_-]+$/, "La solicitud ya no es válida. Vuelve a abrir el formulario.").optional(),
);

export const createQuoteVersionSchema = z.object({
  leadId: z.string().uuid("No se encontró la oportunidad."),
  title: z.string().trim().min(1, "Agrega un título para la cotización.").max(120, "Usa un título más corto."),
  summary: optionalText(400),
  currency: z.string()
    .refine((value): value is QuoteVersionCurrency => quoteVersionCurrencyValues.includes(value as QuoteVersionCurrency), "Selecciona una moneda válida.")
    .transform((value) => value as QuoteVersionCurrency),
  totalAmount: optionalMoney,
  depositAmount: optionalMoney,
  validUntil: optionalDate,
  notes: optionalText(2000),
  idempotencyKey: optionalIdempotencyKey,
  quoteRequestId: z.preprocess(
    (value) => typeof value === "string" ? value.trim() || undefined : value,
    z.string().uuid("Selecciona una solicitud válida.").optional(),
  ),
}).superRefine((value, context) => {
  if (value.totalAmount !== undefined && value.depositAmount !== undefined && value.depositAmount > value.totalAmount) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "El anticipo no puede ser mayor al total.",
      path: ["depositAmount"],
    });
  }
});

export type CreateQuoteVersionInput = z.infer<typeof createQuoteVersionSchema>;

export function createQuoteVersionSubmissionKey() {
  if (typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.randomUUID === "function") {
    return `quote_version_${globalThis.crypto.randomUUID().replace(/-/g, "")}`;
  }

  return `quote_version_${Date.now().toString(16)}_${Math.random().toString(16).slice(2, 10)}`;
}

export function quoteVersionStatusLabel(status?: string | null) {
  const labels: Record<QuoteVersionStatus, string> = {
    draft: "Borrador",
    sent: "Enviada",
    accepted: "Aceptada",
    rejected: "Rechazada",
    expired: "Expirada",
  };
  if (!status) return "Sin estado";
  return labels[status as QuoteVersionStatus] ?? "Estado no identificado";
}

export function quoteVersionStatusTone(status?: string | null) {
  if (status === "accepted") return "success" as const;
  if (status === "sent") return "brand" as const;
  if (status === "draft") return "info" as const;
  if (status === "rejected" || status === "expired") return "neutral" as const;
  return "neutral" as const;
}

export function isQuoteVersionTerminal(status: QuoteVersionStatus) {
  return !activeQuoteVersionStatuses.includes(status as (typeof activeQuoteVersionStatuses)[number]);
}

export function canMarkQuoteVersionSent(status: QuoteVersionStatus) {
  return status === "draft";
}

export function canAcceptQuoteVersion(status: QuoteVersionStatus) {
  return status === "draft" || status === "sent" || status === "accepted";
}

export function canRejectQuoteVersion(status: QuoteVersionStatus) {
  return status === "draft" || status === "sent";
}

export function canExpireQuoteVersion(status: QuoteVersionStatus) {
  return status === "draft" || status === "sent";
}

export function isActiveQuoteVersionStatus(status: QuoteVersionStatus) {
  return activeQuoteVersionStatuses.includes(status as (typeof activeQuoteVersionStatuses)[number]);
}

export function isValidQuoteVersionTransition(current: QuoteVersionStatus, next: QuoteVersionStatus) {
  if (current === next) return true;
  if (current === "draft") return ["sent", "accepted", "rejected", "expired"].includes(next);
  if (current === "sent") return ["accepted", "rejected", "expired"].includes(next);
  return false;
}

export function quoteVersionActionErrorMessage(action: "create" | "send" | "accept" | "reject" | "expire") {
  return {
    create: "No se pudo guardar la cotización. Revisa la información e inténtalo nuevamente.",
    send: "No se pudo marcar la cotización como enviada. Intenta nuevamente.",
    accept: "No se pudo aceptar la cotización. Intenta nuevamente.",
    reject: "No se pudo rechazar la cotización. Intenta nuevamente.",
    expire: "No se pudo marcar la cotización como expirada. Intenta nuevamente.",
  }[action];
}

export function quoteVersionValidationMessage(next: QuoteVersionStatus) {
  return {
    sent: "Solo los borradores pueden marcarse como enviados.",
    accepted: "Solo puedes aceptar cotizaciones activas.",
    rejected: "Solo puedes rechazar cotizaciones activas.",
    expired: "Solo puedes expirar cotizaciones activas.",
    draft: "Transición no permitida.",
  }[next];
}

export function quoteVersionConcurrencyMessage() {
  return "La cotización cambió en otra sesión. Actualiza la página y vuelve a intentarlo.";
}

export function formatQuoteVersionAmount(amount?: number | null, currency?: string | null) {
  if (amount === null || amount === undefined || !currency) return "—";
  return formatAdminCurrency(amount, currency);
}

export function quoteVersionBalance(totalAmount?: number | null, depositAmount?: number | null) {
  if (totalAmount === null || totalAmount === undefined) return null;
  if (depositAmount === null || depositAmount === undefined) return totalAmount;
  return Math.max(totalAmount - depositAmount, 0);
}

export function quoteVersionRequestLabel(input: { title?: string | null; channelLabel?: string | null; createdAt?: string | null; statusLabel?: string | null }) {
  return input.title?.trim()
    || [input.channelLabel, input.createdAt, input.statusLabel].filter(Boolean).join(" · ")
    || "Solicitud del cliente";
}

export const quoteVersionInternals = {
  createQuoteVersionSchema,
  createQuoteVersionSubmissionKey,
  isValidQuoteVersionTransition,
  isActiveQuoteVersionStatus,
  quoteVersionBalance,
  quoteVersionStatusLabel,
  quoteVersionStatusTone,
  formatQuoteVersionAmount,
  canMarkQuoteVersionSent,
  canAcceptQuoteVersion,
  canRejectQuoteVersion,
  canExpireQuoteVersion,
  quoteVersionRequestLabel,
  quoteVersionConcurrencyMessage,
};
