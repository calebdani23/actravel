import { OperationDialog } from "@/components/admin/operations/operation-dialog";
import { StaffCreateForm } from "@/components/admin/staff/staff-create-form";
import { StaffList } from "@/components/admin/staff/staff-list";
import { EmptyState, MetricCard, PageContainer, PageHeader, SectionCard } from "@/components/admin/admin-primitives";
import { requireAdminRole } from "@/lib/admin/auth";
import { formatAdminDateTime, formatAdminInteger } from "@/lib/admin/format";
import { getStaffAccounts, getStaffAuditEvents } from "@/lib/admin/staff";
import { staffAuditActionLabel } from "@/lib/admin/staff-view";

function summaryCounts(staff: Awaited<ReturnType<typeof getStaffAccounts>>) {
  return {
    total: staff.length,
    active: staff.filter((row) => row.is_active).length,
    inactive: staff.filter((row) => !row.is_active).length,
    admins: staff.filter((row) => row.roles.includes("admin")).length,
  };
}

export default async function StaffPage() {
  await requireAdminRole(["admin"]);
  const [staff, events] = await Promise.all([getStaffAccounts(), getStaffAuditEvents(20)]);
  const counts = summaryCounts(staff);

  return (
    <PageContainer>
      <PageHeader
        actions={<OperationDialog description="Crea un nuevo acceso interno sin salir del módulo." title="Nuevo usuario interno" triggerLabel="Nuevo usuario"><StaffCreateForm /></OperationDialog>}
        breadcrumbs={[{ label: "Panel", href: "/admin/dashboard" }, { label: "Usuarios" }]}
        description="Administra accesos internos del panel AC Travel. El buzón se gestiona por fuera y aquí solo se controla el acceso operativo de perfiles internos."
        eyebrow="Administración interna"
        title="Usuarios y staff"
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard detail="Registros internos visibles para esta sesión." label="Total" tone="neutral" value={formatAdminInteger(counts.total)} />
        <MetricCard detail="Con acceso activo al panel." label="Activos" tone="success" value={formatAdminInteger(counts.active)} />
        <MetricCard detail="Con acceso bloqueado hasta reactivación." label="Inactivos" tone="warning" value={formatAdminInteger(counts.inactive)} />
        <MetricCard detail="Perfiles con rol de administración visible." label="Administración" tone="brand" value={formatAdminInteger(counts.admins)} />
      </section>

      <SectionCard description="Revisa primero el estado actual de cada usuario. Desde aquí puedes abrir edición o confirmación de eliminación sin cambiar contratos del servidor." title={`${formatAdminInteger(staff.length)} registro(s) visibles`}>
        <StaffList staff={staff} />
      </SectionCard>

      <SectionCard description="Pasos operativos para dar de alta un acceso interno manteniendo el mismo flujo aprobado." title="Provisionar acceso">
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <ol className="list-decimal space-y-2 pl-5 text-sm text-[color:var(--admin-muted-foreground)]">
            <li>Crear o confirmar el buzón manualmente fuera del panel.</li>
            <li>Registrar aquí el acceso inicial con contraseña segura.</li>
            <li>Usar el estado activo o inactivo solo para el acceso al panel mediante <code>profiles.is_active</code>.</li>
            <li>Compartir credenciales por un canal manual aprobado.</li>
            <li>Solicitar actualización de contraseña desde <code>/admin/account</code> después del primer acceso.</li>
          </ol>
          <div className="rounded-[var(--admin-radius-card)] border border-[color:var(--admin-border-subtle)] bg-[color:var(--admin-surface-muted)] p-4">
            <StaffCreateForm />
          </div>
        </div>
      </SectionCard>

      <SectionCard description="Historial resumido de acciones sobre cuentas internas. Se muestran solo etiquetas seguras para operación." title="Auditoría reciente">
        {events.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {events.map((event) => (
              <article className="rounded-[var(--admin-radius-control)] border border-[color:var(--admin-border-subtle)] bg-[color:var(--admin-surface-muted)] p-4" key={event.id}>
                <p className="font-semibold text-[color:var(--admin-foreground)]">{staffAuditActionLabel(event.action)}</p>
                <p className="mt-1 text-sm text-[color:var(--admin-muted-foreground)]">{event.target_name ?? event.target_email ?? "No identificado"}</p>
                <p className="mt-2 text-xs text-[color:var(--admin-muted-foreground)]">{formatAdminDateTime(event.created_at)}</p>
                <p className="mt-1 text-xs text-[color:var(--admin-muted-foreground)]">Actor: {event.actor_name ?? "Sistema"}</p>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState description="Las acciones de cuentas internas aparecerán aquí cuando existan movimientos reales." title="Sin auditoría reciente" />
        )}
      </SectionCard>
    </PageContainer>
  );
}
