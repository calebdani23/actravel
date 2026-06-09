const DEFAULT_BUCKET = "catalog-media";
const CATALOG_MEDIA_PROTOCOL = "storage://";
const CATALOG_MEDIA_MAX_SIZE_BYTES = 10 * 1024 * 1024;
const CATALOG_MEDIA_EXTENSIONS = {
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export const CATALOG_MEDIA_BUCKET = DEFAULT_BUCKET;
export const CATALOG_MEDIA_ACCEPT = Object.keys(CATALOG_MEDIA_EXTENSIONS).join(",");

function safeUploadSlug(input: string | null | undefined) {
  const slug = (input ?? "archivo")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\.[a-z0-9]{1,8}$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "archivo";
}

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
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
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

function normalizedStoragePath(path: string) {
  const cleaned = path
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (!cleaned.length) return null;
  if (cleaned.some((segment) => segment === "." || segment === "..")) {
    throw new Error("La referencia de Storage no puede incluir segmentos . o ...");
  }

  return cleaned.join("/");
}

export type CatalogMediaStorageRef = {
  bucket: string;
  path: string;
  normalized: string;
};

export function parseCatalogMediaStorageRef(value?: string | null, options?: { bucket?: string; allowLegacyRelativePath?: boolean }): CatalogMediaStorageRef | null {
  const bucket = options?.bucket ?? DEFAULT_BUCKET;
  const trimmed = value?.trim() ?? "";

  if (!trimmed) return null;

  if (trimmed.toLowerCase().startsWith(CATALOG_MEDIA_PROTOCOL)) {
    const withoutProtocol = trimmed.slice(CATALOG_MEDIA_PROTOCOL.length).replace(/^\/+/, "");
    const [refBucket, ...rest] = withoutProtocol.split("/").filter(Boolean);
    if (refBucket !== bucket) {
      throw new Error(`La referencia Storage debe usar ${bucket}. Usa storage://${bucket}/ruta/archivo.jpg.`);
    }
    const path = normalizedStoragePath(rest.join("/"));
    if (!path) {
      throw new Error(`La referencia Storage debe incluir una ruta después de storage://${bucket}/.`);
    }
    return { bucket, path, normalized: `${CATALOG_MEDIA_PROTOCOL}${bucket}/${path}` };
  }

  if (trimmed.startsWith("/")) {
    return parseCatalogMediaStorageRef(trimmed.replace(/^\/+/, ""), options);
  }

  if (trimmed.startsWith(`${bucket}/`)) {
    const path = normalizedStoragePath(trimmed.slice(bucket.length + 1));
    if (!path) {
      throw new Error(`La referencia Storage debe incluir una ruta después de ${bucket}/.`);
    }
    return { bucket, path, normalized: `${CATALOG_MEDIA_PROTOCOL}${bucket}/${path}` };
  }

  if (options?.allowLegacyRelativePath) {
    const path = normalizedStoragePath(trimmed);
    return path ? { bucket, path, normalized: `${CATALOG_MEDIA_PROTOCOL}${bucket}/${path}` } : null;
  }

  return null;
}

export function normalizeCatalogMediaValue(value?: string | null, options?: { bucket?: string }) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  if (isAbsoluteUrl(trimmed)) return new URL(trimmed).toString();

  const storageRef = parseCatalogMediaStorageRef(trimmed, options);
  if (storageRef) return storageRef.normalized;

  throw new Error("Media inválida. Usa una URL absoluta (https://...) o una referencia Storage válida de catalog-media como storage://catalog-media/carpeta/archivo.jpg.");
}

export function catalogMediaStorageObject(value?: string | null, options?: { bucket?: string; allowLegacyRelativePath?: boolean }) {
  try {
    return parseCatalogMediaStorageRef(value, options);
  } catch {
    return null;
  }
}

export function validateCatalogMediaUploadFile(file: File) {
  const extension = CATALOG_MEDIA_EXTENSIONS[file.type as keyof typeof CATALOG_MEDIA_EXTENSIONS];
  if (!extension) throw new Error("Tipo de imagen no permitido. Usa JPG, PNG, WebP o GIF.");
  if (file.size <= 0) throw new Error("La imagen está vacía.");
  if (file.size > CATALOG_MEDIA_MAX_SIZE_BYTES) throw new Error("La imagen excede el límite de 10 MB.");
  if (!file.name?.trim()) throw new Error("La imagen necesita un nombre válido.");
  return { contentType: file.type, extension };
}

export function buildCatalogMediaStoragePath(file: File, context: { resource: string; slot: "hero" | "thumbnail"; slug?: string | null }, now = new Date(), uuid = crypto.randomUUID()) {
  const { extension } = validateCatalogMediaUploadFile(file);
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const slug = safeUploadSlug(context.slug ?? file.name);
  return `${context.resource}/${context.slot}/${year}/${month}/${uuid}-${slug}.${extension}`;
}

export async function uploadCatalogMediaFile(
  supabase: { storage: { from: (bucket: string) => { upload: (path: string, file: File, options: { contentType: string; upsert: false }) => Promise<{ error: { message: string } | null }> } } },
  file: File,
  context: { resource: string; slot: "hero" | "thumbnail"; slug?: string | null },
) {
  const { contentType } = validateCatalogMediaUploadFile(file);
  const path = buildCatalogMediaStoragePath(file, context);
  const { error } = await supabase.storage.from(DEFAULT_BUCKET).upload(path, file, { contentType, upsert: false });
  if (error) throw new Error(`No se pudo subir la imagen: ${error.message}`);

  return {
    bucket: DEFAULT_BUCKET,
    path,
    value: `${CATALOG_MEDIA_PROTOCOL}${DEFAULT_BUCKET}/${path}`,
  };
}

export function resolveCatalogMedia(value?: string | null, options?: { baseUrl?: string | null; bucket?: string }): CatalogMediaResolution {
  const bucket = options?.bucket ?? DEFAULT_BUCKET;
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return { url: null, source: "empty", bucket, path: null };

  const strictStorageRef = catalogMediaStorageObject(trimmed, { bucket });

  if (strictStorageRef) {
    const baseUrl = supabasePublicBaseUrl(options?.baseUrl);
    const url = baseUrl && strictStorageRef.path ? `${baseUrl}/storage/v1/object/public/${strictStorageRef.bucket}/${strictStorageRef.path}` : `${strictStorageRef.bucket}/${strictStorageRef.path}`;
    return { url, source: "storage", bucket: strictStorageRef.bucket, path: strictStorageRef.path };
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
