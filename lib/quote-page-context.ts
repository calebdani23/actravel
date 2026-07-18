import { type Currency } from "@/lib/currency/config";
import { quoteCurrencies } from "@/lib/validations/quote-request";

export type QuotePageSearchParams = Record<string, string | string[] | undefined>;

function firstParam(searchParams: QuotePageSearchParams, key: string) {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
}

function safeParam(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, 120) : undefined;
}

export function buildQuotePageInitialContext(searchParams: QuotePageSearchParams, fallbackCurrency: Currency) {
  const currency = safeParam(firstParam(searchParams, "currency"))?.toUpperCase();

  return {
    mainDestination: safeParam(firstParam(searchParams, "destination")),
    serviceInterest: safeParam(firstParam(searchParams, "service")),
    sourceChannel: undefined,
    campaignContext: safeParam(firstParam(searchParams, "campaign") ?? firstParam(searchParams, "utm_campaign")),
    preferredCurrency: quoteCurrencies.includes(currency as (typeof quoteCurrencies)[number]) ? currency as (typeof quoteCurrencies)[number] : fallbackCurrency,
  };
}
