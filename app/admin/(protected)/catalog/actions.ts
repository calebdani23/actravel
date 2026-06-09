"use server";

import { revalidatePath } from "next/cache";
import { optionalFile, removeStoredObject, sameStorageObject } from "@/lib/admin/storage-uploads";
import { requireAdminRole } from "@/lib/admin/auth";
import { catalogMediaStorageObject, normalizeCatalogMediaValue, uploadCatalogMediaFile } from "@/lib/catalog-media";
import { createClient } from "@/lib/supabase/server";
import { resolveCatalogWriteState, type CatalogResource, type CatalogStatus, type CatalogWriteIntent } from "@/lib/admin/catalog";
import type { TablesInsert } from "@/lib/supabase/database.types";
import { type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/content/public-site";

const resources = ["destinations", "services", "packages", "promotions"] as const;

function text(formData: FormData, key: string, required: true): string;
function text(formData: FormData, key: string, required?: false): string | undefined;
function text(formData: FormData, key: string, required = false): string | undefined {
  const value = formData.get(key);
  const result = typeof value === "string" ? value.trim() : "";

  if (required && !result) {
    throw new Error(`${key} is required`);
  }

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

type ExistingCatalogRecord = {
  slug_es: string | null;
  slug_en: string | null;
  status: CatalogStatus | null;
  published_at: string | null;
  hero_image_url: string | null;
  thumbnail_image_url: string | null;
};

type CatalogMediaField = "hero_image_url" | "thumbnail_image_url";

type UploadedCatalogMedia = {
  bucket: string;
  path: string;
  value: string;
};

function uploadSlot(field: CatalogMediaField) {
  return field === "hero_image_url" ? "hero" : "thumbnail";
}

async function getExistingCatalogRecord(supabase: Awaited<ReturnType<typeof createClient>>, resource: CatalogResource, id?: string) {
  if (!id) return { data: null as ExistingCatalogRecord | null, error: null };
  return supabase.from(resource).select("slug_es, slug_en, status, published_at, hero_image_url, thumbnail_image_url").eq("id", id).maybeSingle();
}

async function resolveCatalogMediaField(
  supabase: Awaited<ReturnType<typeof createClient>>,
  formData: FormData,
  resource: CatalogResource,
  field: CatalogMediaField,
) {
  if (bool(formData, `${field}_clear`)) {
    return { value: null, upload: null as UploadedCatalogMedia | null };
  }

  const uploadFile = optionalFile(formData, `${field}_file`);
  if (uploadFile) {
    const upload = await uploadCatalogMediaFile(supabase, uploadFile, {
      resource,
      slot: uploadSlot(field),
      slug: text(formData, "slug_es") ?? text(formData, "slug_en") ?? text(formData, "name_es") ?? text(formData, "title_es") ?? undefined,
    });

    return { value: upload.value, upload };
  }

  return {
    value: normalizeCatalogMediaValue(text(formData, field)),
    upload: null as UploadedCatalogMedia | null,
  };
}

async function resolveCatalogMediaFields(
  supabase: Awaited<ReturnType<typeof createClient>>,
  formData: FormData,
  resource: CatalogResource,
) {
  const [hero, thumbnail] = await Promise.all([
    resolveCatalogMediaField(supabase, formData, resource, "hero_image_url"),
    resolveCatalogMediaField(supabase, formData, resource, "thumbnail_image_url"),
  ]);

  return {
    hero_image_url: hero.value,
    thumbnail_image_url: thumbnail.value,
    uploads: [hero.upload, thumbnail.upload].filter((upload): upload is UploadedCatalogMedia => Boolean(upload)),
  };
}

async function cleanupReplacedCatalogMedia(supabase: Awaited<ReturnType<typeof createClient>>, current: ExistingCatalogRecord | null, next: { hero_image_url: string | null; thumbnail_image_url: string | null }) {
  const pairs: Array<[CatalogMediaField, string | null | undefined, string | null | undefined]> = [
    ["hero_image_url", current?.hero_image_url, next.hero_image_url],
    ["thumbnail_image_url", current?.thumbnail_image_url, next.thumbnail_image_url],
  ];

  for (const [, previousValue, nextValue] of pairs) {
    const previous = catalogMediaStorageObject(previousValue, { allowLegacyRelativePath: true });
    const replacement = catalogMediaStorageObject(nextValue, { allowLegacyRelativePath: true });
    if (!previous || sameStorageObject(previous, replacement)) continue;

    try {
      await removeStoredObject(supabase, previous);
    } catch (cleanupError) {
      console.error("[catalog] replaced media cleanup failed", cleanupError);
    }
  }
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

function destinationPayload(formData: FormData, publication: { status: CatalogStatus; published_at: string | null }, media: { hero_image_url: string | null; thumbnail_image_url: string | null }): TablesInsert<"destinations"> {
  const base = { ...publication, is_featured: bool(formData, "is_featured") };
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
    ...media,
  };
}

function servicePayload(formData: FormData, publication: { status: CatalogStatus; published_at: string | null }, media: { hero_image_url: string | null; thumbnail_image_url: string | null }): TablesInsert<"services"> {
  const base = { ...publication, is_featured: bool(formData, "is_featured") };
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
    ...media,
  };
}

function packagePayload(formData: FormData, publication: { status: CatalogStatus; published_at: string | null }, media: { hero_image_url: string | null; thumbnail_image_url: string | null }): TablesInsert<"packages"> {
  const base = { ...publication, is_featured: bool(formData, "is_featured") };
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
    ...media,
  };
}

function promotionPayload(formData: FormData, publication: { status: CatalogStatus; published_at: string | null }, media: { hero_image_url: string | null; thumbnail_image_url: string | null }): TablesInsert<"promotions"> {
  const base = { ...publication, is_featured: bool(formData, "is_featured") };
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
    ...media,
  };
}

async function cleanupFailedCatalogUploads(supabase: Awaited<ReturnType<typeof createClient>>, uploads: UploadedCatalogMedia[]) {
  for (const upload of uploads) {
    try {
      await removeStoredObject(supabase, upload);
    } catch (cleanupError) {
      console.error("[catalog] failed upload cleanup failed", cleanupError);
    }
  }
}

async function writeCatalogRecord(formData: FormData, intent: CatalogWriteIntent) {
  await requireAdminRole(["admin", "marketing"]);
  const supabase = await createClient();
  const resource = resourceValue(formData);
  const id = text(formData, "id");
  const current = await getExistingCatalogRecord(supabase, resource, id);
  if (current.error) throw new Error(current.error.message);

  const media = await resolveCatalogMediaFields(supabase, formData, resource);
  const publication = resolveCatalogWriteState(current.data, intent);

  try {
    if (resource === "destinations") {
      const payload = destinationPayload(formData, publication, media);
      const { error } = id ? await supabase.from("destinations").update(payload).eq("id", id) : await supabase.from("destinations").insert(payload);
      if (error) throw new Error(error.message);
      await cleanupReplacedCatalogMedia(supabase, current.data, media);
      revalidateCatalog(resource, [current.data?.slug_es, current.data?.slug_en, payload.slug_es, payload.slug_en]);
      return;
    }

    if (resource === "services") {
      const payload = servicePayload(formData, publication, media);
      const { error } = id ? await supabase.from("services").update(payload).eq("id", id) : await supabase.from("services").insert(payload);
      if (error) throw new Error(error.message);
      await cleanupReplacedCatalogMedia(supabase, current.data, media);
      revalidateCatalog(resource);
      return;
    }

    if (resource === "packages") {
      const payload = packagePayload(formData, publication, media);
      const { error } = id ? await supabase.from("packages").update(payload).eq("id", id) : await supabase.from("packages").insert(payload);
      if (error) throw new Error(error.message);
      await cleanupReplacedCatalogMedia(supabase, current.data, media);
      revalidateCatalog(resource);
      return;
    }

    const payload = promotionPayload(formData, publication, media);
    const { error } = id ? await supabase.from("promotions").update(payload).eq("id", id) : await supabase.from("promotions").insert(payload);
    if (error) throw new Error(error.message);
    await cleanupReplacedCatalogMedia(supabase, current.data, media);
    revalidateCatalog(resource, [current.data?.slug_es, current.data?.slug_en, payload.slug_es, payload.slug_en]);
  } catch (error) {
    await cleanupFailedCatalogUploads(supabase, media.uploads);
    throw error;
  }
}

function revalidateCatalog(resource: CatalogResource, slugs: Array<string | null | undefined> = []) {
  revalidatePath(`/admin/catalog/${resource}`);
  revalidatePath("/admin/dashboard");
  revalidatePublicCatalog(resource, slugs);
}

export async function upsertCatalogAction(formData: FormData) {
  await writeCatalogRecord(formData, "save");
}

export async function publishCatalogAction(formData: FormData) {
  await writeCatalogRecord(formData, "publish");
}

export async function moveCatalogToDraftAction(formData: FormData) {
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

export async function archiveCatalogAction(formData: FormData) {
  await requireAdminRole(["admin", "marketing"]);
  const supabase = await createClient();
  const resource = resourceValue(formData);
  const id = text(formData, "id", true);
  const current = await supabase.from(resource).select("slug_es, slug_en, published_at").eq("id", id).maybeSingle();
  if (current.error) throw new Error(current.error.message);
  const { error } = await supabase.from(resource).update({ status: "archived", published_at: current.data?.published_at ?? null }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidateCatalog(resource, [current.data?.slug_es, current.data?.slug_en]);
}

export async function deleteCatalogAction(formData: FormData) {
  await requireAdminRole(["admin", "marketing"]);
  const resource = resourceValue(formData);
  const id = text(formData, "id", true);
  const supabase = await createClient();
  const current = await supabase.from(resource).select("slug_es, slug_en, hero_image_url, thumbnail_image_url").eq("id", id).maybeSingle();
  if (current.error) throw new Error(current.error.message);
  const { error } = await supabase.from(resource).delete().eq("id", id);
  if (error) throw new Error(error.message);
  for (const value of [current.data?.hero_image_url, current.data?.thumbnail_image_url]) {
    const file = catalogMediaStorageObject(value, { allowLegacyRelativePath: true });
    if (!file) continue;
    try {
      await removeStoredObject(supabase, file);
    } catch (cleanupError) {
      console.error("[catalog] deleted media cleanup failed", cleanupError);
    }
  }
  revalidateCatalog(resource, [current.data?.slug_es, current.data?.slug_en]);
}
