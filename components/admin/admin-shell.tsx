import { redirect } from "next/navigation";
import { getVisibleAdminNavItems } from "@/components/admin/admin-nav";
import { AdminShellClient } from "@/components/admin/admin-shell-client";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABELS, type RoleName } from "@/lib/supabase/roles";
import type { AdminProfile } from "@/lib/admin/auth";

async function signOut() {
  "use server";

  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

export function AdminShell({ children, email, profile, roles }: Readonly<{ children: React.ReactNode; email: string; profile: AdminProfile; roles: RoleName[] }>) {
  const visibleLinks = getVisibleAdminNavItems(roles);

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
