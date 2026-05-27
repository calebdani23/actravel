import { ListingPage } from "@/components/public/public-pages";
import { type Locale } from "@/lib/i18n/config";
import { assertRouteLocale } from "@/lib/i18n/route-guards";
export default async function Page({ params }: { params: Promise<{ locale: Locale }> }) { const { locale } = await params; assertRouteLocale(locale, "en"); return <ListingPage locale={locale} kind="services" />; }
