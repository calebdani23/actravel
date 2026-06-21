"use client";

import { useEffect, useSyncExternalStore } from "react";
import { type Currency } from "@/lib/currency/config";
import {
  getClientCurrencyPreference,
  setClientCurrencyPreference,
  subscribeToCurrencyPreference,
  syncClientCurrencyPreference,
} from "@/lib/currency/preference-client";
import { cn } from "@/lib/utils/cn";

const currencies: Currency[] = ["MXN", "USD"];

export function CurrencySwitch({ label, initialCurrency }: Readonly<{ label: string; initialCurrency: Currency }>) {
  const currency = useSyncExternalStore(
    subscribeToCurrencyPreference,
    () => getClientCurrencyPreference(initialCurrency),
    () => initialCurrency,
  );

  useEffect(() => {
    syncClientCurrencyPreference(initialCurrency);
  }, [initialCurrency]);

  function chooseCurrency(nextCurrency: Currency) {
    setClientCurrencyPreference(nextCurrency);
  }

  return (
    <div className="flex items-center gap-1 rounded-full border border-white/70 bg-white/80 p-1 text-xs font-bold shadow-sm" aria-label={label}>
      {currencies.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => chooseCurrency(option)}
          className={cn(
            "rounded-full px-2.5 py-1 text-muted-foreground hover:text-[var(--ac-ink)]",
            option === currency && "bg-[var(--ac-orange)] text-white hover:text-white",
          )}
          aria-pressed={option === currency}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
