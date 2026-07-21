import { OperationDialog } from "@/components/admin/operations/operation-dialog";
import { EmptyState, StatusBadge } from "@/components/admin/admin-primitives";
import { StaffDeleteForm, StaffEditForm } from "@/components/admin/staff/staff-action-forms";
import type { StaffAccount } from "@/lib/admin/staff";
import { formatAdminDateTime } from "@/lib/admin/format";
import { staffActiveStateLabel, staffLastActivityLabel, staffManagementNote, staffRoleLabel, staffRolesSummary } from "@/lib/admin/staff-view";

function StaffCard({ staff }: Readonly<{ staff: StaffAccount }>) {
  return (
    <article className="rounded-[var(--admin-radius-card)] border border-[color:var(--admin-border-subtle)] bg-white p-4 shadow-[var(--admin-shadow-card)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-[color:var(--admin-foreground)]">{staff.full_name || "No identificado"}</h3>
            <StatusBadge tone={staff.is_active ? "success" : "warning"}>{staffActiveStateLabel(staff.is_active)}</StatusBadge>
            <StatusBadge tone={staff.role ? "brand" : "neutral"}>{staff.role ? staffRoleLabel(staff.role) : "Rol no identificado"}</StatusBadge>
            {!staff.is_manageable_in_mvp ? <StatusBadge tone="warning">Solo lectura</StatusBadge> : null}
          </div>
          <p className="break-all text-sm text-[color:var(--admin-muted-foreground)]">{staff.email ?? "No identificado"}</p>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[var(--admin-radius-control)] border border-[color:var(--admin-border-subtle)] bg-[color:var(--admin-surface-muted)] p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Roles visibles</p>
              <p className="mt-1 text-sm font-medium text-[color:var(--admin-foreground)]">{staffRolesSummary(staff.roles)}</p>
            </div>
            <div className="rounded-[var(--admin-radius-control)] border border-[color:var(--admin-border-subtle)] bg-[color:var(--admin-surface-muted)] p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Creado</p>
              <p className="mt-1 text-sm font-medium text-[color:var(--admin-foreground)]">{formatAdminDateTime(staff.created_at)}</p>
            </div>
            <div className="rounded-[var(--admin-radius-control)] border border-[color:var(--admin-border-subtle)] bg-[color:var(--admin-surface-muted)] p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Actividad</p>
              <p className="mt-1 text-sm font-medium text-[color:var(--admin-foreground)]">{staffLastActivityLabel(staff.updated_at)}</p>
            </div>
            <div className="rounded-[var(--admin-radius-control)] border border-[color:var(--admin-border-subtle)] bg-[color:var(--admin-surface-muted)] p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Estado de edición</p>
              <p className="mt-1 text-sm font-medium text-[color:var(--admin-foreground)]">{staff.is_manageable_in_mvp ? "Gestionable" : "Restringido"}</p>
            </div>
          </div>
          <p className="text-sm text-[color:var(--admin-muted-foreground)]">{staffManagementNote(staff.management_block_reason)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <OperationDialog description={`Edita ${staff.full_name || "este usuario"} sin cambiar contratos del servidor ni validaciones existentes.`} title={`Editar ${staff.full_name || "usuario"}`} triggerLabel="Editar">
            <StaffEditForm staff={staff} />
          </OperationDialog>
          {staff.is_manageable_in_mvp ? (
            <OperationDialog description="Revisa el impacto antes de confirmar la eliminación permanente." title={`Eliminar ${staff.full_name || "usuario"}`} triggerClassName="border border-red-200 bg-white text-red-700 hover:bg-red-50" triggerLabel="Eliminar">
              <StaffDeleteForm staff={staff} />
            </OperationDialog>
          ) : (
            <StatusBadge tone="neutral">Eliminación no disponible</StatusBadge>
          )}
        </div>
      </div>
    </article>
  );
}

export function StaffList({ staff }: { staff: StaffAccount[] }) {
  if (!staff.length) return <EmptyState description="Cuando existan usuarios internos visibles aparecerán aquí." title="Sin usuarios para mostrar" />;
  return <div className="grid gap-4">{staff.map((row) => <StaffCard key={row.id} staff={row} />)}</div>;
}
