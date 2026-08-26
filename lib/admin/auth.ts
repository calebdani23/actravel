import { hasAnyRole, type RoleName } from "@/lib/supabase/roles";
import { isAdminRouteAllowed } from "@/lib/admin/manager-boundary";
export { normalizeActiveRoles } from "@/lib/admin/role-normalization";

export type AdminProfile = { id: string; full_name: string; is_active: boolean };
export type AdminSession = {
  user: { id: string; email?: string };
  profile: AdminProfile;
  roles: RoleName[];
};

export type AdminSessionLoader = () => Promise<AdminSession | null>;

export async function getUserRoles(userId: string) {
  return (await import("@/lib/admin/auth-session")).getUserRoles(userId);
}

export async function getAdminSession(): Promise<AdminSession | null> {
  return (await import("@/lib/admin/auth-session")).getAdminSession();
}

export type AdminAuthActions = {
  redirect: (path: string) => never;
  notFound: () => never;
};

async function productionActions(): Promise<AdminAuthActions> {
  return import("next/navigation").then(({ redirect, notFound }) => ({ redirect, notFound }));
}

export async function requireAdminRole(allowed?: readonly RoleName[], loadSession: AdminSessionLoader = getAdminSession, actions?: AdminAuthActions): Promise<AdminSession> {
  const session = await loadSession();

  if (!session) {
    const boundary = actions ?? await productionActions();
    return boundary.redirect("/admin/login");
  }
  if (allowed && !hasAnyRole(session.roles, allowed)) {
    const boundary = actions ?? await productionActions();
    return boundary.notFound();
  }

  return session;
}

/**
 * Authorizes a concrete protected page before that page starts its own reads.
 * The allowlist remains the source of existing role semantics; this adds only
 * the bounded Manager-only route boundary.
 */
export async function requireAdminRoute(pathname: string, allowed?: readonly RoleName[], loadSession: AdminSessionLoader = getAdminSession, actions?: AdminAuthActions): Promise<AdminSession> {
  const session = await requireAdminRole(allowed, loadSession, actions);
  if (!isAdminRouteAllowed(session.roles, pathname)) (actions ?? await productionActions()).notFound();
  return session;
}
