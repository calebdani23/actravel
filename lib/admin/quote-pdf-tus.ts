"use client";

import { Upload } from "tus-js-client";
import { createClient } from "@/lib/supabase/client";
import { QUOTE_PDF_MIME_TYPE } from "@/lib/admin/quote-pdf-client";

const TUS_CHUNK_SIZE_BYTES = 6 * 1024 * 1024;

export class QuotePdfUploadCancelledError extends Error {
  constructor() {
    super("La carga fue cancelada. Puedes continuarla con el mismo archivo.");
    this.name = "QuotePdfUploadCancelledError";
  }
}

export function quotePdfTusEndpoint(supabaseUrl: string) {
  const url = new URL(supabaseUrl);
  if (/^[a-z0-9-]+\.supabase\.co$/i.test(url.hostname)) {
    const projectRef = url.hostname.slice(0, -".supabase.co".length);
    return `${url.protocol}//${projectRef}.storage.supabase.co/storage/v1/upload/resumable`;
  }
  return new URL("storage/v1/upload/resumable", `${url.origin}/`).toString();
}

export function quotePdfTusErrorStatus(error: unknown) {
  if (!error || typeof error !== "object" || !("originalResponse" in error)) return null;
  const response = error.originalResponse as { getStatus?: () => number } | null;
  return typeof response?.getStatus === "function" ? response.getStatus() : null;
}

export function isDeterministicQuotePdfUploadError(error: unknown) {
  const status = quotePdfTusErrorStatus(error);
  return status !== null && [400, 403, 404, 413, 415].includes(status);
}

type QuotePdfTusUploadInput = {
  advisorySha256: string;
  bucket: string;
  file: File;
  intentId: string;
  path: string;
  signal?: AbortSignal;
  onProgress?: (uploadedBytes: number, totalBytes: number) => void;
};

export async function uploadQuotePdfWithTus(input: QuotePdfTusUploadInput) {
  const supabase = createClient();
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.access_token) throw new Error("Tu sesión expiró. Inicia sesión de nuevo antes de subir el PDF.");
  if (input.signal?.aborted) throw new QuotePdfUploadCancelledError();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !publishableKey) throw new Error("La carga directa de PDF no está configurada.");

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      input.signal?.removeEventListener("abort", cancel);
      callback();
    };
    const upload = new Upload(input.file, {
      endpoint: quotePdfTusEndpoint(supabaseUrl),
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        authorization: `Bearer ${session.access_token}`,
        apikey: publishableKey,
        "x-upsert": "false",
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      chunkSize: TUS_CHUNK_SIZE_BYTES,
      metadata: {
        bucketName: input.bucket,
        objectName: input.path,
        contentType: QUOTE_PDF_MIME_TYPE,
        cacheControl: "3600",
      },
      fingerprint: () => Promise.resolve(`ac-travel-quote-pdf:${input.intentId}:${input.path}:${input.file.size}:${input.advisorySha256}`),
      onProgress: (uploadedBytes, totalBytes) => input.onProgress?.(uploadedBytes, totalBytes),
      onError: (uploadError) => finish(() => reject(uploadError)),
      onSuccess: () => finish(resolve),
    });
    const cancel = () => {
      void upload.abort(false).finally(() => finish(() => reject(new QuotePdfUploadCancelledError())));
    };
    input.signal?.addEventListener("abort", cancel, { once: true });
    void upload.findPreviousUploads()
      .then((previousUploads) => {
        if (settled) return;
        if (previousUploads.length) upload.resumeFromPreviousUpload(previousUploads[0]);
        upload.start();
      })
      .catch((uploadError) => finish(() => reject(uploadError)));
  });
}

export async function removeFailedQuotePdfObject(bucket: string, path: string) {
  const result = await createClient().storage.from(bucket).remove([path]);
  return !result.error;
}
