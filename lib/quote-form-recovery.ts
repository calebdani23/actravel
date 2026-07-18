import type { FieldErrors, FieldNamesMarkedBoolean } from "react-hook-form";
import type { Locale } from "@/lib/i18n/config";
import type { QuoteRequestFormInput } from "@/lib/validations/quote-request";

type RecoveryKind = "draft" | "abandonment";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export const QUOTE_FORM_RECOVERY_TTL_MS = {
  draft: 1000 * 60 * 60 * 24 * 7,
  abandonment: 1000 * 60 * 60 * 24 * 3,
} as const;

type ContextDrivenField = "mainDestination" | "serviceInterest" | "sourceChannel" | "preferredCurrency" | "campaignContext";

export type QuoteFormRecoveryDraft = Partial<QuoteRequestFormInput> & {
  savedAt?: string;
};

export type QuoteFormAbandonmentSnapshot = {
  savedAt: string;
  dirtyFields: string[];
  frictionFields: string[];
  mainDestination?: string;
  serviceInterest?: string;
  sourceChannel?: string;
};

export function quoteFormStorageKey(locale: Locale, kind: RecoveryKind) {
  return `ac-travel:quote-form:${locale}:${kind}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isFreshRecovery(savedAt: unknown, ttlMs: number, now = Date.now()) {
  if (typeof savedAt !== "string") return false;
  const parsed = Date.parse(savedAt);
  return Number.isFinite(parsed) && now - parsed <= ttlMs;
}

export function safeStorageSetItem(storage: StorageLike, key: string, value: string) {
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function safeStorageRemoveItem(storage: StorageLike, key: string) {
  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function readStoredRecovery<T extends { savedAt?: string }>(storage: StorageLike, key: string, ttlMs: number, now = Date.now()): T | null {
  let raw: string | null = null;

  try {
    raw = storage.getItem(key);
  } catch {
    return null;
  }

  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed) || !isFreshRecovery(parsed.savedAt, ttlMs, now)) {
      safeStorageRemoveItem(storage, key);
      return null;
    }
    return parsed as T;
  } catch {
    safeStorageRemoveItem(storage, key);
    return null;
  }
}

function flattenDirtyFields(value: FieldNamesMarkedBoolean<QuoteRequestFormInput> | boolean | undefined, prefix = ""): string[] {
  if (!value) return [];
  if (value === true) return prefix ? [prefix] : [];
  if (typeof value !== "object") return [];

  return Object.entries(value).flatMap(([key, nested]) => {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    return flattenDirtyFields(nested as FieldNamesMarkedBoolean<QuoteRequestFormInput> | boolean | undefined, nextPrefix);
  });
}

export function frictionFieldNames(errors: FieldErrors<QuoteRequestFormInput>) {
  return Object.keys(errors).sort();
}

export function buildDraftSnapshot(values: QuoteRequestFormInput): QuoteFormRecoveryDraft {
  return { ...values, savedAt: new Date().toISOString() };
}

export function buildAbandonmentSnapshot(
  values: QuoteRequestFormInput,
  errors: FieldErrors<QuoteRequestFormInput>,
  dirtyFields: FieldNamesMarkedBoolean<QuoteRequestFormInput>,
): QuoteFormAbandonmentSnapshot {
  return {
    savedAt: new Date().toISOString(),
    dirtyFields: flattenDirtyFields(dirtyFields).sort(),
    frictionFields: frictionFieldNames(errors),
    mainDestination: values.mainDestination || undefined,
    serviceInterest: values.serviceInterest || undefined,
    sourceChannel: values.sourceChannel || undefined,
  };
}

export function mergeRecoveredDraft(
  defaults: QuoteRequestFormInput,
  draft?: QuoteFormRecoveryDraft | null,
  options?: { preferDefaultFields?: readonly ContextDrivenField[] },
): QuoteRequestFormInput {
  if (!draft) return defaults;

  const merged = {
    ...defaults,
    ...draft,
  };

  for (const field of ["holderName", "email", "whatsapp", "origin", "mainDestination", "departureDate", "returnDate", "serviceInterest", "sourceChannel", "notes", "campaignContext"] as const) {
    const value = merged[field];
    if (typeof value === "string") {
      const trimmed = value.trim();
      merged[field] = trimmed || defaults[field] || "";
    }
  }

  for (const field of options?.preferDefaultFields ?? []) {
    const defaultValue = defaults[field];
    if (typeof defaultValue === "string" && defaultValue.trim()) {
      if (field === "preferredCurrency") {
        merged.preferredCurrency = defaults.preferredCurrency;
      } else {
        merged[field] = defaultValue;
      }
    }
  }

  return {
    ...merged,
    locale: defaults.locale,
    preferredCurrency: merged.preferredCurrency === "USD" ? "USD" : "MXN",
    adults: typeof draft.adults === "number" && Number.isFinite(draft.adults) ? draft.adults : defaults.adults,
    children: typeof draft.children === "number" && Number.isFinite(draft.children) ? draft.children : defaults.children,
    approximateBudget: typeof draft.approximateBudget === "number" && Number.isFinite(draft.approximateBudget) ? draft.approximateBudget : defaults.approximateBudget,
    contactConsent: typeof draft.contactConsent === "boolean" ? draft.contactConsent : defaults.contactConsent,
    website: "",
  };
}
