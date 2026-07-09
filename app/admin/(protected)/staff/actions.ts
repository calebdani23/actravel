"use server";

import { revalidatePath } from "next/cache";
import { initialStaffCreateActionState, type StaffCreateActionState, type StaffUpdateActionState } from "@/app/admin/(protected)/staff/action-state";
import { requireAdminRole } from "@/lib/admin/auth";
import { createStaffAccount, updateStaffAccount } from "@/lib/admin/staff";
import { parseCreateStaffFormData, parseUpdateStaffFormData } from "@/lib/validations/staff";

function revalidateStaffPages() {
  revalidatePath("/admin/staff");
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/leads");
  revalidatePath("/admin/leads/new");
  revalidatePath("/admin/operations/bookings");
  revalidatePath("/admin/payments");
}

export async function createStaffAction(_previous: StaffCreateActionState, formData: FormData): Promise<StaffCreateActionState> {
  const session = await requireAdminRole(["admin"]);
  const parsed = parseCreateStaffFormData(formData);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Review the highlighted fields.",
      fieldErrors: parsed.fieldErrors,
      values: {
        email: parsed.values.email,
        full_name: parsed.values.full_name,
        role: parsed.values.role === "admin" ? "admin" : "asesor",
        is_active: parsed.values.is_active,
      },
    };
  }

  try {
    await createStaffAccount(parsed.data, { id: session.user.id, email: session.user.email, roles: session.roles });
    revalidateStaffPages();
    return {
      ok: true,
      message: `Staff account created for ${parsed.data.email}. Share the initial password through an approved secure manual channel.`,
      fieldErrors: {},
      values: initialStaffCreateActionState.values,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not create the staff account.",
      fieldErrors: {},
      values: { email: parsed.data.email, full_name: parsed.data.full_name, role: parsed.data.role, is_active: parsed.data.is_active },
    };
  }
}

export async function updateStaffAction(_previous: StaffUpdateActionState, formData: FormData): Promise<StaffUpdateActionState> {
  const session = await requireAdminRole(["admin"]);
  const parsed = parseUpdateStaffFormData(formData);
  if (!parsed.success) {
    return { ok: false, message: "Review the highlighted fields.", fieldErrors: parsed.fieldErrors };
  }

  try {
    await updateStaffAccount(parsed.data, { id: session.user.id, email: session.user.email, roles: session.roles });
    revalidateStaffPages();
    return { ok: true, message: "Staff account updated.", fieldErrors: {} };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Could not update the staff account.", fieldErrors: {} };
  }
}
