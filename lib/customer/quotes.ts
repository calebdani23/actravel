import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCustomerIdentity, type CustomerIdentity } from "./portal";
import { hasPdfMagicSignature, QUOTE_PDF_MAX_SIZE_BYTES } from "@/lib/admin/quote-pdf-client";

export const portalUuid = z.string().regex(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/);
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const amount = z.number().finite().nonnegative().nullable();
const status = z.enum(["sent", "accepted", "rejected", "expired", "cancelled", "superseded"]);
const failureSchema = z.object({ ok: z.literal(false), code: z.enum(["ACCESS_DENIED", "NOT_AVAILABLE", "INVALID_INPUT", "PERSISTENCE_FAILURE"]) }).strict();
type Failure = z.infer<typeof failureSchema>;
const failure = (code: Failure["code"] = "PERSISTENCE_FAILURE"): Failure => ({ ok: false, code });
const versionSchema = z.object({ versionId: portalUuid, versionNumber: z.number().int().positive(), title: z.string().max(500),
  summary: z.string().max(10000).nullable(), currency: z.enum(["MXN", "USD"]), totalAmount: amount, depositAmount: amount,
  validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(), status }).strict();
const termsSchema = z.object({ termsId: portalUuid, revision: z.string().min(1).max(80), body: z.string().min(1), sha256: digest }).strict()
  .refine(value => Buffer.byteLength(value.body, "utf8") <= 16000 && createHash("sha256").update(value.body).digest("hex") === value.sha256);
const timestamp = z.string().datetime({ precision: 6 });
const pageSchema = z.object({ ok: z.literal(true), items: z.array(z.object({ quoteId: portalUuid, number: z.string().max(80),
  title: z.string().max(500), currency: z.enum(["MXN", "USD"]), totalAmount: amount, status }).strict()).max(50),
  next: z.object({ createdAt: timestamp, quoteId: portalUuid }).strict().nullable() }).strict();
const detailSchema = z.object({ ok: z.literal(true), quote: z.object({ quoteId: portalUuid, number: z.string().max(80), lockVersion: z.number().int().nonnegative() }).strict(),
  version: versionSchema.extend({ current: z.boolean(), canAccept: z.boolean(), canRequestChanges: z.boolean(),
    pdf: z.object({ documentId: portalUuid, sha256: digest, byteSize: z.number().int().positive().max(QUOTE_PDF_MAX_SIZE_BYTES) }).strict().nullable() }),
  history: z.array(versionSchema).max(20), nextBeforeVersion: z.number().int().positive().nullable(), terms: termsSchema.nullable(), acceptance: z.null() }).strict();
const pdfSchema = z.object({ ok: z.literal(true), pdf: z.object({ versionId: portalUuid, documentId: portalUuid,
  bucket: z.enum(["quote-pdfs", "documents"]), path: z.string().min(1).max(1024), sha256: digest,
  byteSize: z.number().int().positive().max(QUOTE_PDF_MAX_SIZE_BYTES) }).strict() }).strict();

export type QuoteDependencies = {
  identity(): Promise<CustomerIdentity | null>;
  rpc(name: string, args: Record<string, string | number | null>): Promise<{ data: unknown; error: unknown }>;
  download(bucket: string, path: string): Promise<Blob>;
};
function production(): QuoteDependencies {
  return {
    identity: getCustomerIdentity,
    rpc: async (name, args) => (await createClient()).rpc(name, args),
    download: async (bucket, path) => {
      const { data, error } = await createSupabaseAdminClient().storage.from(bucket).download(path);
      if (error || !data) throw new Error("PDF_UNAVAILABLE");
      return data;
    },
  };
}
async function read<T>(schema: z.ZodType<T>, name: string, args: Record<string, string | number | null>, deps: QuoteDependencies): Promise<T | Failure> {
  try {
    if (!await deps.identity()) return failure("ACCESS_DENIED");
    const { data, error } = await deps.rpc(name, args);
    if (error) return failure();
    const denied = failureSchema.safeParse(data);
    if (denied.success) return denied.data;
    const result = schema.safeParse(data);
    return result.success ? result.data : failure();
  } catch { return failure(); }
}

export async function customerQuotePage(input: { before?: unknown; after?: unknown }, deps = production()) {
  const before = input.before ?? null, after = input.after ?? null;
  if ((before === null) !== (after === null) || before !== null && (!timestamp.safeParse(before).success || !portalUuid.safeParse(after).success)) return failure("INVALID_INPUT");
  return read(pageSchema, "read_customer_quotes", { p_before: before as string | null, p_after: after as string | null, p_limit: 20 }, deps);
}
export async function customerQuoteDetail(quoteId: string, input: { versionId?: unknown; beforeVersion?: unknown }, deps = production()) {
  const version = input.versionId ?? null, before = input.beforeVersion ?? null;
  if (!portalUuid.safeParse(quoteId).success || version !== null && !portalUuid.safeParse(version).success
    || before !== null && !z.number().int().positive().safeParse(before).success) return failure("INVALID_INPUT");
  const result = await read(detailSchema, "read_customer_quote", { p_quote_id: quoteId, p_version_id: version as string | null, p_before_version: before as number | null }, deps);
  if (result.ok && (result.quote.quoteId !== quoteId || version !== null && result.version.versionId !== version)) return failure();
  return result;
}
function safePdfPath(pdf: z.infer<typeof pdfSchema>["pdf"]) {
  try {
    const decoded = decodeURIComponent(pdf.path);
    if (/[\\?#\x00-\x1f]/.test(decoded) || decoded.split("/").some(part => ["", ".", ".."].includes(part))) return false;
    if (pdf.bucket === "documents") return /\.pdf$/i.test(decoded);
    const parts = pdf.path.split("/");
    return parts.length === 9 && parts[0] === "contacts" && portalUuid.safeParse(parts[1]).success
      && parts[2] === "opportunities" && portalUuid.safeParse(parts[3]).success && parts[4] === "quotes"
      && portalUuid.safeParse(parts[5]).success && parts[6] === "versions" && parts[7] === pdf.versionId && parts[8] === `${pdf.documentId}.pdf`;
  } catch { return false; }
}
export async function customerQuotePdf(versionId: string, deps = production()): Promise<{ ok: true; bytes: ArrayBuffer } | Failure> {
  if (!portalUuid.safeParse(versionId).success) return failure("INVALID_INPUT");
  const result = await read(pdfSchema, "read_customer_quote_pdf", { p_version_id: versionId }, deps);
  if (!result.ok) return result;
  if (result.pdf.versionId !== versionId || !safePdfPath(result.pdf)) return failure();
  try {
    const blob = await deps.download(result.pdf.bucket, result.pdf.path);
    if (blob.size !== result.pdf.byteSize || blob.size > QUOTE_PDF_MAX_SIZE_BYTES) return failure();
    const bytes = await blob.arrayBuffer();
    if (!hasPdfMagicSignature(new Uint8Array(bytes)) || createHash("sha256").update(new Uint8Array(bytes)).digest("hex") !== result.pdf.sha256) return failure();
    return { ok: true, bytes };
  } catch { return failure(); }
}
