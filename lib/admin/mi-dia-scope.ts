import { normalizeRoleNames, type RoleName } from "@/lib/supabase/roles"

export type MiDiaScope = "self" | "team" | "all"

export function resolveMiDiaScope(values: readonly string[]): MiDiaScope | null {
  const roles = normalizeRoleNames(values)
  if (roles.includes("admin")) return "all"
  if (roles.includes("manager")) return "team"
  return roles.includes("asesor") ? "self" : null
}

export function recognizedMiDiaRoles(values: readonly string[]): RoleName[] {
  return normalizeRoleNames(values)
}
