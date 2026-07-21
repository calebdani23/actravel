import { redirect } from "next/navigation";
import { ADMIN_NAV_ITEMS } from "@/components/admin/admin-nav";
import { AdminShellClient } from "@/components/admin/admin-shell-client";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABELS, hasAnyRole, type RoleName } from "@/lib/supabase/roles";
import type { AdminProfile } from "@/lib/admin/auth";

// Shared admin navigation still includes role-gated entries such as /admin/staff and /admin/account via ADMIN_NAV_ITEMS.

async function signOut() {
  "use server";

  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

export function AdminShell({ children, email, profile, roles }: Readonly<{ children: React.ReactNode; email: string; profile: AdminProfile; roles: RoleName[] }>) {
  const visibleLinks = ADMIN_NAV_ITEMS.filter((link) => hasAnyRole(roles, link.roles));

  return (
    <AdminShellClient
      email={email}
      profileName={profile.full_name}
      roleLabels={roles.map((role) => ROLE_LABELS[role])}
      signOutAction={signOut}
      visibleLinks={visibleLinks}
    >
      {children}
    </AdminShellClient>
  );
}
