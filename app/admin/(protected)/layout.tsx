import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdminRole } from "@/lib/admin/auth";

export default async function ProtectedAdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await requireAdminRole();

  return <AdminShell email={session.user.email ?? ""} profile={session.profile} roles={session.roles}>{children}</AdminShell>;
}
