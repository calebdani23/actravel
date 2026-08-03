import { z } from "zod";

export const quoteCurrencyValues = ["MXN", "USD"] as const;
export const quoteStatusValues = ["draft", "ready", "sent", "accepted", "rejected", "expired", "cancelled"] as const;
export const quoteDeleteConfirmation = "ELIMINAR COTIZACION";
export const quoteRestoreConfirmation = "RESTAURAR COTIZACION";
export const quotePdfMaxSizeBytes = 20 * 1024 * 1024;

const idempotencyKey = z.string().trim().min(1).max(120).regex(/^[A-Za-z0-9_-]+$/);
const lockVersion = z.coerce.number().int().min(0);
const optionalUuid = z.preprocess(
  (value) => typeof value === "string" ? value.trim() || undefined : value,
  z.string().uuid().optional(),
);
const optionalText = (max: number) => z.preprocess(
  (value) => typeof value === "string" ? value.trim() || undefined : value,
  z.string().max(max).optional(),
);
const optionalMoney = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const normalized = value.trim();
  if (!normalized) return undefined;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : Number.NaN;
}, z.number().min(0).optional());

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

const optionalDate = z.preprocess(
  (value) => typeof value === "string" ? value.trim() || undefined : value,
  z.string().refine(isIsoDate, "Use a valid ISO date.").optional(),
);

const commercialFields = {
  title: z.string().trim().min(1).max(120),
  summary: optionalText(400),
  currency: z.enum(quoteCurrencyValues),
  totalAmount: optionalMoney,
  depositAmount: optionalMoney,
  validUntil: optionalDate,
  notes: optionalText(2000),
};

function validateAmounts(
  value: { totalAmount?: number; depositAmount?: number },
  context: z.RefinementCtx,
) {
  if (value.totalAmount !== undefined && value.depositAmount !== undefined && value.depositAmount > value.totalAmount) {
    context.addIssue({
      code: "custom",
      message: "The deposit cannot exceed the total.",
      path: ["depositAmount"],
    });
  }
}

export const beginQuoteRegistrationSchema = z.object({
  opportunityId: z.string().uuid(),
  ...commercialFields,
  originatingRequestId: optionalUuid,
  expectedSizeBytes: z.coerce.number().int().min(1).max(quotePdfMaxSizeBytes),
  advisorySha256: z.string().regex(/^[0-9a-f]{64}$/),
  idempotencyKey,
}).superRefine(validateAmounts);

export const addQuoteVersionSchema = z.object({
  quoteId: z.string().uuid(),
  expectedLockVersion: lockVersion,
  cloneVersionId: optionalUuid,
  title: commercialFields.title.optional(),
  summary: commercialFields.summary,
  currency: commercialFields.currency.optional(),
  totalAmount: commercialFields.totalAmount,
  depositAmount: commercialFields.depositAmount,
  validUntil: commercialFields.validUntil,
  notes: commercialFields.notes,
  quoteRequestId: optionalUuid,
  idempotencyKey,
}).superRefine((value, context) => {
  validateAmounts(value, context);
  const explicitValues = [
    value.title,
    value.summary,
    value.currency,
    value.totalAmount,
    value.depositAmount,
    value.validUntil,
    value.notes,
    value.quoteRequestId,
  ];
  if (value.cloneVersionId && explicitValues.some((item) => item !== undefined)) {
    context.addIssue({ code: "custom", message: "Clone mode cannot include explicit commercial content.", path: ["cloneVersionId"] });
  }
  if (!value.cloneVersionId && (!value.title || !value.currency)) {
    context.addIssue({ code: "custom", message: "Explicit mode requires title and currency.", path: ["title"] });
  }
});

export const beginQuotePdfUploadSchema = z.object({
  quoteId: z.string().uuid(),
  quoteVersionId: z.string().uuid(),
  expectedSizeBytes: z.coerce.number().int().min(1).max(quotePdfMaxSizeBytes),
  idempotencyKey,
});

export const failQuotePdfIntentSchema = z.object({
  intentId: z.string().uuid(),
  reason: z.enum(["invalid_bytes", "upload_rejected"]),
});

export const quotePdfIntentIdSchema = z.string().uuid();

export const quoteWorkflowSchema = z.object({
  quoteId: z.string().uuid(),
  quoteVersionId: z.string().uuid(),
  expectedLockVersion: lockVersion,
  idempotencyKey,
});

export const acceptQuoteSchema = quoteWorkflowSchema.extend({
  expectedAcceptedQuoteId: optionalUuid,
  supersedeReason: optionalText(500),
}).superRefine((value, context) => {
  if (Boolean(value.expectedAcceptedQuoteId) !== Boolean(value.supersedeReason)) {
    context.addIssue({
      code: "custom",
      message: "Accepted quote ID and supersede reason must be provided together.",
      path: value.expectedAcceptedQuoteId ? ["supersedeReason"] : ["expectedAcceptedQuoteId"],
    });
  }
});

export const softDeleteQuoteSchema = z.object({
  quoteId: z.string().uuid(),
  expectedLockVersion: lockVersion,
  confirmation: z.literal(quoteDeleteConfirmation),
  reason: z.string().trim().min(1).max(500),
  idempotencyKey,
});

export const restoreQuoteSchema = z.object({
  quoteId: z.string().uuid(),
  expectedLockVersion: lockVersion,
  confirmation: z.literal(quoteRestoreConfirmation),
  idempotencyKey,
});

export const quoteCreateSelectionSchema = z.object({
  contactId: z.string().uuid(),
  opportunityId: z.string().uuid(),
  originatingRequestId: optionalUuid,
});

export type BeginQuoteRegistrationInput = z.infer<typeof beginQuoteRegistrationSchema>;
export type AddQuoteVersionInput = z.infer<typeof addQuoteVersionSchema>;
export type QuoteWorkflowInput = z.infer<typeof quoteWorkflowSchema>;
export type AcceptQuoteInput = z.infer<typeof acceptQuoteSchema>;

export function createQuoteIdempotencyKey(scope: string) {
  const normalizedScope = scope.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 32) || "mutation";
  if (typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.randomUUID === "function") {
    return `${normalizedScope}_${globalThis.crypto.randomUUID().replace(/-/g, "")}`;
  }
  return `${normalizedScope}_${Date.now().toString(16)}_${Math.random().toString(16).slice(2, 10)}`;
}

export const quoteValidationInternals = {
  isIsoDate,
  validateAmounts,
};
