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

type PublicCatalogLogDetails = {
  section?: keyof CatalogQueryResults;
  code?: string;
  status?: number;
  summary: string;
};

function sanitizePublicCatalogCode(value: unknown) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return /^[A-Za-z0-9_-]{1,32}$/.test(trimmed) ? trimmed : undefined;
}

function sanitizePublicCatalogStatus(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 100 && value <= 599 ? value : undefined;
}

export function buildPublicCatalogLogDetails(
  error: unknown,
  options: {
    section?: keyof CatalogQueryResults;
    summary: string;
  },
): PublicCatalogLogDetails {
  const code = sanitizePublicCatalogCode(error && typeof error === "object" && "code" in error ? error.code : undefined);
  const status = sanitizePublicCatalogStatus(error && typeof error === "object" && "status" in error ? error.status : undefined)
    ?? sanitizePublicCatalogStatus(error && typeof error === "object" && "statusCode" in error ? error.statusCode : undefined);

  return {
    ...(options.section ? { section: options.section } : {}),
    ...(code ? { code } : {}),
    ...(status ? { status } : {}),
    summary: options.summary,
  };
}

function logPublicCatalogQueryFailure(section: keyof CatalogQueryResults, error: CatalogQueryError) {
  console.error(`[public-catalog] ${section} query failed`, buildPublicCatalogLogDetails(error, {
    section,
    summary: "Respuesta no disponible del servicio de catálogo",
  }));
}

function logPublicCatalogFatalError(error: unknown) {
  console.error("[public-catalog] Fatal error loading catalog", buildPublicCatalogLogDetails(error, {
    summary: "No se pudo cargar el catálogo externo",
  }));
}

function shouldRetryWithoutDetailSections(error: CatalogQueryError | null) {
  return error?.code === "42703" && /detail_sections_(es|en)/.test(error.message);
}

function shouldRetryWithoutCommercialSections(error: CatalogQueryError | null) {
  return error?.code === "42703" && /commercial_sections_(es|en)/.test(error.message);
}

async function getPublishedCatalogRows(
  supabase: ReturnType<typeof createPublicSupabaseClient>,
  table: "destinations" | "services" | "packages",
  selectWithDetailSections: string,
  fallbackSelect: string,
  orderBy: { column: string; ascending: boolean },
) {
  const initial = await supabase.from(table).select(selectWithDetailSections).eq("status", "published").order(orderBy.column, { ascending: orderBy.ascending }).limit(100);

  if (!shouldRetryWithoutDetailSections(initial.error)) {
    return initial;
  }

  return supabase.from(table).select(fallbackSelect).eq("status", "published").order(orderBy.column, { ascending: orderBy.ascending }).limit(100);
}

async function getPublishedPromotions() {
  const supabase = createPublicSupabaseClient();
  const baseResult = await supabase
    .from("promotions")
    .select("id, slug_es, slug_en, title_es, title_en, summary_es, summary_en, details_es, details_en, commercial_sections_es, commercial_sections_en, hero_image_url, thumbnail_image_url, price_from_mxn, price_from_usd, destination_id, service_id, is_featured, status, published_at")
    .eq("status", "published")
    .order("updated_at", { ascending: false })
    .limit(100);

  const promotionResult = shouldRetryWithoutCommercialSections(baseResult.error)
    ? await supabase
      .from("promotions")
      .select("id, slug_es, slug_en, title_es, title_en, summary_es, summary_en, details_es, details_en, hero_image_url, thumbnail_image_url, price_from_mxn, price_from_usd, destination_id, service_id, is_featured, status, published_at")
      .eq("status", "published")
      .order("updated_at", { ascending: false })
      .limit(100)
    : baseResult;

  if (promotionResult.error) {
    return { data: null, error: promotionResult.error };
  }

  const promotions = (promotionResult.data ?? []) as CatalogRowLike[];
  const promotionIds = promotions.map((row) => row.id);
  if (!promotionIds.length) {
    return { data: promotions, error: null };
  }

  const [packageResult, serviceRelationsResult] = await Promise.all([
    supabase.from("promotions").select("id, package_id").in("id", promotionIds),
    supabase.from("promotion_services").select("promotion_id, service_id").in("promotion_id", promotionIds),
  ]);

  const packageByPromotionId = new Map<string, string | null>();
  if (!packageResult.error) {
    for (const row of packageResult.data ?? []) {
      packageByPromotionId.set(row.id, row.package_id ?? null);
    }
  }

  const serviceIdsByPromotionId = new Map<string, string[]>();
  if (!serviceRelationsResult.error) {
    for (const row of serviceRelationsResult.data ?? []) {
      const current = serviceIdsByPromotionId.get(row.promotion_id) ?? [];
      current.push(row.service_id);
      serviceIdsByPromotionId.set(row.promotion_id, current);
    }
  }

  return {
    data: promotions.map((row) => ({
      ...row,
      package_id: packageByPromotionId.get(row.id) ?? null,
      service_ids: serviceIdsByPromotionId.get(row.id) ?? null,
    })),
    error: null,
  };
}

export function buildLivePublicCatalogContent(locale: Locale, results: CatalogQueryResults) {
  const queryErrors = {
    destinations: results.destinations.error,
    services: results.services.error,
    packages: results.packages.error,
    promotions: results.promotions.error,
  };

  for (const [section, error] of Object.entries(queryErrors)) {
    if (error) {
      logPublicCatalogQueryFailure(section as keyof CatalogQueryResults, error);
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
      getPublishedCatalogRows(
        supabase,
        "destinations",
        "id, slug_es, slug_en, name_es, name_en, summary_es, summary_en, description_es, description_en, hero_image_url, thumbnail_image_url, detail_sections_es, detail_sections_en, is_featured, status, published_at",
        "id, slug_es, slug_en, name_es, name_en, summary_es, summary_en, description_es, description_en, hero_image_url, thumbnail_image_url, is_featured, status, published_at",
        { column: "updated_at", ascending: false },
      ),

      getPublishedCatalogRows(
        supabase,
        "services",
        "id, slug_es, slug_en, name_es, name_en, summary_es, summary_en, description_es, description_en, hero_image_url, thumbnail_image_url, detail_sections_es, detail_sections_en, price_from_mxn, price_from_usd, sort_order, is_featured, status, published_at",
        "id, slug_es, slug_en, name_es, name_en, summary_es, summary_en, description_es, description_en, hero_image_url, thumbnail_image_url, price_from_mxn, price_from_usd, sort_order, is_featured, status, published_at",
        { column: "sort_order", ascending: true },
      ),

      getPublishedCatalogRows(
        supabase,
        "packages",
        "id, slug_es, slug_en, name_es, name_en, summary_es, summary_en, description_es, description_en, hero_image_url, thumbnail_image_url, detail_sections_es, detail_sections_en, price_from_mxn, price_from_usd, sort_order, is_featured, status, published_at",
        "id, slug_es, slug_en, name_es, name_en, summary_es, summary_en, description_es, description_en, hero_image_url, thumbnail_image_url, price_from_mxn, price_from_usd, sort_order, is_featured, status, published_at",
        { column: "sort_order", ascending: true },
      ),

      getPublishedPromotions(),
    ]);

    return buildLivePublicCatalogContent(locale, {
      destinations: { data: (destinationsResult.data ?? []) as unknown as CatalogRowLike[], error: destinationsResult.error },
      services: { data: (servicesResult.data ?? []) as unknown as CatalogRowLike[], error: servicesResult.error },
      packages: { data: (packagesResult.data ?? []) as unknown as CatalogRowLike[], error: packagesResult.error },
      promotions: { data: (promotionsResult.data ?? []) as CatalogRowLike[], error: promotionsResult.error },
    });
  } catch (error) {
    logPublicCatalogFatalError(error);
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
