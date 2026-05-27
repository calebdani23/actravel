import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

export type CatalogResource = "destinations" | "services" | "promotions";
export type CatalogStatus = "draft" | "published" | "archived";

export const catalogResources = {
  destinations: { label: "Destinos", href: "/admin/catalog/destinations" },
  services: { label: "Servicios", href: "/admin/catalog/services" },
  promotions: { label: "Promociones", href: "/admin/catalog/promotions" },
} satisfies Record<CatalogResource, { label: string; href: string }>;

export type DestinationRow = Tables<"destinations">;
export type ServiceRow = Tables<"services">;
export type PromotionRow = Tables<"promotions"> & {
  destinations: { id: string; name_es: string } | null;
  services: { id: string; name_es: string } | null;
};

export async function getCatalogOptions() {
  const supabase = await createClient();
  const [destinations, services] = await Promise.all([
    supabase.from("destinations").select("id, name_es").order("name_es"),
    supabase.from("services").select("id, name_es").order("name_es"),
  ]);

  return { destinations: destinations.data ?? [], services: services.data ?? [] };
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

  const { data, error } = await supabase
    .from("promotions")
    .select("*, destinations(id, name_es), services(id, name_es)")
    .order("updated_at", { ascending: false })
    .limit(100);
  return { rows: (data ?? []) as unknown as PromotionRow[], error: error?.message ?? null };
}
