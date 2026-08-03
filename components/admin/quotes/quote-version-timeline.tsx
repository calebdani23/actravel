import { formatAdminCurrency, formatAdminDateTime } from "@/lib/admin/format";
import type { QuoteVersionDto } from "@/lib/admin/quotes";

export function QuoteVersionTimeline({ versions, currentVersionId, acceptedVersionId }: Readonly<{ versions: QuoteVersionDto[]; currentVersionId: string | null; acceptedVersionId: string | null }>) {
  if (!versions.length) return <p className="text-sm text-[color:var(--admin-muted-foreground)]">No hay versiones visibles.</p>;
  return (
    <ol className="space-y-4" aria-label="Historial de versiones de cotización">
      {versions.map((version) => (
        <li className="relative rounded-xl border border-[color:var(--admin-border)] bg-[color:var(--admin-surface)] p-5" key={version.id}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold">V{version.number} · {version.title}</h3>
                {version.id === currentVersionId ? <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800">Actual</span> : null}
                {version.id === acceptedVersionId ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">Aceptada</span> : null}
              </div>
              <p className="text-sm text-[color:var(--admin-muted-foreground)]">{version.status} · {version.totalAmount === null ? `${version.currency} por definir` : formatAdminCurrency(version.totalAmount, version.currency)}</p>
            </div>
            <time className="text-xs text-[color:var(--admin-muted-foreground)]" dateTime={version.createdAt}>{formatAdminDateTime(version.createdAt)}</time>
          </div>
          {version.summary ? <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{version.summary}</p> : null}
          <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-3">
            <div><dt className="text-[color:var(--admin-muted-foreground)]">PDF</dt><dd className="font-medium">{version.document?.state === "ready" ? "Canónico listo" : "Pendiente"}</dd></div>
            <div><dt className="text-[color:var(--admin-muted-foreground)]">Vigencia</dt><dd className="font-medium">{version.validUntil ?? "Sin fecha"}</dd></div>
            <div><dt className="text-[color:var(--admin-muted-foreground)]">Creada por</dt><dd className="font-medium">{version.createdBy.name ?? "Sistema"}</dd></div>
          </dl>
        </li>
      ))}
    </ol>
  );
}
