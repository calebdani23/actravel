import { InfoPage } from "@/components/public/public-pages";
import { type Locale } from "@/lib/i18n/config";
import { assertRouteLocale } from "@/lib/i18n/route-guards";
import { buildInfoMetadata } from "@/lib/seo/public-seo";
export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }) { const { locale } = await params; return buildInfoMetadata(locale, "contact"); }
export default async function Page({ params }: { params: Promise<{ locale: Locale }> }) { const { locale } = await params; assertRouteLocale(locale, "en"); return <InfoPage locale={locale} kind="contact" />; }
