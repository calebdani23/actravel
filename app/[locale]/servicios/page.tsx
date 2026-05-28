import { ListingPage } from "@/components/public/public-pages";
import { type Locale } from "@/lib/i18n/config";
import { assertRouteLocale } from "@/lib/i18n/route-guards";
import { buildListingMetadata } from "@/lib/seo/public-seo";
export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }) { const { locale } = await params; return buildListingMetadata(locale, "services"); }
export default async function Page({ params }: { params: Promise<{ locale: Locale }> }) { const { locale } = await params; assertRouteLocale(locale, "es"); return <ListingPage locale={locale} kind="services" />; }
