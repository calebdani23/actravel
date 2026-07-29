"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdminRole } from "@/lib/admin/auth";
import { createLeadIntake, findCatalogId } from "@/lib/leads/lead-intake-core";
import { createClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/supabase/roles";
import { parseManualLeadFormData } from "@/lib/validations/manual-lead";

export type ManualLeadActionState = {
  ok: boolean;
  message: string | null;
  fieldErrors: Record<string, string[]>;
};

export async function createManualLeadAction(_previous: ManualLeadActionState, formData: FormData): Promise<ManualLeadActionState> {
  const session = await requireAdminRole(["admin", "asesor"]);
  const parsed = parseManualLeadFormData(formData, session);
  if (!parsed.success) {
    return { ok: false, message: "Revisa los campos obligatorios.", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const input = parsed.data;
  let leadId: string;
  if (hasRole(session.roles, "asesor") && !hasRole(session.roles, "admin") && input.assignedTo !== session.user.id) {
    return { ok: false, message: "Los asesores solo pueden crear leads asignados a sí mismos.", fieldErrors: { assignedTo: ["Assignment is restricted to the current advisor"] } };
  }

  try {
    const [destinationId, serviceId] = await Promise.all([
      input.destination ? findCatalogId(supabase as never, "destinations", input.destination, "es") : Promise.resolve(null),
      input.service ? findCatalogId(supabase as never, "services", input.service, "es") : Promise.resolve(null),
    ]);
    const created = await createLeadIntake(supabase as never, {
      contact: {
        name: input.name,
        phone: input.phone,
        email: input.email,
        preferredLocale: "es",
        source: input.source,
        notes: input.notes,
        consentMarketing: false,
      },
      lead: {
        assignedTo: input.assignedTo,
        source: input.source,
        priority: input.priority,
        summary: [input.name, input.destination, input.service].filter(Boolean).join(" · ") || `Manual lead · ${input.name}`,
        destinationId,
        destinationLabel: input.destination,
        serviceId,
        serviceLabel: input.service,
        travelStartDate: input.travelStartDate,
        travelEndDate: input.travelEndDate,
        travelersCount: input.travelersCount,
        budgetMxn: input.budgetMxn,
        budgetUsd: input.budgetUsd,
      },
      event: {
        actorId: session.user.id,
        eventType: "manual_lead_created",
        payload: {
          source: input.source,
          assignedTo: input.assignedTo,
          hasNote: Boolean(input.notes),
        },
      },
    });

    if (input.notes) {
      const { error } = await supabase.from("lead_notes").insert({ lead_id: created.leadId, author_id: session.user.id, body: input.notes, is_internal: true });
      if (error) throw error;
    }

    revalidatePath("/admin/leads");
    revalidatePath(`/admin/leads/${created.leadId}`);
    leadId = created.leadId;
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "No se pudo crear el lead manual.", fieldErrors: {} };
  }

  redirect(`/admin/leads/${leadId}`);
}
