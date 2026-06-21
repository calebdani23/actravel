"use client";

import { type Currency } from "@/lib/currency/config";
import {
  buildCurrencyCookieValue,
  CURRENCY_PREFERENCE_EVENT,
  CURRENCY_STORAGE_KEY,
  normalizeCurrencyPreference,
  parseCurrencyCookie,
} from "@/lib/currency/preference";

export function getClientCurrencyPreference(fallback: Currency): Currency {
  if (typeof window === "undefined") return fallback;

  const stored = window.localStorage.getItem(CURRENCY_STORAGE_KEY);
  if (stored) return normalizeCurrencyPreference(stored);

  const cookieCurrency = parseCurrencyCookie(document.cookie);
  return cookieCurrency ?? fallback;
}

export function setClientCurrencyPreference(currency: Currency) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(CURRENCY_STORAGE_KEY, currency);
  document.cookie = buildCurrencyCookieValue(currency);
  window.dispatchEvent(new Event(CURRENCY_PREFERENCE_EVENT));
}

export function syncClientCurrencyPreference(fallback: Currency) {
  if (typeof window === "undefined") return;

  const stored = window.localStorage.getItem(CURRENCY_STORAGE_KEY);
  const cookieCurrency = parseCurrencyCookie(document.cookie);

  if (stored && !cookieCurrency) {
    document.cookie = buildCurrencyCookieValue(normalizeCurrencyPreference(stored));
    return;
  }

  if (!stored && cookieCurrency) {
    window.localStorage.setItem(CURRENCY_STORAGE_KEY, cookieCurrency);
    return;
  }

  if (!stored && !cookieCurrency) {
    window.localStorage.setItem(CURRENCY_STORAGE_KEY, fallback);
    document.cookie = buildCurrencyCookieValue(fallback);
  }
}

export function subscribeToCurrencyPreference(callback: () => void) {
  if (typeof window === "undefined") return () => undefined;

  window.addEventListener("storage", callback);
  window.addEventListener(CURRENCY_PREFERENCE_EVENT, callback);

  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CURRENCY_PREFERENCE_EVENT, callback);
  };
}
