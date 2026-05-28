import { DetailPage } from "@/components/public/public-pages";
import { getPublicSiteContent } from "@/lib/content/public-site";
import { type Locale } from "@/lib/i18n/config";
import { assertRouteLocale } from "@/lib/i18n/route-guards";
import { buildDetailMetadata } from "@/lib/seo/public-seo";
export function generateStaticParams() { return getPublicSiteContent("es").destinations.map((item) => ({ locale: "es", slug: item.slug.es })); }
export async function generateMetadata({ params }: { params: Promise<{ locale: Locale; slug: string }> }) { const { locale, slug } = await params; return buildDetailMetadata(locale, "destination", slug); }
export default async function Page({ params }: { params: Promise<{ locale: Locale; slug: string }> }) { const { locale, slug } = await params; assertRouteLocale(locale, "es"); return <DetailPage locale={locale} slug={slug} kind="destination" />; }
