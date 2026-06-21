import { QuotePage } from "@/components/public/public-pages";
import { getServerCurrencyPreference } from "@/lib/currency/preference-server";
import { type Locale } from "@/lib/i18n/config";
import { assertRouteLocale } from "@/lib/i18n/route-guards";
import { buildQuotePageInitialContext, type QuotePageSearchParams } from "@/lib/quote-page-context";
import { buildQuoteMetadata } from "@/lib/seo/public-seo";

export default async function Page({ params, searchParams }: { params: Promise<{ locale: Locale }>; searchParams: Promise<QuotePageSearchParams> }) { const { locale } = await params; assertRouteLocale(locale, "en"); const currency = await getServerCurrencyPreference(); return <QuotePage locale={locale} initialContext={buildQuotePageInitialContext(await searchParams, currency)} />; }
export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }) { const { locale } = await params; return buildQuoteMetadata(locale); }
