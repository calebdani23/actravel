import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABELS, hasAnyRole, type RoleName } from "@/lib/supabase/roles";
import type { AdminProfile } from "@/lib/admin/auth";

const adminLinks = [
  { href: "/admin/dashboard", label: "Dashboard", roles: ["admin", "asesor", "operaciones", "finanzas", "marketing"] },
  { href: "/admin/leads", label: "Leads", roles: ["admin", "asesor"] },
  { href: "/admin/payments", label: "Pagos", roles: ["admin", "finanzas"] },
  { href: "/admin/operations/bookings", label: "Reservas", roles: ["admin", "operaciones"] },
  { href: "/admin/operations/documents", label: "Documentos", roles: ["admin", "operaciones"] },
  { href: "/admin/catalog/destinations", label: "Catálogo", roles: ["admin", "marketing"] },
  { href: "/admin/templates", label: "Plantillas", roles: ["admin", "marketing"] },
  { href: "/admin/logs", label: "Logs", roles: ["admin", "marketing", "asesor"] },
] satisfies { href: string; label: string; roles: RoleName[] }[];

async function signOut() {
  "use server";

  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

export function AdminShell({ children, email, profile, roles }: Readonly<{ children: React.ReactNode; email: string; profile: AdminProfile; roles: RoleName[] }>) {
  const visibleLinks = adminLinks.filter((link) => hasAnyRole(roles, link.roles));

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
          <Link href="/admin/dashboard" className="font-bold">
            AC Travel Admin
          </Link>
          <nav className="flex flex-wrap gap-4 text-sm font-medium">
            {visibleLinks.map((link) => (
              <Link key={link.href} href={link.href} className="text-zinc-700 hover:text-zinc-950">
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-600">
            <span>
              {profile.full_name || email} · {roles.map((role) => ROLE_LABELS[role]).join(", ")}
            </span>
            <form action={signOut}>
              <Button size="sm" variant="outline" type="submit">
                Salir
              </Button>
            </form>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
