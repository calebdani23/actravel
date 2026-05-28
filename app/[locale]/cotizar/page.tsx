import { QuotePage } from "@/components/public/public-pages";
import { type Locale } from "@/lib/i18n/config";
import { assertRouteLocale } from "@/lib/i18n/route-guards";
import { buildQuoteMetadata } from "@/lib/seo/public-seo";
import { quoteCurrencies } from "@/lib/validations/quote-request";

type SearchParams = Record<string, string | string[] | undefined>;

function firstParam(searchParams: SearchParams, key: string) {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
}

function safeParam(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, 120) : undefined;
}

function initialContext(searchParams: SearchParams) {
  const currency = safeParam(firstParam(searchParams, "currency"))?.toUpperCase();
  return {
    mainDestination: safeParam(firstParam(searchParams, "destination")),
    serviceInterest: safeParam(firstParam(searchParams, "service")),
    sourceChannel: safeParam(firstParam(searchParams, "source") ?? firstParam(searchParams, "utm_source") ?? firstParam(searchParams, "campaign") ?? firstParam(searchParams, "utm_campaign")),
    campaignContext: safeParam(firstParam(searchParams, "campaign") ?? firstParam(searchParams, "utm_campaign")),
    preferredCurrency: quoteCurrencies.includes(currency as (typeof quoteCurrencies)[number]) ? currency as (typeof quoteCurrencies)[number] : undefined,
  };
}

export default async function Page({ params, searchParams }: { params: Promise<{ locale: Locale }>; searchParams: Promise<SearchParams> }) { const { locale } = await params; assertRouteLocale(locale, "es"); return <QuotePage locale={locale} initialContext={initialContext(await searchParams)} />; }
export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }) { const { locale } = await params; return buildQuoteMetadata(locale); }
