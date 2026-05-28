"use server";

import { revalidatePath } from "next/cache";
import { requireAdminRole } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";
import type { CatalogResource, CatalogStatus } from "@/lib/admin/catalog";

const resources = ["destinations", "services", "promotions"] as const;
const statuses = ["draft", "published", "archived"] as const;

function text(formData: FormData, key: string, required = false) {
  const value = formData.get(key);
  const result = typeof value === "string" ? value.trim() : "";
  if (required && !result) throw new Error(`${key} is required`);
  return result || null;
}

function bool(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function numberValue(formData: FormData, key: string) {
  const value = text(formData, key);
  return value === null ? null : Number(value);
}

function resourceValue(formData: FormData): CatalogResource {
  const value = text(formData, "resource", true);
  if (!resources.includes(value as CatalogResource)) throw new Error("Invalid catalog resource");
  return value as CatalogResource;
}

function statusValue(formData: FormData): CatalogStatus {
  const value = text(formData, "status") ?? "draft";
  if (!statuses.includes(value as CatalogStatus)) throw new Error("Invalid status");
  return value as CatalogStatus;
}

function publishedAt(status: CatalogStatus) {
  return status === "published" ? new Date().toISOString() : null;
}

function revalidateCatalog(resource: CatalogResource) {
  revalidatePath(`/admin/catalog/${resource}`);
  revalidatePath("/admin/dashboard");
}

export async function upsertCatalogAction(formData: FormData) {
  await requireAdminRole(["admin", "marketing"]);
  const supabase = await createClient();
  const resource = resourceValue(formData);
  const id = text(formData, "id");
  const status = statusValue(formData);
  const base = { status, is_featured: bool(formData, "is_featured"), published_at: publishedAt(status) };
  let errorMessage: string | null = null;

  if (resource === "destinations") {
    const payload = {
      ...base,
      name_es: text(formData, "name_es", true),
      name_en: text(formData, "name_en", true),
      slug_es: text(formData, "slug_es", true),
      slug_en: text(formData, "slug_en", true),
      summary_es: text(formData, "summary_es"),
      summary_en: text(formData, "summary_en"),
      description_es: text(formData, "description_es"),
      description_en: text(formData, "description_en"),
      country: text(formData, "country", true),
      region: text(formData, "region"),
      hero_image_url: text(formData, "hero_image_url"),
      thumbnail_image_url: text(formData, "thumbnail_image_url"),
    };
    const { error } = id ? await supabase.from("destinations").update(payload).eq("id", id) : await supabase.from("destinations").insert(payload);
    errorMessage = error?.message ?? null;
  } else if (resource === "services") {
    const payload = {
      ...base,
      name_es: text(formData, "name_es", true),
      name_en: text(formData, "name_en", true),
      slug_es: text(formData, "slug_es", true),
      slug_en: text(formData, "slug_en", true),
      summary_es: text(formData, "summary_es"),
      summary_en: text(formData, "summary_en"),
      description_es: text(formData, "description_es"),
      description_en: text(formData, "description_en"),
      price_from_mxn: numberValue(formData, "price_from_mxn"),
      price_from_usd: numberValue(formData, "price_from_usd"),
      sort_order: numberValue(formData, "sort_order") ?? 0,
      hero_image_url: text(formData, "hero_image_url"),
      thumbnail_image_url: text(formData, "thumbnail_image_url"),
    };
    const { error } = id ? await supabase.from("services").update(payload).eq("id", id) : await supabase.from("services").insert(payload);
    errorMessage = error?.message ?? null;
  } else {
    const payload = {
      ...base,
      title_es: text(formData, "title_es", true),
      title_en: text(formData, "title_en", true),
      slug_es: text(formData, "slug_es", true),
      slug_en: text(formData, "slug_en", true),
      summary_es: text(formData, "summary_es"),
      summary_en: text(formData, "summary_en"),
      details_es: text(formData, "details_es"),
      details_en: text(formData, "details_en"),
      destination_id: text(formData, "destination_id"),
      service_id: text(formData, "service_id"),
      price_from_mxn: numberValue(formData, "price_from_mxn"),
      price_from_usd: numberValue(formData, "price_from_usd"),
      starts_at: text(formData, "starts_at"),
      ends_at: text(formData, "ends_at"),
      hero_image_url: text(formData, "hero_image_url"),
      thumbnail_image_url: text(formData, "thumbnail_image_url"),
    };
    const { error } = id ? await supabase.from("promotions").update(payload).eq("id", id) : await supabase.from("promotions").insert(payload);
    errorMessage = error?.message ?? null;
  }

  if (errorMessage) throw new Error(errorMessage);
  revalidateCatalog(resource);
}

export async function deleteCatalogAction(formData: FormData) {
  await requireAdminRole(["admin", "marketing"]);
  const resource = resourceValue(formData);
  const id = text(formData, "id", true);
  const supabase = await createClient();
  const { error } = await supabase.from(resource).delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidateCatalog(resource);
}
