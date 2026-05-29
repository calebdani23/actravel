import { DetailPage } from "@/components/public/public-pages";
import { getPublicCatalogStaticParams } from "@/lib/content/public-catalog";
import { type Locale } from "@/lib/i18n/config";
import { assertRouteLocale } from "@/lib/i18n/route-guards";
import { buildDetailMetadata } from "@/lib/seo/public-seo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateStaticParams() { return getPublicCatalogStaticParams("es", "destinations"); }
export async function generateMetadata({ params }: { params: Promise<{ locale: Locale; slug: string }> }) { const { locale, slug } = await params; return await buildDetailMetadata(locale, "destination", slug); }
export default async function Page({ params }: { params: Promise<{ locale: Locale; slug: string }> }) { const { locale, slug } = await params; assertRouteLocale(locale, "es"); return await DetailPage({ locale, slug, kind: "destination" }); }
