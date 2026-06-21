"use client";

import { type Currency } from "@/lib/currency/config";
import {
  buildCurrencyCookieValue,
  CURRENCY_PREFERENCE_EVENT,
  CURRENCY_STORAGE_KEY,
  parseCurrencyCookie,
  resolveCurrencyPreference,
} from "@/lib/currency/preference";
import { safeStorageSetItem } from "@/lib/quote-form-recovery";

function safeStorageGetItem(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function getClientCurrencyPreference(fallback: Currency): Currency {
  if (typeof window === "undefined") return fallback;

  return resolveCurrencyPreference(parseCurrencyCookie(document.cookie), safeStorageGetItem(CURRENCY_STORAGE_KEY), fallback).currency;
}

export function setClientCurrencyPreference(currency: Currency) {
  if (typeof window === "undefined") return;

  document.cookie = buildCurrencyCookieValue(currency);
  safeStorageSetItem(window.localStorage, CURRENCY_STORAGE_KEY, currency);
  window.dispatchEvent(new Event(CURRENCY_PREFERENCE_EVENT));
}

export function syncClientCurrencyPreference(fallback: Currency) {
  if (typeof window === "undefined") return;

  const resolution = resolveCurrencyPreference(parseCurrencyCookie(document.cookie), safeStorageGetItem(CURRENCY_STORAGE_KEY), fallback);

  if (parseCurrencyCookie(document.cookie) !== resolution.cookieCurrency) {
    document.cookie = buildCurrencyCookieValue(resolution.cookieCurrency);
  }

  if (safeStorageGetItem(CURRENCY_STORAGE_KEY) !== resolution.storageCurrency) {
    safeStorageSetItem(window.localStorage, CURRENCY_STORAGE_KEY, resolution.storageCurrency);
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
