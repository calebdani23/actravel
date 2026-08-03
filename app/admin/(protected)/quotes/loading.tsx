import { LoadingState, PageContainer } from "@/components/admin/admin-primitives";

export default function QuotesLoading() {
  return <PageContainer><LoadingState description="Consultando cotizaciones, versiones y documentos visibles para tu rol." title="Cargando cotizaciones comerciales" /></PageContainer>;
}
