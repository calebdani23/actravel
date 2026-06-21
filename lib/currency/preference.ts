import { currencies, type Currency } from "@/lib/currency/config";
import { type Locale } from "@/lib/i18n/config";

export const CURRENCY_COOKIE_NAME = "ac-travel-currency";
export const CURRENCY_STORAGE_KEY = "ac-travel-currency";
export const CURRENCY_PREFERENCE_EVENT = "ac-travel-currency-change";
export const DEFAULT_CURRENCY: Currency = "MXN";
export const CURRENCY_PREFERENCE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function isCurrency(value: string | null | undefined): value is Currency {
  return currencies.includes(value as Currency);
}

export function normalizeCurrencyPreference(value: string | null | undefined): Currency {
  return isCurrency(value) ? value : DEFAULT_CURRENCY;
}

export function parseCurrencyCookie(cookieHeader: string | null | undefined) {
  if (!cookieHeader) return undefined;

  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rawValueParts] = part.trim().split("=");
    if (rawName === CURRENCY_COOKIE_NAME) {
      return normalizeCurrencyPreference(rawValueParts.join("="));
    }
  }

  return undefined;
}

export function buildCurrencyCookieValue(currency: Currency) {
  return `${CURRENCY_COOKIE_NAME}=${currency}; Path=/; Max-Age=${CURRENCY_PREFERENCE_MAX_AGE_SECONDS}; SameSite=Lax`;
}

export function formatCurrencyAmount(locale: Locale, currency: Currency, amount: number) {
  return new Intl.NumberFormat(currency === "USD" ? "en-US" : locale === "en" ? "en-US" : "es-MX", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}
