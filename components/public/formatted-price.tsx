"use client";

import { useEffect, useSyncExternalStore } from "react";
import { type Currency } from "@/lib/currency/config";
import { type PriceDisplay, priceLabel } from "@/lib/content/public-site";
import { type Locale } from "@/lib/i18n/config";
import {
  getClientCurrencyPreference,
  subscribeToCurrencyPreference,
  syncClientCurrencyPreference,
} from "@/lib/currency/preference-client";

export function FormattedPrice({ locale, price, initialCurrency, className }: Readonly<{ locale: Locale; price: PriceDisplay; initialCurrency: Currency; className?: string }>) {
  const currency = useSyncExternalStore(
    subscribeToCurrencyPreference,
    () => getClientCurrencyPreference(initialCurrency),
    () => initialCurrency,
  );

  useEffect(() => {
    syncClientCurrencyPreference(initialCurrency);
  }, [initialCurrency]);

  return <span className={className}>{priceLabel(locale, price, currency)}</span>;
}
