import Link from "next/link";
import type { QuoteDocumentDto } from "@/lib/admin/quotes";

export function QuotePdfPreview({ document, title }: Readonly<{ document: QuoteDocumentDto | null; title: string }>) {
  if (!document?.previewUrl || !document.downloadUrl) {
    return (
      <div className="rounded-xl border border-dashed border-[color:var(--admin-border)] bg-[color:var(--admin-surface-muted)] p-5 text-sm text-[color:var(--admin-muted-foreground)]">
        El PDF canónico todavía no está disponible para vista previa.
      </div>
    );
  }

  return (
    <section aria-labelledby="quote-pdf-preview-title" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold" id="quote-pdf-preview-title">PDF canónico</h2>
          <p className="text-sm text-[color:var(--admin-muted-foreground)]">Enlaces privados con vigencia limitada.</p>
        </div>
        <Link className="rounded-lg border border-[color:var(--admin-border)] px-4 py-2 text-sm font-semibold hover:bg-[color:var(--admin-surface-muted)]" href={document.downloadUrl} rel="noopener noreferrer" target="_blank">
          Descargar PDF
        </Link>
      </div>
      <iframe className="hidden h-[70vh] min-h-[560px] w-full rounded-xl border border-[color:var(--admin-border)] bg-white md:block" src={document.previewUrl} title={`Vista previa del PDF de ${title}`} />
      <div className="rounded-xl border border-[color:var(--admin-border)] bg-[color:var(--admin-surface-muted)] p-5 md:hidden">
        <p className="text-sm leading-6">La vista integrada está disponible en pantallas amplias. En móvil, abre el PDF en una pestaña segura o descárgalo.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link className="rounded-lg bg-[color:var(--admin-accent)] px-4 py-2 text-sm font-semibold text-white" href={document.previewUrl} rel="noopener noreferrer" target="_blank">Abrir vista previa</Link>
          <Link className="rounded-lg border border-[color:var(--admin-border)] px-4 py-2 text-sm font-semibold" href={document.downloadUrl} rel="noopener noreferrer" target="_blank">Descargar</Link>
        </div>
      </div>
    </section>
  );
}
