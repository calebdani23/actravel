import { type Currency } from "@/lib/currency/config";

export function shouldSyncQuoteFormCurrency({
  currentCurrency,
  nextCurrency,
  lastSyncedCurrency,
  isDirty,
}: {
  currentCurrency: Currency;
  nextCurrency: Currency;
  lastSyncedCurrency: Currency;
  isDirty: boolean;
}) {
  if (currentCurrency === nextCurrency) return false;
  if (!isDirty) return true;
  return currentCurrency === lastSyncedCurrency;
}
