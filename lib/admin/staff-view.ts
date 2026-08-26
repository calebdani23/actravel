import { formatAdminDateTime } from "@/lib/admin/format";

export function staffRoleLabel(role?: string | null) {
  if (role === "admin") return "Administración";
  if (role === "manager") return "Gerencia";
  if (role === "asesor") return "Asesoría";
  if (role === "marketing") return "Marketing";
  if (role === "operaciones") return "Operaciones";
  if (role === "finanzas") return "Finanzas";
  return "No identificado";
}

export function staffActiveStateLabel(active: boolean) {
  return active ? "Activo" : "Inactivo";
}

export function staffRolesSummary(roles: string[]) {
  if (!roles.length) return "No identificado";
  return roles.map((role) => staffRoleLabel(role)).join(", ");
}

export function staffManagementNote(blockReason?: string | null) {
  return blockReason ?? "El acceso activo solo controla el uso del panel AC Travel. No modifica el buzón ni revela detalles internos del proveedor de autenticación.";
}

export function staffLastActivityLabel(updatedAt?: string | null) {
  return updatedAt ? `Última actualización ${formatAdminDateTime(updatedAt)}` : "Actividad no identificada";
}

export function staffAuditActionLabel(action: string) {
  return {
    staff_created: "Usuario creado",
    staff_create_failed: "Intento de creación con incidencia",
    staff_updated: "Perfil actualizado",
    staff_deactivated: "Acceso desactivado",
    staff_reactivated: "Acceso reactivado",
    staff_role_changed: "Rol actualizado",
    staff_deleted: "Cuenta eliminada",
    staff_password_changed: "Contraseña actualizada",
    staff_email_change_requested: "Cambio de correo solicitado",
  }[action] ?? "Actividad no identificada";
}
