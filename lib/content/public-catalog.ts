import "server-only";

import { createClient } from "@/lib/supabase/server";
import { buildPublicCatalogContent, getPublicSiteContent, type CatalogRowLike } from "@/lib/content/public-site";
import type { Locale } from "@/lib/i18n/config";

export async function getPublicCatalogContent(locale: Locale) {
  const staticContent = getPublicSiteContent(locale);

  try {
    const supabase = await createClient();
    const [destinationsResult, servicesResult, promotionsResult] = await Promise.all([
      supabase.from("destinations").select("id, slug_es, slug_en, name_es, name_en, summary_es, summary_en, description_es, description_en, hero_image_url, thumbnail_image_url, is_featured, status, published_at").eq("status", "published").order("updated_at", { ascending: false }).limit(100),
      supabase.from("services").select("id, slug_es, slug_en, name_es, name_en, summary_es, summary_en, description_es, description_en, hero_image_url, thumbnail_image_url, price_from_mxn, price_from_usd, sort_order, is_featured, status, published_at").eq("status", "published").order("sort_order").limit(100),
      supabase.from("promotions").select("id, slug_es, slug_en, title_es, title_en, summary_es, summary_en, details_es, details_en, hero_image_url, thumbnail_image_url, price_from_mxn, price_from_usd, is_featured, status, published_at").eq("status", "published").order("updated_at", { ascending: false }).limit(100),
    ]);

    if (destinationsResult.error || servicesResult.error || promotionsResult.error) return staticContent;

    return buildPublicCatalogContent(locale, {
      destinations: (destinationsResult.data ?? []) as CatalogRowLike[],
      services: (servicesResult.data ?? []) as CatalogRowLike[],
      promotions: (promotionsResult.data ?? []) as CatalogRowLike[],
    });
  } catch {
    return staticContent;
  }
}

export async function getPublicCatalogItem(locale: Locale, kind: "destinations" | "promotions", slug: string) {
  const catalog = await getPublicCatalogContent(locale).catch(() => null);
  const item = (kind === "promotions" ? catalog?.promotions : catalog?.destinations)?.find((entry) => entry.slug[locale] === slug);
  return item ?? null;
}
