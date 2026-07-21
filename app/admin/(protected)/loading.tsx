import { LoadingState, PageContainer } from "@/components/admin/admin-primitives";

export default function AdminProtectedLoading() {
  return (
    <PageContainer>
      <LoadingState title="Cargando panel" description="Estamos consultando la información operativa disponible para tu sesión." />
    </PageContainer>
  );
}
