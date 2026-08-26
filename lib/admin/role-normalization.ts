import { normalizeRoleNames } from "@/lib/supabase/roles";

export function normalizeActiveRoles(values: readonly string[] | null | undefined, isActive: boolean) {
  return isActive ? normalizeRoleNames(values) : [];
}
