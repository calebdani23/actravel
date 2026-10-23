import { PageContainer } from "@/components/admin/admin-primitives";

export default function DashboardLoading() {
  return (
    <PageContainer>
      <section aria-busy="true" aria-labelledby="dashboard-loading-heading" className="space-y-5">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold" id="dashboard-loading-heading">Cargando Dashboard</h1>
          <p className="text-sm text-[color:var(--admin-muted-foreground)]">Preparando la información permitida para tu sesión.</p>
        </div>
        <div aria-hidden="true" className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => <div className="h-28 animate-pulse rounded-[var(--admin-radius-panel)] bg-[color:var(--admin-surface-muted)]" key={index} />)}
        </div>
      </section>
    </PageContainer>
  );
}
