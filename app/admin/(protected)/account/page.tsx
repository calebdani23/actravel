import { EmailChangeForm } from "@/components/admin/account/email-change-form";
import { PasswordChangeForm } from "@/components/admin/account/password-change-form";
import { DetailList, PageContainer, PageHeader, SectionCard, StatusBadge } from "@/components/admin/admin-primitives";
import { requireAdminRole } from "@/lib/admin/auth";
import { staffActiveStateLabel, staffRoleLabel } from "@/lib/admin/staff-view";

export default async function AccountPage() {
  const session = await requireAdminRole();
  const roleLabels = session.roles.map((role) => staffRoleLabel(role));

  return (
    <PageContainer className="max-w-5xl">
      <PageHeader
        breadcrumbs={[{ label: "Panel", href: "/admin/dashboard" }, { label: "Cuenta" }]}
        description={`Sesión iniciada como ${session.profile.full_name || session.user.email || "usuario interno"}. Administra tus credenciales y datos de acceso sin salir del panel.`}
        eyebrow="Cuenta"
        title="Mi cuenta"
      />

      <SectionCard description="Resumen de identidad y permisos visibles para tu sesión actual." title="Perfil">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <StatusBadge tone={session.profile.is_active ? "success" : "warning"}>{staffActiveStateLabel(session.profile.is_active)}</StatusBadge>
            {roleLabels.map((role) => <StatusBadge key={role} tone="neutral">{role}</StatusBadge>)}
          </div>
          <DetailList items={[
            { label: "Nombre", value: session.profile.full_name || "No identificado" },
            { label: "Correo actual", value: session.user.email ?? "No identificado" },
            { label: "Estado", value: staffActiveStateLabel(session.profile.is_active), hint: "El acceso depende de la sesión y del estado activo de tu perfil." },
            { label: "Permisos", value: roleLabels.join(", ") || "No identificado" },
          ]} />
        </div>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard description="El cambio de correo conserva el flujo seguro del proveedor de autenticación y el registro de auditoría del panel." title="Correo y seguridad">
          <div className="space-y-4">
            <div className="rounded-[var(--admin-radius-control)] border border-[color:var(--admin-border-subtle)] bg-[color:var(--admin-surface-muted)] p-4 text-sm text-[color:var(--admin-muted-foreground)]">
              <p className="font-semibold text-[color:var(--admin-foreground)]">Correo de acceso actual</p>
              <p className="mt-1 break-all">{session.user.email ?? "No identificado"}</p>
            </div>
            <EmailChangeForm />
          </div>
        </SectionCard>

        <SectionCard description="Actualiza tu contraseña sin exponer datos sensibles ni mover la validación fuera del servidor." title="Contraseña y sesión">
          <div className="space-y-4">
            <PasswordChangeForm />
            <div className="rounded-[var(--admin-radius-control)] border border-[color:var(--admin-border-subtle)] bg-[color:var(--admin-surface-muted)] p-4 text-sm text-[color:var(--admin-muted-foreground)]">
              <p className="font-semibold text-[color:var(--admin-foreground)]">Buenas prácticas</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Usa una contraseña única y de alta complejidad.</li>
                <li>Completa cualquier verificación de correo antes de cerrar la sesión actual.</li>
                <li>Si detectas actividad no reconocida, reporta el incidente a administración.</li>
              </ul>
            </div>
          </div>
        </SectionCard>
      </div>
    </PageContainer>
  );
}
