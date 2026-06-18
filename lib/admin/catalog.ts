import "server-only";

import { resolvePromotionServiceIds as resolvePromotionServiceIdsBase } from "@/lib/catalog/promotion-relations";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

export type CatalogResource = "destinations" | "services" | "packages" | "promotions";
export type CatalogStatus = "draft" | "published" | "archived";
export type CatalogWriteIntent = "save" | "publish" | "draft" | "archive";

export const catalogResources = {
  destinations: { label: "Destinos", href: "/admin/catalog/destinations" },
  services: { label: "Servicios", href: "/admin/catalog/services" },
  packages: { label: "Paquetes", href: "/admin/catalog/packages" },
  promotions: { label: "Promociones", href: "/admin/catalog/promotions" },
} satisfies Record<CatalogResource, { label: string; href: string }>;

export type DestinationRow = Tables<"destinations">;
export type ServiceRow = Tables<"services">;
export type PackageRow = Tables<"packages">;
export type PromotionRow = Tables<"promotions"> & {
  destinations: { id: string; name_es: string } | null;
  packages: { id: string; name_es: string } | null;
  services: { id: string; name_es: string } | null;
  promotion_services: Array<{ service_id: string | null; services: { id: string; name_es: string } | null }>;
};

export const resolvePromotionServiceIds = resolvePromotionServiceIdsBase;

export function catalogStatusLabel(status?: string | null) {
  if (status === "published") return "Publicado";
  if (status === "archived") return "Archivado";
  return "Borrador";
}

export function resolveCatalogWriteState(
  current: { status?: CatalogStatus | null; published_at?: string | null } | null | undefined,
  intent: CatalogWriteIntent,
  now = new Date(),
) {
  if (intent === "publish") {
    return { status: "published" as const, published_at: now.toISOString() };
  }

  if (intent === "draft") {
    return { status: "draft" as const, published_at: null };
  }

  if (intent === "archive") {
    return { status: "archived" as const, published_at: current?.published_at ?? null };
  }

  if (!current) {
    return { status: "draft" as const, published_at: null };
  }

  return {
    status: current.status ?? "draft",
    published_at: current.published_at ?? null,
  };
}

export async function getCatalogOptions() {
  const supabase = await createClient();
  const [destinations, services, packages] = await Promise.all([
    supabase.from("destinations").select("id, name_es").order("name_es"),
    supabase.from("services").select("id, name_es").order("name_es"),
    supabase.from("packages").select("id, name_es").order("name_es"),
  ]);

  return { destinations: destinations.data ?? [], services: services.data ?? [], packages: packages.data ?? [] };
}

export async function getCatalogRows(resource: CatalogResource) {
  const supabase = await createClient();

  if (resource === "destinations") {
    const { data, error } = await supabase.from("destinations").select("*").order("updated_at", { ascending: false }).limit(100);
    return { rows: (data ?? []) as DestinationRow[], error: error?.message ?? null };
  }

  if (resource === "services") {
    const { data, error } = await supabase.from("services").select("*").order("sort_order").limit(100);
    return { rows: (data ?? []) as ServiceRow[], error: error?.message ?? null };
  }

  if (resource === "packages") {
    const { data, error } = await supabase.from("packages").select("*").order("sort_order").limit(100);
    return { rows: (data ?? []) as PackageRow[], error: error?.message ?? null };
  }

  const { data, error } = await supabase
    .from("promotions")
    .select("*, destinations(id, name_es), services(id, name_es)")
    .order("updated_at", { ascending: false })
    .limit(100);

  if (error) {
    return { rows: [] as PromotionRow[], error: error.message };
  }

  const promotions = (data ?? []) as Array<Tables<"promotions"> & { destinations: { id: string; name_es: string } | null; services: { id: string; name_es: string } | null; package_id?: string | null }>;
  const packageIds = Array.from(new Set(promotions.map((row) => row.package_id).filter((value): value is string => Boolean(value))));
  const [packagesResult, promotionServicesResult] = await Promise.all([
    packageIds.length ? supabase.from("packages").select("id, name_es").in("id", packageIds) : Promise.resolve({ data: [], error: null }),
    supabase.from("promotion_services").select("promotion_id, service_id, services(id, name_es)"),
  ]);

  const packagesById = new Map((packagesResult.data ?? []).map((row) => [row.id, row]));
  const promotionServicesByPromotionId = new Map<string, Array<{ service_id: string | null; services: { id: string; name_es: string } | null }>>();

  if (!promotionServicesResult.error) {
    for (const row of promotionServicesResult.data ?? []) {
      const current = promotionServicesByPromotionId.get(row.promotion_id) ?? [];
      const relatedService = Array.isArray(row.services) ? row.services[0] ?? null : row.services ?? null;
      current.push({ service_id: row.service_id, services: relatedService as { id: string; name_es: string } | null });
      promotionServicesByPromotionId.set(row.promotion_id, current);
    }
  }

  return {
    rows: promotions.map((row) => ({
      ...row,
      packages: row.package_id ? packagesById.get(row.package_id) ?? null : null,
      promotion_services: promotionServicesByPromotionId.get(row.id) ?? [],
    })) as PromotionRow[],
    error: packagesResult.error?.message ?? null,
  };
}
