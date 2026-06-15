import "server-only";

import { createPublicSupabaseClient } from "@/lib/supabase/public-server";
import { buildFallbackCatalogContent, buildPublicCatalogContent, type CatalogRowLike } from "@/lib/content/public-site";
import { buildPublicCatalogStaticParams } from "@/lib/content/public-catalog-utils";
import type { Locale } from "@/lib/i18n/config";

type CatalogQueryError = {
  message: string;
  code?: string | null;
  details?: string | null;
  hint?: string | null;
};

type CatalogQueryResult = {
  data: CatalogRowLike[] | null;
  error: CatalogQueryError | null;
};

type CatalogQueryResults = {
  destinations: CatalogQueryResult;
  services: CatalogQueryResult;
  packages: CatalogQueryResult;
  promotions: CatalogQueryResult;
};

export function buildLivePublicCatalogContent(locale: Locale, results: CatalogQueryResults) {
  const queryErrors = {
    destinations: results.destinations.error,
    services: results.services.error,
    packages: results.packages.error,
    promotions: results.promotions.error,
  };

  for (const [section, error] of Object.entries(queryErrors)) {
    if (error) {
      console.error(`[public-catalog] ${section} query failed`, {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
    }
  }

  if (Object.values(queryErrors).some(Boolean)) {
    return null;
  }

  return buildPublicCatalogContent(locale, {
    destinations: results.destinations.data ?? [],
    services: results.services.data ?? [],
    packages: results.packages.data ?? [],
    promotions: results.promotions.data ?? [],
  });
}

export async function getLivePublicCatalogContent(locale: Locale) {
  try {
    const supabase = createPublicSupabaseClient();

    const [destinationsResult, servicesResult, packagesResult, promotionsResult] = await Promise.all([
      supabase
        .from("destinations")
        .select("id, slug_es, slug_en, name_es, name_en, summary_es, summary_en, description_es, description_en, hero_image_url, thumbnail_image_url, is_featured, status, published_at")
        .eq("status", "published")
        .order("updated_at", { ascending: false })
        .limit(100),

      supabase
        .from("services")
        .select("id, slug_es, slug_en, name_es, name_en, summary_es, summary_en, description_es, description_en, hero_image_url, thumbnail_image_url, price_from_mxn, price_from_usd, sort_order, is_featured, status, published_at")
        .eq("status", "published")
        .order("sort_order", { ascending: true })
        .limit(100),

      supabase
        .from("packages")
        .select("id, slug_es, slug_en, name_es, name_en, summary_es, summary_en, description_es, description_en, hero_image_url, thumbnail_image_url, price_from_mxn, price_from_usd, sort_order, is_featured, status, published_at")
        .eq("status", "published")
        .order("sort_order", { ascending: true })
        .limit(100),

      supabase
        .from("promotions")
        .select("id, slug_es, slug_en, title_es, title_en, summary_es, summary_en, details_es, details_en, hero_image_url, thumbnail_image_url, price_from_mxn, price_from_usd, is_featured, status, published_at")
        .eq("status", "published")
        .order("updated_at", { ascending: false })
        .limit(100),
    ]);

    return buildLivePublicCatalogContent(locale, {
      destinations: { data: (destinationsResult.data ?? []) as CatalogRowLike[], error: destinationsResult.error },
      services: { data: (servicesResult.data ?? []) as CatalogRowLike[], error: servicesResult.error },
      packages: { data: (packagesResult.data ?? []) as CatalogRowLike[], error: packagesResult.error },
      promotions: { data: (promotionsResult.data ?? []) as CatalogRowLike[], error: promotionsResult.error },
    });
  } catch (error) {
    console.error("[public-catalog] Fatal error loading catalog:", error);
    return null;
  }
}

export async function getPublicCatalogContent(locale: Locale) {
  const liveContent = await getLivePublicCatalogContent(locale);

  return liveContent ?? buildFallbackCatalogContent(locale);
}

export async function getPublicCatalogStaticParams(
  locale: Locale,
  kind: "destinations" | "promotions" | "packages" | "services",
) {
  const catalog = await getPublicCatalogContent(locale).catch(() => buildFallbackCatalogContent(locale));
  const items = catalog[kind] ?? [];

  return buildPublicCatalogStaticParams(
    {
      destinations: kind === "destinations" ? items : [],
      services: kind === "services" ? items : [],
      packages: kind === "packages" ? items : [],
      promotions: kind === "promotions" ? items : [],
    },
    locale,
    kind,
  );
}

export async function getPublicCatalogItem(
  locale: Locale,
  kind: "destinations" | "promotions" | "packages" | "services",
  slug: string,
) {
  const catalog = await getPublicCatalogContent(locale).catch(() => buildFallbackCatalogContent(locale));

  const item = (
    kind === "promotions" ? catalog?.promotions : kind === "packages" ? catalog?.packages : kind === "services" ? catalog?.services : catalog?.destinations
  )?.find((entry) => entry.slug[locale] === slug);

  return item ?? null;
}
