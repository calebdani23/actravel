import "server-only";

export type UploadBucket = "documents" | "payment-proofs";

export type StoredObjectRef = {
  bucket?: string | null;
  path?: string | null;
};

type StorageClient = {
  storage: {
    from: (bucket: string) => {
      upload: (path: string, file: File, options: { contentType: string; upsert: false }) => Promise<{ error: { message: string } | null }>;
      remove: (paths: string[]) => Promise<{ error: { message: string } | null }>;
    };
  };
};

export const STORAGE_UPLOAD_CONFIG = {
  documents: {
    bucket: "documents",
    maxSizeBytes: 20 * 1024 * 1024,
    helpText: "PDF, JPG, PNG o WebP hasta 20 MB",
  },
  "payment-proofs": {
    bucket: "payment-proofs",
    maxSizeBytes: 10 * 1024 * 1024,
    helpText: "PDF, JPG, PNG o WebP hasta 10 MB",
  },
} as const;

const MIME_EXTENSIONS = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export const STORAGE_UPLOAD_ACCEPT = Object.keys(MIME_EXTENSIONS).join(",");

type UploadContext = {
  bookingId?: string | null;
  leadId?: string | null;
  contactId?: string | null;
  title?: string | null;
};

function isRealFile(file: FormDataEntryValue | null): file is File {
  return typeof File !== "undefined" && file instanceof File && file.size > 0;
}

export function optionalFile(formData: FormData, key: string) {
  const file = formData.get(key);
  return isRealFile(file) ? file : null;
}

export function requiredFile(formData: FormData, key: string, message: string) {
  const file = optionalFile(formData, key);
  if (!file) throw new Error(message);
  return file;
}

export function validateUploadFile(file: File, bucket: UploadBucket) {
  const config = STORAGE_UPLOAD_CONFIG[bucket];
  const extension = MIME_EXTENSIONS[file.type as keyof typeof MIME_EXTENSIONS];
  if (!extension) throw new Error("Tipo de archivo no permitido. Usa PDF, JPG, PNG o WebP.");
  if (file.size <= 0) throw new Error("El archivo está vacío.");
  if (file.size > config.maxSizeBytes) throw new Error(`El archivo excede el límite de ${config.maxSizeBytes / 1024 / 1024} MB.`);
  if (!file.name?.trim()) throw new Error("El archivo necesita un nombre válido.");
  return { contentType: file.type, extension };
}

export function safeUploadSlug(input: string | null | undefined) {
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

export function uploadScope({ bookingId, leadId, contactId }: UploadContext) {
  if (bookingId) return `booking-${bookingId}`;
  if (leadId) return `lead-${leadId}`;
  if (contactId) return `contact-${contactId}`;
  return "unassigned";
}

export function buildStoragePath(bucket: UploadBucket, file: File, context: UploadContext, now = new Date(), uuid = crypto.randomUUID()) {
  const { extension } = validateUploadFile(file, bucket);
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const slug = safeUploadSlug(context.title ?? file.name);
  return `${bucket}/${uploadScope(context)}/${year}/${month}/${uuid}-${slug}.${extension}`;
}

export function sameStorageObject(current?: StoredObjectRef | null, next?: StoredObjectRef | null) {
  return Boolean(current?.bucket && current?.path && current.bucket === next?.bucket && current.path === next?.path);
}

export async function removeStoredObject(supabase: StorageClient, file?: StoredObjectRef | null) {
  if (!file?.bucket || !file.path) return false;
  const { error } = await supabase.storage.from(file.bucket).remove([file.path]);
  if (error) throw new Error(`No se pudo limpiar el archivo anterior: ${error.message}`);
  return true;
}

export async function removeStoredObjects(supabase: StorageClient, files: Array<StoredObjectRef | null | undefined>) {
  const grouped = new Map<string, string[]>();

  for (const file of files) {
    if (!file?.bucket || !file.path) continue;
    const paths = grouped.get(file.bucket) ?? [];
    if (!paths.includes(file.path)) paths.push(file.path);
    grouped.set(file.bucket, paths);
  }

  let removedAny = false;

  for (const [bucket, paths] of grouped.entries()) {
    const { error } = await supabase.storage.from(bucket).remove(paths);
    if (error) throw new Error(`No se pudo limpiar el archivo anterior: ${error.message}`);
    removedAny = true;
  }

  return removedAny;
}

export async function uploadPrivateFile(supabase: StorageClient, bucket: UploadBucket, file: File, context: UploadContext) {
  const { contentType } = validateUploadFile(file, bucket);
  const path = buildStoragePath(bucket, file, context);
  const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType, upsert: false });
  if (error) throw new Error(`No se pudo subir el archivo: ${error.message}`);

  return {
    bucket,
    path,
    cleanup: async () => {
      await removeStoredObject(supabase, { bucket, path });
    },
  };
}
