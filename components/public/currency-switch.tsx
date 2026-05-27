"use client";

import { useSyncExternalStore } from "react";
import { type Currency } from "@/lib/i18n/config";
import { cn } from "@/lib/utils/cn";

const STORAGE_KEY = "ac-travel-currency";
const currencies: Currency[] = ["MXN", "USD"];

export function CurrencySwitch({ label }: Readonly<{ label: string }>) {
  const currency = useSyncExternalStore(subscribeToCurrency, getCurrencySnapshot, getServerCurrencySnapshot);

  function chooseCurrency(nextCurrency: Currency) {
    window.localStorage.setItem(STORAGE_KEY, nextCurrency);
    window.dispatchEvent(new Event("ac-travel-currency-change"));
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

function getCurrencySnapshot(): Currency {
  const saved = window.localStorage.getItem(STORAGE_KEY);
  return saved === "USD" ? "USD" : "MXN";
}

function getServerCurrencySnapshot(): Currency {
  return "MXN";
}

function subscribeToCurrency(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("ac-travel-currency-change", callback);

  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("ac-travel-currency-change", callback);
  };
}
