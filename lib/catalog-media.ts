const DEFAULT_BUCKET = "catalog-media";

export type CatalogMediaResolution = {
  url: string | null;
  source: "url" | "storage" | "empty";
  bucket: string;
  path: string | null;
};

function supabasePublicBaseUrl(baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? null) {
  return baseUrl?.trim().replace(/\/+$/, "") ?? null;
}

function isAbsoluteUrl(value: string) {
  return /^[a-z][a-z\d+.-]*:\/\//i.test(value);
}

function splitStorageValue(value: string, defaultBucket: string) {
  const storageValue = value.replace(/^storage:\/\//i, "").replace(/^\/+/, "");
  const [first, ...rest] = storageValue.split("/").filter(Boolean);
  if (!first) return { bucket: defaultBucket, path: null };
  if (value.toLowerCase().startsWith("storage://")) {
    return { bucket: first, path: rest.join("/") || null };
  }
  if (first === defaultBucket && rest.length) {
    return { bucket: defaultBucket, path: rest.join("/") || null };
  }
  return { bucket: defaultBucket, path: storageValue || null };
}

export function resolveCatalogMedia(value?: string | null, options?: { baseUrl?: string | null; bucket?: string }): CatalogMediaResolution {
  const bucket = options?.bucket ?? DEFAULT_BUCKET;
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return { url: null, source: "empty", bucket, path: null };

  if (trimmed.toLowerCase().startsWith("storage://")) {
    const { bucket: resolvedBucket, path } = splitStorageValue(trimmed, bucket);
    const baseUrl = supabasePublicBaseUrl(options?.baseUrl);
    const url = baseUrl && path ? `${baseUrl}/storage/v1/object/public/${resolvedBucket}/${path}` : path ? `${resolvedBucket}/${path}` : null;
    return { url, source: "storage", bucket: resolvedBucket, path };
  }

  if (isAbsoluteUrl(trimmed)) {
    return { url: trimmed, source: "url", bucket, path: null };
  }

  const { bucket: resolvedBucket, path } = splitStorageValue(trimmed, bucket);
  const baseUrl = supabasePublicBaseUrl(options?.baseUrl);
  const url = baseUrl && path ? `${baseUrl}/storage/v1/object/public/${resolvedBucket}/${path}` : path ? `${resolvedBucket}/${path}` : null;
  return { url, source: "storage", bucket: resolvedBucket, path };
}

export function resolveCatalogMediaUrl(value?: string | null, options?: { baseUrl?: string | null; bucket?: string }) {
  return resolveCatalogMedia(value, options).url;
}

export function catalogMediaSourceLabel(value?: string | null) {
  const source = resolveCatalogMedia(value).source;
  if (source === "url") return "URL";
  if (source === "storage") return "Storage";
  return "Sin media";
}
