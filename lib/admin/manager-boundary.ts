import { hasRole } from "@/lib/supabase/roles";

export function isManagerOnlySession(roles: readonly string[]) {
  return hasRole(roles, "manager") && !hasRole(roles, "admin") && roles.every((role) => role === "manager");
}

export function isAdminRouteAllowed(roles: readonly string[], pathname: string) {
  if (!isManagerOnlySession(roles)) return true;
  return pathname === "/admin/dashboard" || pathname === "/admin/account";
}
