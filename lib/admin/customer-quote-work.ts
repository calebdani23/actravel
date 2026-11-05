import "server-only";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdminRole } from "./auth";
import type { TaskActionCancelReason } from "./task-actions";
import type { RoleName } from "@/lib/supabase/roles";
import { createClient } from "@/lib/supabase/server";
import { portalUuid } from "@/lib/customer/quotes";

const timestamp = z.string().datetime({ precision: 6 });
const failureSchema = z.object({ ok: z.literal(false), code: z.enum([
  "ACCESS_DENIED", "INVALID_INPUT", "NOT_AVAILABLE", "ACTION_UNAVAILABLE", "PERSISTENCE_FAILURE",
]) }).strict();
type Failure = z.infer<typeof failureSchema>;
const failure = (code: Failure["code"] = "PERSISTENCE_FAILURE"): Failure => ({ ok: false, code });
const itemSchema = z.object({ eventId: portalUuid, quoteId: portalUuid, number: z.string().max(80),
  versionNumber: z.number().int().positive(), versionStatus: z.enum(["draft", "ready", "sent", "accepted", "rejected", "expired", "cancelled", "superseded"]),
  kind: z.enum(["acceptance_handoff", "quote_change"]), body: z.string().refine(value => [...value].length <= 2000 && Buffer.byteLength(value, "utf8") <= 8000).nullable(),
  source: z.enum(["customer", "staff"]), acceptanceId: portalUuid.nullable(), dueAt: timestamp,
  taskId: portalUuid.nullable(), taskStatus: z.enum(["pending", "in_progress", "completed", "canceled"]).nullable(),
  canManage: z.boolean(), canClaim: z.boolean(),
}).strict().refine(row => (row.taskId === null) === (row.taskStatus === null)
  && (!row.canManage || row.taskId !== null) && (!row.canClaim || row.taskId === null)
  && (row.kind === "quote_change" ? row.source === "customer" && row.body !== null && row.acceptanceId === null
    : row.body === null && (row.source === "customer") === (row.acceptanceId !== null)));
export type QuoteWorkItem = z.infer<typeof itemSchema>;
const pageSchema = z.object({ ok: z.literal(true), items: z.array(itemSchema).max(20),
  next: z.object({ createdAt: timestamp, eventId: portalUuid }).strict().nullable() }).strict();
const cursorSchema = z.object({ before: timestamp.nullable(), after: portalUuid.nullable() }).strict()
  .refine(value => (value.before === null) === (value.after === null));
const claimed = z.object({ ok: z.literal(true), taskId: portalUuid }).strict();
const managed = claimed.extend({ receiptId: portalUuid });
const reasons = ["no_longer_needed", "duplicate", "source_invalidated", "other"] as const satisfies readonly TaskActionCancelReason[];
const manageInput = z.object({ eventId: portalUuid, requestId: portalUuid,
  targetStatus: z.enum(["in_progress", "completed", "canceled"]), cancelReason: z.enum(reasons).nullable(),
}).strict().refine(value => (value.targetStatus === "canceled") === (value.cancelReason !== null));
export type QuoteWorkDependencies = {
  authorize(roles: readonly RoleName[]): Promise<unknown>;
  rpc(name: string, args: Record<string, string | null>): Promise<{ data: unknown; error: unknown }>;
  revalidate(path: string, type?: "layout"): void;
};
const production: QuoteWorkDependencies = {
  authorize: requireAdminRole,
  rpc: async (name, args) => (await createClient()).rpc(name, args),
  revalidate: revalidatePath,
};
async function invoke<T>(name: string, args: Record<string, string | null>, schema: z.ZodType<T>, deps: QuoteWorkDependencies): Promise<T | Failure> {
  try {
    const { data, error } = await deps.rpc(name, args);
    if (error) return failure();
    const denied = failureSchema.safeParse(data);
    if (denied.success) return denied.data;
    const result = schema.safeParse(data);
    return result.success ? result.data : failure();
  } catch { return failure(); }
}
function refresh(deps: QuoteWorkDependencies) {
  deps.revalidate("/admin/customer-quote-work");
  deps.revalidate("/admin/dashboard");
  deps.revalidate("/admin/quotes", "layout");
  deps.revalidate("/mis-viajes/cotizaciones", "layout");
}
export async function readCustomerQuoteWork(input: { before?: unknown; after?: unknown }, deps = production) {
  await deps.authorize(["admin", "asesor", "operaciones"]);
  const parsed = cursorSchema.safeParse({ before: input.before ?? null, after: input.after ?? null });
  if (!parsed.success) return failure("INVALID_INPUT");
  return invoke("read_portal_quote_work", { p_before: parsed.data.before, p_after: parsed.data.after }, pageSchema, deps);
}
export async function claimCustomerQuoteWork(eventId: unknown, deps = production) {
  await deps.authorize(["admin"]);
  const parsed = portalUuid.safeParse(eventId);
  if (!parsed.success) return failure("INVALID_INPUT");
  const result = await invoke("claim_portal_quote_work", { p_event_id: parsed.data }, claimed, deps);
  if (result.ok) refresh(deps);
  return result;
}
export async function manageCustomerQuoteWork(input: unknown, deps = production) {
  await deps.authorize(["admin", "asesor"]);
  const parsed = manageInput.safeParse(input);
  if (!parsed.success) return failure("INVALID_INPUT");
  const value = parsed.data;
  const result = await invoke("manage_portal_quote_work", { p_event_id: value.eventId, p_request_id: value.requestId,
    p_target_status: value.targetStatus, p_cancel_reason: value.cancelReason }, managed, deps);
  if (result.ok) refresh(deps);
  return result;
}
