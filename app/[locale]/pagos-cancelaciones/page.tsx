import { LegalPage } from "@/components/public/public-pages";
import { type Locale } from "@/lib/i18n/config";
import { assertRouteLocale } from "@/lib/i18n/route-guards";
import { buildLegalMetadata } from "@/lib/seo/public-seo";
export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }) { const { locale } = await params; return buildLegalMetadata(locale, "payments"); }
export default async function Page({ params }: { params: Promise<{ locale: Locale }> }) { const { locale } = await params; assertRouteLocale(locale, "es"); return <LegalPage locale={locale} legalKey="payments" />; }
