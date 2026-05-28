import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getPublicSiteContent, buildPublicCatalogItem, publishedCatalogRows, type CatalogRowLike } from "@/lib/content/public-site";
import type { Locale } from "@/lib/i18n/config";

export async function getPublicCatalogContent(locale: Locale) {
  const supabase = await createClient();

  const [destinationsResult, servicesResult, promotionsResult] = await Promise.all([
    supabase.from("destinations").select("id, slug_es, slug_en, name_es, name_en, summary_es, summary_en, description_es, description_en, hero_image_url, thumbnail_image_url, is_featured, status, published_at").order("updated_at", { ascending: false }).limit(100),
    supabase.from("services").select("id, slug_es, slug_en, name_es, name_en, summary_es, summary_en, description_es, description_en, hero_image_url, thumbnail_image_url, price_from_mxn, price_from_usd, sort_order, is_featured, status, published_at").order("sort_order").limit(100),
    supabase.from("promotions").select("id, slug_es, slug_en, title_es, title_en, summary_es, summary_en, details_es, details_en, hero_image_url, thumbnail_image_url, price_from_mxn, price_from_usd, is_featured, status, published_at").order("updated_at", { ascending: false }).limit(100),
  ]);

  const destinations = publishedCatalogRows((destinationsResult.data ?? []) as CatalogRowLike[]).map((row) => buildPublicCatalogItem(row, "destinations"));
  const services = publishedCatalogRows((servicesResult.data ?? []) as CatalogRowLike[]).map((row) => buildPublicCatalogItem(row, "services"));
  const promotions = publishedCatalogRows((promotionsResult.data ?? []) as CatalogRowLike[]).map((row) => buildPublicCatalogItem(row, "promotions"));

  return {
    locale,
    routes: getPublicSiteContent(locale).routes,
    t: getPublicSiteContent(locale).t,
    services: services.length ? services : getPublicSiteContent(locale).services,
    packages: getPublicSiteContent(locale).packages,
    destinations: destinations.length ? destinations : getPublicSiteContent(locale).destinations,
    promotions: promotions.length ? promotions : getPublicSiteContent(locale).promotions,
  };
}
