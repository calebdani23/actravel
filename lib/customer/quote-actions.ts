import "server-only";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCustomerIdentity, type CustomerIdentity } from "./portal";
import { portalUuid } from "./quotes";
import { createClient } from "@/lib/supabase/server";

const failureSchema = z.object({ ok: z.literal(false), code: z.enum([
  "ACCESS_DENIED", "INVALID_INPUT", "NOT_AVAILABLE", "CONFLICT", "STALE_QUOTE",
  "ACCEPTED_PROPOSAL_EXISTS", "TERMS_REQUIRED", "TERMS_CHANGED", "RATE_LIMITED", "PERSISTENCE_FAILURE",
]) }).strict();
type Failure = z.infer<typeof failureSchema>;
const failure = (code: Failure["code"] = "PERSISTENCE_FAILURE"): Failure => ({ ok: false, code });
const base = z.object({ requestId: portalUuid, quoteId: portalUuid, versionId: portalUuid,
  expectedLock: z.number().int().min(0).max(2147483647) }).strict();
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const acceptInput = base.extend({ termsId: portalUuid, termsHash: digest, documentHash: digest, consent: z.literal(true) });
const changeInput = base.extend({ body: z.string().trim().refine(body => [...body].length >= 1
  && [...body].length <= 2000 && Buffer.byteLength(body, "utf8") <= 8000
  && !body.includes("\0") && !/[\uD800-\uDFFF]/u.test(body)) });
const accepted = z.object({ ok: z.literal(true), acceptanceId: portalUuid, acceptedAt: z.string().datetime({ precision: 6 }) }).strict();
const requested = z.object({ ok: z.literal(true), requestId: portalUuid }).strict();
export type CustomerQuoteActionDependencies = {
  identity(): Promise<CustomerIdentity | null>;
  rpc(name: string, args: Record<string, string | number | boolean>): Promise<{ data: unknown; error: unknown }>;
  revalidate(path: string): void;
};
const production: CustomerQuoteActionDependencies = {
  identity: getCustomerIdentity,
  rpc: async (name, args) => (await createClient()).rpc(name, args),
  revalidate: revalidatePath,
};

async function mutate<I extends { quoteId: string }, O>(input: unknown, schema: z.ZodType<I>, resultSchema: z.ZodType<O>,
  name: string, args: (value: I) => Record<string, string | number | boolean>, deps: CustomerQuoteActionDependencies): Promise<O | Failure> {
  try {
    if (!await deps.identity()) return failure("ACCESS_DENIED");
    const parsed = schema.safeParse(input);
    if (!parsed.success) return failure("INVALID_INPUT");
    const { data, error } = await deps.rpc(name, args(parsed.data));
    if (error) return failure();
    const denied = failureSchema.safeParse(data);
    if (denied.success) return denied.data;
    const result = resultSchema.safeParse(data);
    if (!result.success) return failure();
    for (const path of ["/mis-viajes/cotizaciones", `/mis-viajes/cotizaciones/${parsed.data.quoteId}`,
      "/admin/quotes", `/admin/quotes/${parsed.data.quoteId}`, "/admin/customer-quote-work", "/admin/dashboard"]) deps.revalidate(path);
    return result.data;
  } catch { return failure(); }
}

export async function acceptCustomerQuote(input: unknown, deps = production) {
  return mutate(input, acceptInput, accepted, "accept_customer_quote", value => ({
    p_request_id: value.requestId, p_quote_id: value.quoteId, p_version_id: value.versionId, p_expected_lock: value.expectedLock,
    p_terms_id: value.termsId, p_terms_hash: value.termsHash, p_document_hash: value.documentHash, p_consent: value.consent,
  }), deps);
}

export async function requestCustomerQuoteChange(input: unknown, deps = production) {
  return mutate(input, changeInput, requested, "request_customer_quote_change", value => ({
    p_request_id: value.requestId, p_quote_id: value.quoteId, p_version_id: value.versionId,
    p_expected_lock: value.expectedLock, p_body: value.body,
  }), deps);
}
