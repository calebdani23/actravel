"use server";

import { revalidatePath } from "next/cache";
import { initialStaffCreateActionState, type StaffCreateActionState, type StaffDeleteActionState, type StaffUpdateActionState } from "@/app/admin/(protected)/staff/action-state";
import { requireAdminRole } from "@/lib/admin/auth";
import { createStaffAccount, deleteStaffAccount, updateStaffAccount } from "@/lib/admin/staff";
import { parseCreateStaffFormData, parseDeleteStaffFormData, parseUpdateStaffFormData } from "@/lib/validations/staff";

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
      message: "Revisa los campos marcados.",
      fieldErrors: parsed.fieldErrors,
      values: {
        email: parsed.values.email,
        full_name: parsed.values.full_name,
         role: parsed.values.role === "admin" || parsed.values.role === "manager" ? parsed.values.role : "asesor",
        is_active: parsed.values.is_active,
      },
    };
  }

  try {
    await createStaffAccount(parsed.data, { id: session.user.id, email: session.user.email, roles: session.roles });
    revalidateStaffPages();
    return {
      ok: true,
      message: `Usuario creado para ${parsed.data.email}. Comparte la contraseña inicial por un canal manual aprobado.`,
      fieldErrors: {},
      values: initialStaffCreateActionState.values,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "No se pudo crear el usuario.",
      fieldErrors: {},
      values: { email: parsed.data.email, full_name: parsed.data.full_name, role: parsed.data.role, is_active: parsed.data.is_active },
    };
  }
}

export async function updateStaffAction(_previous: StaffUpdateActionState, formData: FormData): Promise<StaffUpdateActionState> {
  const session = await requireAdminRole(["admin"]);
  const parsed = parseUpdateStaffFormData(formData);
  if (!parsed.success) {
    return { ok: false, message: "Revisa los campos marcados.", fieldErrors: parsed.fieldErrors };
  }

  try {
    await updateStaffAccount(parsed.data, { id: session.user.id, email: session.user.email, roles: session.roles });
    revalidateStaffPages();
    return { ok: true, message: "Usuario actualizado.", fieldErrors: {} };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "No se pudo actualizar el usuario.", fieldErrors: {} };
  }
}

export async function deleteStaffAction(_previous: StaffDeleteActionState, formData: FormData): Promise<StaffDeleteActionState> {
  const session = await requireAdminRole(["admin"]);
  const parsed = parseDeleteStaffFormData(formData);
  if (!parsed.success) {
    return { ok: false, message: "Selección de usuario no válida.", fieldErrors: parsed.fieldErrors };
  }

  try {
    await deleteStaffAccount(parsed.data, { id: session.user.id, email: session.user.email, roles: session.roles });
    revalidateStaffPages();
    return { ok: true, message: "Usuario eliminado de forma permanente.", fieldErrors: {} };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "No se pudo eliminar el usuario de forma permanente.", fieldErrors: {} };
  }
}
