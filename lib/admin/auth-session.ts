import "server-only";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseBrowserConfigured } from "@/lib/supabase/config";
import { normalizeRoleNames } from "@/lib/supabase/roles";
import type { AdminProfile, AdminSession } from "@/lib/admin/auth";

type RoleRow = { roles?: { name?: string | null } | { name?: string | null }[] | null };

export async function getUserRoles(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("profile_roles").select("roles(name)").eq("profile_id", userId);
  if (error) return [];
  return normalizeRoleNames(((data ?? []) as RoleRow[])
    .flatMap((row) => (Array.isArray(row.roles) ? row.roles : row.roles ? [row.roles] : []))
    .map((role) => role.name ?? ""));
}

export async function getAdminSession(): Promise<AdminSession | null> {
  if (!isSupabaseBrowserConfigured()) return null;
  const supabase = await createClient();
  const { data: userResult, error: userError } = await supabase.auth.getUser();
  const user = userResult.user;
  if (userError || !user) return null;
  const [{ data: profile }, roles] = await Promise.all([
    supabase.from("profiles").select("id, full_name, is_active").eq("id", user.id).maybeSingle(),
    getUserRoles(user.id),
  ]);
  if (!profile?.is_active || roles.length === 0) return null;
  return { user: { id: user.id, email: user.email ?? undefined }, profile: profile as AdminProfile, roles };
}
