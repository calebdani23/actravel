import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ManualLeadForm } from "@/components/admin/leads/manual-lead-form";
import { requireAdminRole } from "@/lib/admin/auth";
import { getAdvisors } from "@/lib/admin/leads";
import { hasRole } from "@/lib/supabase/roles";

export default async function NewLeadPage() {
  const session = await requireAdminRole(["admin", "asesor"]);
  const allowAssignment = hasRole(session.roles, "admin");
  const advisors = allowAssignment ? await getAdvisors() : [];
  const defaultSource = allowAssignment ? "manual_admin" : "manual_asesor";

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-8">
      <div>
        <Link className="text-sm font-semibold text-[var(--ac-blue)] hover:underline" href="/admin/leads">← Volver a prospectos</Link>
        <h1 className="mt-2 text-3xl font-bold">Nuevo prospecto</h1>
        <p className="mt-2 text-muted-foreground">Crea un prospecto manual sin disparar flujos automáticos de cotización o correo electrónico.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Captura manual</CardTitle>
        </CardHeader>
        <CardContent>
          <ManualLeadForm advisors={advisors} allowAssignment={allowAssignment} defaultSource={defaultSource} />
        </CardContent>
      </Card>
    </main>
  );
}
