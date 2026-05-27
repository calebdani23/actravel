import { DetailPage } from "@/components/public/public-pages";
import { getPublicSiteContent } from "@/lib/content/public-site";
import { type Locale } from "@/lib/i18n/config";
import { assertRouteLocale } from "@/lib/i18n/route-guards";
export function generateStaticParams() { return getPublicSiteContent("en").destinations.map((item) => ({ locale: "en", slug: item.slug.en })); }
export default async function Page({ params }: { params: Promise<{ locale: Locale; slug: string }> }) { const { locale, slug } = await params; assertRouteLocale(locale, "en"); return <DetailPage locale={locale} slug={slug} kind="destination" />; }
