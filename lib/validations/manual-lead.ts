import { z } from "zod";
import { hasRole, type RoleName } from "@/lib/supabase/roles";
import { normalizeEmail, normalizeWhatsApp } from "@/lib/validations/quote-request";

export const manualLeadPriorityValues = ["low", "normal", "high", "urgent"] as const;
export const manualLeadSourceValues = ["manual_admin", "manual_asesor", "phone_call", "whatsapp_manual", "instagram_dm", "referral", "walk_in"] as const;

const requiredString = z.string().trim().min(1).max(180);
const optionalString = z.string().trim().max(2000).optional();

export const manualLeadSchema = z.object({
  name: requiredString,
  phone: z.string().trim().max(40).optional(),
  email: z.string().trim().max(180).optional(),
  source: z.enum(manualLeadSourceValues).optional(),
  notes: optionalString,
  priority: z.enum(manualLeadPriorityValues).optional(),
  destination: z.string().trim().max(180).optional(),
  service: z.string().trim().max(180).optional(),
  travelStartDate: z.string().trim().max(20).optional(),
  travelEndDate: z.string().trim().max(20).optional(),
  travelersCount: z.coerce.number().int().min(1).max(30).optional(),
  budgetAmount: z.coerce.number().min(0).max(999999999).optional(),
  budgetCurrency: z.enum(["MXN", "USD"]).optional(),
  assignedTo: z.string().uuid().optional().or(z.literal("")),
}).superRefine((value, ctx) => {
  const normalizedPhone = value.phone ? normalizeWhatsApp(value.phone) : "";
  const normalizedEmail = normalizeEmail(value.email);
  if (!normalizedPhone && !normalizedEmail) {
    ctx.addIssue({ code: "custom", path: ["phone"], message: "Phone or email is required" });
  }
  if (value.phone && normalizedPhone.length > 0 && normalizedPhone.length < 10) {
    ctx.addIssue({ code: "custom", path: ["phone"], message: "Phone must contain at least 10 digits" });
  }
  if (value.email && !normalizedEmail) {
    ctx.addIssue({ code: "custom", path: ["email"], message: "Email must be valid" });
  }
});

export type ManualLeadInput = z.infer<typeof manualLeadSchema>;

export type ManualLeadNormalized = {
  name: string;
  phone: string | null;
  email: string | null;
  source: string;
  notes: string | null;
  priority: (typeof manualLeadPriorityValues)[number];
  destination: string | null;
  service: string | null;
  travelStartDate: string | null;
  travelEndDate: string | null;
  travelersCount: number;
  budgetMxn: number | null;
  budgetUsd: number | null;
  assignedTo: string | null;
};

export function normalizeManualLeadInput(input: ManualLeadInput, session: { user: { id: string }; roles: readonly RoleName[] }): ManualLeadNormalized {
  const sourceDefault = hasRole(session.roles, "asesor") && !hasRole(session.roles, "admin") ? "manual_asesor" : "manual_admin";
  const assignedTo = hasRole(session.roles, "asesor") && !hasRole(session.roles, "admin") ? session.user.id : input.assignedTo || null;
  return {
    name: input.name.trim(),
    phone: input.phone ? normalizeWhatsApp(input.phone) || null : null,
    email: normalizeEmail(input.email) ?? null,
    source: input.source ?? sourceDefault,
    notes: input.notes?.trim() || null,
    priority: input.priority ?? "normal",
    destination: input.destination?.trim() || null,
    service: input.service?.trim() || null,
    travelStartDate: input.travelStartDate?.trim() || null,
    travelEndDate: input.travelEndDate?.trim() || null,
    travelersCount: input.travelersCount ?? 1,
    budgetMxn: input.budgetAmount !== undefined && input.budgetCurrency === "MXN" ? input.budgetAmount : null,
    budgetUsd: input.budgetAmount !== undefined && input.budgetCurrency === "USD" ? input.budgetAmount : null,
    assignedTo,
  };
}

export function parseManualLeadFormData(formData: FormData, session: { user: { id: string }; roles: readonly RoleName[] }) {
  const parsed = manualLeadSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    source: formData.get("source"),
    notes: formData.get("notes"),
    priority: formData.get("priority"),
    destination: formData.get("destination"),
    service: formData.get("service"),
    travelStartDate: formData.get("travelStartDate"),
    travelEndDate: formData.get("travelEndDate"),
    travelersCount: formData.get("travelersCount") || undefined,
    budgetAmount: formData.get("budgetAmount") || undefined,
    budgetCurrency: formData.get("budgetCurrency") || undefined,
    assignedTo: formData.get("assignedTo") || undefined,
  });

  if (!parsed.success) return parsed;
  return { success: true as const, data: normalizeManualLeadInput(parsed.data, session) };
}
