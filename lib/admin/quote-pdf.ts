import "server-only";

import { createHash } from "node:crypto";
import {
  hasPdfMagicSignature,
  QUOTE_PDF_BUCKET,
  QUOTE_PDF_MAX_SIZE_BYTES,
  QUOTE_PDF_MIME_TYPE,
} from "@/lib/admin/quote-pdf-client";

export { hasPdfMagicSignature, QUOTE_PDF_BUCKET, QUOTE_PDF_MAX_SIZE_BYTES, QUOTE_PDF_MIME_TYPE };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export type QuotePdfPathScope = {
  contactId: string;
  documentId: string;
  opportunityId: string;
  quoteId: string;
  versionId: string;
};

function canonicalUuid(value: string, field: keyof QuotePdfPathScope) {
  if (!UUID_PATTERN.test(value)) throw new Error(`Identificador inválido para ${field}.`);
  return value.toLowerCase();
}

export function buildQuotePdfPath(scope: QuotePdfPathScope) {
  const contactId = canonicalUuid(scope.contactId, "contactId");
  const opportunityId = canonicalUuid(scope.opportunityId, "opportunityId");
  const quoteId = canonicalUuid(scope.quoteId, "quoteId");
  const versionId = canonicalUuid(scope.versionId, "versionId");
  const documentId = canonicalUuid(scope.documentId, "documentId");

  return `contacts/${contactId}/opportunities/${opportunityId}/quotes/${quoteId}/versions/${versionId}/${documentId}.pdf`;
}

export function quotePdfSha256(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

export async function validateQuotePdfFile(file: File) {
  if (file.type !== QUOTE_PDF_MIME_TYPE) throw new Error("La cotización debe usar el tipo application/pdf.");
  if (!file.name.toLowerCase().endsWith(".pdf")) throw new Error("La cotización debe tener extensión .pdf.");
  if (file.size < 1) throw new Error("El PDF de la cotización está vacío.");
  if (file.size > QUOTE_PDF_MAX_SIZE_BYTES) throw new Error("El PDF de la cotización excede el límite de 20 MB.");

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!hasPdfMagicSignature(bytes)) throw new Error("El archivo no contiene una firma PDF válida.");

  return {
    byteSize: bytes.byteLength,
    mimeType: QUOTE_PDF_MIME_TYPE,
    sha256: quotePdfSha256(bytes),
  };
}

export async function validateDownloadedQuotePdf(blob: Blob, expectedSizeBytes: number) {
  if (blob.type !== QUOTE_PDF_MIME_TYPE) throw new Error("trusted_pdf_mime_invalid");
  if (blob.size < 1 || blob.size > QUOTE_PDF_MAX_SIZE_BYTES || blob.size !== expectedSizeBytes) {
    throw new Error("trusted_pdf_size_invalid");
  }
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (!hasPdfMagicSignature(bytes)) throw new Error("trusted_pdf_signature_invalid");
  return { byteSize: bytes.byteLength, mimeType: QUOTE_PDF_MIME_TYPE, sha256: quotePdfSha256(bytes) };
}
