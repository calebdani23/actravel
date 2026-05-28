"use server";

import { revalidatePath } from "next/cache";
import { requireAdminRole } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";
import type { CatalogResource, CatalogStatus } from "@/lib/admin/catalog";
import type { TablesInsert } from "@/lib/supabase/database.types";
import { type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/content/public-site";

const resources = ["destinations", "services", "packages", "promotions"] as const;

function text(formData: FormData, key: string, required = false) {
  const value = formData.get(key);
  const result = typeof value === "string" ? value.trim() : "";
  if (required && !result) throw new Error(`${key} is required`);
  return result || undefined;
}

function bool(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function numberValue(formData: FormData, key: string) {
  const value = text(formData, key);
  return value === undefined ? undefined : Number(value);
}

function resourceValue(formData: FormData): CatalogResource {
  const value = text(formData, "resource", true);
  if (!resources.includes(value as CatalogResource)) throw new Error("Invalid catalog resource");
  return value as CatalogResource;
}

function publishedAt(status: CatalogStatus) {
  return status === "published" ? new Date().toISOString() : null;
}

function mediaFields(formData: FormData) {
  return {
    hero_image_url: text(formData, "hero_image_url"),
    thumbnail_image_url: text(formData, "thumbnail_image_url"),
  };
}

function publicRouteKey(resource: CatalogResource) {
  return resource === "promotions" ? "deals" : resource;
}

function revalidatePublicCatalog(resource: CatalogResource, slugs: Array<string | null | undefined> = []) {
  const routeKey = publicRouteKey(resource);
  const slugSet = new Set(slugs.filter((slug): slug is string => Boolean(slug)));

  for (const locale of ["es", "en"] as Locale[]) {
    revalidatePath(`/${locale}`);
    revalidatePath(localizedPath(locale, routeKey));
    for (const slug of slugSet) {
      if (resource === "destinations" || resource === "promotions") revalidatePath(localizedPath(locale, routeKey, slug));
    }
  }

  revalidatePath("/sitemap.xml");
}

function destinationPayload(formData: FormData, status: CatalogStatus): TablesInsert<"destinations"> {
  const base = { status, is_featured: bool(formData, "is_featured"), published_at: publishedAt(status) };
  return {
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
    ...mediaFields(formData),
  };
}

function servicePayload(formData: FormData, status: CatalogStatus): TablesInsert<"services"> {
  const base = { status, is_featured: bool(formData, "is_featured"), published_at: publishedAt(status) };
  return {
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
    ...mediaFields(formData),
  };
}

function packagePayload(formData: FormData, status: CatalogStatus): TablesInsert<"packages"> {
  const base = { status, is_featured: bool(formData, "is_featured"), published_at: publishedAt(status) };
  return {
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
    ...mediaFields(formData),
  };
}

function promotionPayload(formData: FormData, status: CatalogStatus): TablesInsert<"promotions"> {
  const base = { status, is_featured: bool(formData, "is_featured"), published_at: publishedAt(status) };
  return {
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
    ...mediaFields(formData),
  };
}

async function writeCatalogRecord(formData: FormData, status: CatalogStatus) {
  await requireAdminRole(["admin", "marketing"]);
  const supabase = await createClient();
  const resource = resourceValue(formData);
  const id = text(formData, "id");
  const current = id ? await supabase.from(resource).select("slug_es, slug_en").eq("id", id).maybeSingle() : { data: null, error: null };
  if (current.error) throw new Error(current.error.message);
  if (resource === "destinations") {
    const payload = destinationPayload(formData, status);
    const { error } = id ? await supabase.from("destinations").update(payload).eq("id", id) : await supabase.from("destinations").insert(payload);
    if (error) throw new Error(error.message);
    revalidateCatalog(resource, [current.data?.slug_es, current.data?.slug_en, payload.slug_es, payload.slug_en]);
    return;
  }

  if (resource === "services") {
    const payload = servicePayload(formData, status);
    const { error } = id ? await supabase.from("services").update(payload).eq("id", id) : await supabase.from("services").insert(payload);
    if (error) throw new Error(error.message);
    revalidateCatalog(resource);
    return;
  }

  if (resource === "packages") {
    const payload = packagePayload(formData, status);
    const { error } = id ? await supabase.from("packages").update(payload).eq("id", id) : await supabase.from("packages").insert(payload);
    if (error) throw new Error(error.message);
    revalidateCatalog(resource);
    return;
  }

  const payload = promotionPayload(formData, status);
  const { error } = id ? await supabase.from("promotions").update(payload).eq("id", id) : await supabase.from("promotions").insert(payload);
  if (error) throw new Error(error.message);
  revalidateCatalog(resource, [current.data?.slug_es, current.data?.slug_en, payload.slug_es, payload.slug_en]);
}

function revalidateCatalog(resource: CatalogResource, slugs: Array<string | null | undefined> = []) {
  revalidatePath(`/admin/catalog/${resource}`);
  revalidatePath("/admin/dashboard");
  revalidatePublicCatalog(resource, slugs);
}

export async function upsertCatalogAction(formData: FormData) {
  await writeCatalogRecord(formData, "draft");
}

export async function publishCatalogAction(formData: FormData) {
  await writeCatalogRecord(formData, "published");
}

export async function unpublishCatalogAction(formData: FormData) {
  await requireAdminRole(["admin", "marketing"]);
  const supabase = await createClient();
  const resource = resourceValue(formData);
  const id = text(formData, "id", true);
  const current = await supabase.from(resource).select("slug_es, slug_en").eq("id", id).maybeSingle();
  if (current.error) throw new Error(current.error.message);
  const { error } = await supabase.from(resource).update({ status: "draft", published_at: null }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidateCatalog(resource, [current.data?.slug_es, current.data?.slug_en]);
}

export async function deleteCatalogAction(formData: FormData) {
  await requireAdminRole(["admin", "marketing"]);
  const resource = resourceValue(formData);
  const id = text(formData, "id", true);
  const supabase = await createClient();
  const current = await supabase.from(resource).select("slug_es, slug_en").eq("id", id).maybeSingle();
  if (current.error) throw new Error(current.error.message);
  const { error } = await supabase.from(resource).delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidateCatalog(resource, [current.data?.slug_es, current.data?.slug_en]);
}
