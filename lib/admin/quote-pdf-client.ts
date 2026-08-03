export const QUOTE_PDF_BUCKET = "quote-pdfs";
export const QUOTE_PDF_MIME_TYPE = "application/pdf";
export const QUOTE_PDF_MAX_SIZE_BYTES = 20 * 1024 * 1024;

const PDF_MAGIC = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);

export function hasPdfMagicSignature(bytes: Uint8Array) {
  return PDF_MAGIC.every((byte, index) => bytes[index] === byte);
}

function hexDigest(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function validateQuotePdfInBrowser(file: File) {
  if (file.type !== QUOTE_PDF_MIME_TYPE) throw new Error("La cotización debe usar el tipo application/pdf.");
  if (!file.name.toLowerCase().endsWith(".pdf")) throw new Error("La cotización debe tener extensión .pdf.");
  if (file.size < 1) throw new Error("El PDF de la cotización está vacío.");
  if (file.size > QUOTE_PDF_MAX_SIZE_BYTES) throw new Error("El PDF de la cotización excede el límite de 20 MB.");

  const magic = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  if (!hasPdfMagicSignature(magic)) throw new Error("El archivo no contiene una firma PDF válida.");
  const sha256 = hexDigest(await globalThis.crypto.subtle.digest("SHA-256", await file.arrayBuffer()));

  return { byteSize: file.size, mimeType: QUOTE_PDF_MIME_TYPE, sha256 };
}
