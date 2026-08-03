import { Suspense } from "react";
import Link from "next/link";
import { QuoteCreateForm } from "@/components/admin/quotes/quote-editor-form";
import { ErrorState, PageContainer, PageHeader, SectionCard } from "@/components/admin/admin-primitives";
import { Button } from "@/components/ui/button";
import { requireAdminRole } from "@/lib/admin/auth";
import { getQuoteCreateFormOptions } from "@/lib/admin/quotes";

type SearchParams = Record<string, string | string[] | undefined>;
type PageProps = { searchParams: Promise<SearchParams> };
const value = (params: SearchParams, key: string) => Array.isArray(params[key]) ? params[key]?.[0] : params[key];

function QuoteFormFallback() {
  return <div aria-busy="true" className="min-h-72 animate-pulse rounded-xl bg-[color:var(--admin-surface-muted)]" role="status"><span className="sr-only">Cargando formulario de cotización</span></div>;
}

export default async function NewQuotePage({ searchParams }: PageProps) {
  const [params] = await Promise.all([searchParams, requireAdminRole(["admin", "asesor"])]);
  const options = await getQuoteCreateFormOptions({
    contactSearch: value(params, "contactQuery"),
    contactPage: Number(value(params, "contactPage")) || 1,
    selectedContactId: value(params, "contactId"),
    selectedOpportunityId: value(params, "opportunityId"),
    selectedRequestId: value(params, "requestId"),
  });
  const selection = options.prefill;
  const hasSelectedContact = Boolean(selection.contactId);
  const hasSelectedOpportunity = Boolean(selection.opportunityId);

  return (
    <PageContainer>
      <PageHeader actions={<Button asChild variant="outline"><Link href="/admin/quotes">Volver a cotizaciones</Link></Button>} breadcrumbs={[{ label: "Cotizaciones", href: "/admin/quotes" }, { label: "Nueva" }]} description="Selecciona primero el contacto canónico, después su oportunidad y finalmente captura la propuesta comercial." eyebrow="Comercial" title="Nueva cotización comercial" />
      {options.issues.map((issue) => <ErrorState description={issue.message} key={`${issue.section}-${issue.code}`} title="Contexto incompleto" />)}
      {!hasSelectedContact ? <SectionCard title="¿El contacto todavía no existe?" description="Crea primero el prospecto y su identidad canónica; después vuelve con el enlace de prellenado."><Button asChild variant="outline"><Link href="/admin/leads/new">Crear prospecto</Link></Button></SectionCard> : null}
      {hasSelectedContact && !options.opportunities.length ? <SectionCard title="Este contacto no tiene oportunidades activas visibles" description="La cotización siempre pertenece a una oportunidad. Crea o abre una oportunidad antes de continuar."><div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link href={`/admin/contacts/${selection.contactId}`}>Abrir Contacto 360</Link></Button><Button asChild><Link href={`/admin/leads/new?contactId=${selection.contactId}`}>Crear oportunidad</Link></Button></div></SectionCard> : null}
      <SectionCard title="Contacto → Oportunidad → Cotización + PDF" description="El PDF inicial es obligatorio. La cotización solo se crea cuando Storage y el servidor confirman una V1 lista.">
        <Suspense fallback={<QuoteFormFallback />}>
          <QuoteCreateForm
            contacts={options.contacts}
            initialContactId={selection.contactId}
            initialOpportunityId={selection.opportunityId}
            initialRequestId={selection.requestId}
            opportunities={options.opportunities}
            optionsArePartial={options.contactPageHasMore || options.opportunityPageHasMore || options.requestPageHasMore}
            requests={options.requests}
          />
        </Suspense>
      </SectionCard>
      {hasSelectedContact && !hasSelectedOpportunity && options.opportunities.length ? <p className="text-sm text-[color:var(--admin-muted-foreground)]" role="status">Selecciona una oportunidad para habilitar los datos comerciales.</p> : null}
    </PageContainer>
  );
}
