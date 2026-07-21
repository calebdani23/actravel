import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CatalogSubmitBar } from "@/components/admin/catalog/catalog-submit-bar";
import {
  EmptyState,
  ErrorState,
  MetricCard,
  PageContainer,
  PageHeader,
  QuietActionButton,
  SectionCard,
  StatusBadge,
  adminFieldHintClassName,
  adminInputClassName,
  adminSelectClassName,
} from "@/components/admin/admin-primitives";
import { LocalizedEditorTabs } from "@/components/admin/localized-editor-tabs";
import { OperationDialog } from "@/components/admin/operations/operation-dialog";
import { Button } from "@/components/ui/button";
import { stringifyDetailSectionsEditorValue } from "@/lib/catalog-detail-sections";
import { stringifyPromotionCommercialSectionsEditorValue } from "@/lib/promotion-commercial-sections";
import { CATALOG_MEDIA_ACCEPT, catalogMediaSourceLabel, resolveCatalogMedia, resolveCatalogMediaUrl } from "@/lib/catalog-media";
import { catalogResources, getCatalogOptions, getCatalogRows, resolvePromotionServiceIds, type CatalogResource, type DestinationRow, type PackageRow, type PromotionRow, type ServiceRow } from "@/lib/admin/catalog";
import { requireAdminRole } from "@/lib/admin/auth";
import { catalogStatusLabel, resolveCatalogStatusForDisplay, summarizeCatalogStatuses } from "@/lib/admin/catalog-status";
import { formatAdminCurrency, formatAdminDateTime, formatAdminInteger } from "@/lib/admin/format";
import { localizedPath } from "@/lib/content/public-site";
import { CATALOG_ADMIN_FEEDBACK_FOCUS } from "@/lib/admin/catalog-actions";
import { archiveCatalogAction, deleteCatalogAction, moveCatalogToDraftAction, publishCatalogAction, upsertCatalogAction } from "../actions";

type PageProps = { params: Promise<{ resource: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
type CatalogRow = DestinationRow | ServiceRow | PackageRow | PromotionRow;

const DESCRIPTION_FIELD_HINT = "Usa párrafos cortos con una línea en blanco entre ideas. Si necesitas listar puntos rápidos, escribe cada renglón con `- ` al inicio.";
const DESCRIPTION_ES_PLACEHOLDER = "Párrafo inicial con contexto claro.\n\nSegundo párrafo con beneficios o enfoque.\n\n- Punto breve\n- Otro punto breve";
const DESCRIPTION_EN_PLACEHOLDER = "Opening paragraph with clear context.\n\nSecond paragraph with benefits or approach.\n\n- Short point\n- Another short point";

function isResource(value: string): value is CatalogResource {
  return value in catalogResources;
}

function value(params: Record<string, string | string[] | undefined>, key: string) {
  const raw = params[key];
  return Array.isArray(raw) ? raw[0] : raw;
}

function TextInput({
  name,
  label,
  defaultValue,
  required = false,
  type = "text",
  hint,
  min,
}: {
  name: string;
  label: string;
  defaultValue?: string | number | null;
  required?: boolean;
  type?: string;
  hint?: string;
  min?: number;
}) {
  return (
    <label className="space-y-1.5 text-sm font-medium text-[color:var(--admin-foreground)]">
      <span>{label}</span>
      <input className={adminInputClassName} defaultValue={defaultValue ?? ""} min={min} name={name} required={required} type={type} />
      {hint ? <p className={adminFieldHintClassName}>{hint}</p> : null}
    </label>
  );
}

function TextArea({ name, label, defaultValue, placeholder, hint, className }: { name: string; label: string; defaultValue?: string | null; placeholder?: string; hint?: string; className?: string }) {
  return (
    <label className={`space-y-1.5 text-sm font-medium text-[color:var(--admin-foreground)] ${className ?? ""}`}>
      <span>{label}</span>
      <textarea className="min-h-28 w-full rounded-[var(--admin-radius-control)] border border-[color:var(--admin-input-border)] bg-white px-3.5 py-2.5 text-sm text-[color:var(--admin-foreground)] shadow-[var(--admin-shadow-control)] outline-none transition-[border-color,box-shadow] placeholder:text-[color:var(--admin-placeholder)] hover:border-[color:var(--admin-accent-soft)] focus-visible:border-[color:var(--admin-accent)] focus-visible:ring-4 focus-visible:ring-[color:var(--admin-ring)]" defaultValue={defaultValue ?? ""} name={name} placeholder={placeholder} />
      {hint ? <p className={adminFieldHintClassName}>{hint}</p> : null}
    </label>
  );
}

function CatalogSection({ title, description, children, defaultOpen = true }: Readonly<{ title: string; description?: string; children: ReactNode; defaultOpen?: boolean }>) {
  return (
    <details className="overflow-hidden rounded-[var(--admin-radius-card)] border border-[color:var(--admin-border)] bg-[color:var(--admin-surface-muted)]" open={defaultOpen}>
      <summary className="cursor-pointer list-none px-4 py-3.5 text-sm font-semibold text-[color:var(--admin-foreground)] marker:hidden">
        <span className="flex items-center justify-between gap-3">
          <span>{title}</span>
          <span className="text-xs font-medium text-[color:var(--admin-muted-foreground)]">Abrir / cerrar</span>
        </span>
        {description ? <span className="mt-1 block pr-8 text-xs font-normal leading-5 text-[color:var(--admin-muted-foreground)]">{description}</span> : null}
      </summary>
      <div className="border-t border-[color:var(--admin-border-subtle)] px-4 py-4">{children}</div>
    </details>
  );
}

function DetailSectionsField({ row }: { row?: DestinationRow | ServiceRow | PackageRow }) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-[color:var(--admin-foreground)]">Secciones detalladas</p>
        <p className={adminFieldHintClassName}>Formato: [Título de sección] y bullets con - para cada item. Línea en blanco separa secciones.</p>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <TextArea defaultValue={stringifyDetailSectionsEditorValue(row?.detail_sections_es)} label="Secciones ES" name="detail_sections_es_input" />
        <TextArea defaultValue={stringifyDetailSectionsEditorValue(row?.detail_sections_en)} label="Secciones EN" name="detail_sections_en_input" />
      </div>
    </div>
  );
}

function PromotionCommercialSectionsField({ row }: { row?: PromotionRow }) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-[color:var(--admin-foreground)]">Secciones comerciales de promoción</p>
        <p className={adminFieldHintClassName}>Usa solo estos bloques: [Datos de oferta], [Incluye], [Restricciones], [Valor] y [Nota CTA]. En datos de oferta usa `Etiqueta | Valor | destacado` y en listas usa `-` por renglón.</p>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <TextArea defaultValue={stringifyPromotionCommercialSectionsEditorValue(row?.commercial_sections_es)} label="Contenido comercial ES" name="commercial_sections_es_input" />
        <TextArea defaultValue={stringifyPromotionCommercialSectionsEditorValue(row?.commercial_sections_en)} label="Contenido comercial EN" name="commercial_sections_en_input" />
      </div>
    </div>
  );
}

function MediaPreview({ heroImageUrl, thumbnailImageUrl }: { heroImageUrl?: string | null; thumbnailImageUrl?: string | null }) {
  const hero = resolveCatalogMediaUrl(heroImageUrl);
  const thumbnail = resolveCatalogMediaUrl(thumbnailImageUrl);
  const preview = hero ?? thumbnail;

  if (!preview) {
    return <p className={adminFieldHintClassName}>Todavía no hay una imagen configurada para esta ficha.</p>;
  }

  return (
    <div className="flex flex-col gap-3 rounded-[var(--admin-radius-card)] border border-[color:var(--admin-border-subtle)] bg-white p-4 sm:flex-row">
      <div className="shrink-0">
        <Image alt="Vista previa de imagen del catálogo" className="h-20 w-32 rounded-md object-cover" height={80} src={preview} unoptimized width={128} />
      </div>
      <div className="min-w-0 space-y-1 text-xs text-[color:var(--admin-muted-foreground)]">
        <p><span className="font-medium text-[color:var(--admin-foreground)]">Portada:</span> {hero ?? "Sin imagen"}</p>
        <p><span className="font-medium text-[color:var(--admin-foreground)]">Miniatura:</span> {thumbnail ?? "Sin imagen"}</p>
        <p>Las tarjetas públicas priorizan la miniatura y el detalle público usa primero la portada.</p>
      </div>
    </div>
  );
}

function MediaField({ name, label, currentValue }: { name: "hero_image_url" | "thumbnail_image_url"; label: string; currentValue?: string | null }) {
  const resolved = resolveCatalogMedia(currentValue);

  return (
    <div className="space-y-3 rounded-[var(--admin-radius-card)] border border-[color:var(--admin-border-subtle)] bg-white p-4">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-[color:var(--admin-foreground)]">{label}</p>
        <p className={adminFieldHintClassName}>Puedes usar una URL completa o una referencia privada de Storage. Si subes un archivo, reemplaza el valor escrito.</p>
      </div>
      <div className="space-y-1 rounded-[var(--admin-radius-control)] border border-[color:var(--admin-border-subtle)] bg-[color:var(--admin-surface-muted)] p-3 text-xs text-[color:var(--admin-muted-foreground)]">
        <p><span className="font-medium text-[color:var(--admin-foreground)]">Fuente actual:</span> {catalogMediaSourceLabel(currentValue)}</p>
        <p><span className="font-medium text-[color:var(--admin-foreground)]">Valor guardado:</span> {currentValue ? "Configurado" : "Sin media"}</p>
        <p><span className="font-medium text-[color:var(--admin-foreground)]">Vista previa resuelta:</span> {resolved.url ? "Disponible" : "No disponible"}</p>
      </div>
      <TextInput defaultValue={currentValue} label="Referencia manual" name={name} />
      <label className="space-y-1.5 text-sm font-medium text-[color:var(--admin-foreground)]">
        <span>Subir imagen</span>
        <input accept={CATALOG_MEDIA_ACCEPT} className={adminInputClassName} name={`${name}_file`} type="file" />
        <p className={adminFieldHintClassName}>Formatos permitidos: JPG, PNG, WebP o GIF.</p>
      </label>
      <label className="flex items-center gap-2 text-sm font-medium text-[color:var(--admin-foreground)]">
        <input className="h-4 w-4" name={`${name}_clear`} type="checkbox" /> Limpiar imagen actual
      </label>
    </div>
  );
}

function rowTitle(resource: CatalogResource, row: CatalogRow) {
  if (resource === "promotions") return (row as PromotionRow).title_es || "Promoción sin título";
  return (row as DestinationRow | ServiceRow | PackageRow).name_es || "Registro sin nombre";
}

function rowDescription(resource: CatalogResource) {
  if (resource === "destinations") return "Bases publicadas para inspirar y orientar cotizaciones.";
  if (resource === "services") return "Servicios que se muestran en el sitio y en el contexto comercial.";
  if (resource === "packages") return "Paquetes orientativos que alimentan la propuesta pública.";
  return "Promociones y viajes sugeridos que inician la conversación comercial.";
}

function statusTone(status?: string | null): "success" | "warning" | "neutral" {
  if (status === "published") return "success";
  if (status === "archived") return "neutral";
  return "warning";
}

function localeCompletion(row: CatalogRow, resource: CatalogResource, locale: "es" | "en") {
  const shared = resource === "promotions"
    ? [locale === "es" ? (row as PromotionRow).title_es : (row as PromotionRow).title_en, locale === "es" ? row.slug_es : row.slug_en]
    : [locale === "es" ? (row as DestinationRow | ServiceRow | PackageRow).name_es : (row as DestinationRow | ServiceRow | PackageRow).name_en, locale === "es" ? row.slug_es : row.slug_en];

  const detailFields = resource === "promotions"
    ? [locale === "es" ? (row as PromotionRow).summary_es : (row as PromotionRow).summary_en, locale === "es" ? (row as PromotionRow).details_es : (row as PromotionRow).details_en]
    : [locale === "es" ? (row as DestinationRow | ServiceRow | PackageRow).summary_es : (row as DestinationRow | ServiceRow | PackageRow).summary_en, locale === "es" ? (row as DestinationRow | ServiceRow | PackageRow).description_es : (row as DestinationRow | ServiceRow | PackageRow).description_en];

  const requiredComplete = shared.every((item) => Boolean(item?.trim()));
  const contentComplete = detailFields.some((item) => Boolean(item?.trim()));

  return {
    complete: requiredComplete && contentComplete,
    detail: requiredComplete && contentComplete ? "Completo" : requiredComplete ? "Falta contenido" : "Faltan básicos",
  };
}

function priceSummary(row: CatalogRow, resource: CatalogResource) {
  if (resource === "destinations") return "Precio bajo consulta";
  const pricedRow = row as ServiceRow | PackageRow | PromotionRow;
  const mxn = typeof pricedRow.price_from_mxn === "number" ? formatAdminCurrency(pricedRow.price_from_mxn, "MXN") : null;
  const usd = typeof pricedRow.price_from_usd === "number" ? formatAdminCurrency(pricedRow.price_from_usd, "USD") : null;
  if (mxn && usd) return `${mxn} · ${usd}`;
  return mxn || usd || "Precio bajo consulta";
}

function previewLinks(resource: CatalogResource, row?: CatalogRow) {
  if (!row) return [];
  const routeKey = resource === "promotions" ? "deals" : resource;
  const links = [] as Array<{ label: string; href: string }>;
  if (row.slug_es) links.push({ label: "Vista previa ES", href: localizedPath("es", routeKey, row.slug_es) });
  if (row.slug_en) links.push({ label: "Vista previa EN", href: localizedPath("en", routeKey, row.slug_en) });
  return links;
}

function feedbackTone(status?: string) {
  return status === "success" ? "success" : "warning";
}

function SharedBilingualFields({ row }: { row?: DestinationRow | ServiceRow | PackageRow }) {
  const es = localeCompletion(row ?? {} as CatalogRow, "destinations", "es");
  const en = localeCompletion(row ?? {} as CatalogRow, "destinations", "en");

  return (
    <LocalizedEditorTabs
      defaultTab="es"
      tabs={[
        {
          key: "es",
          label: "Contenido ES",
          complete: es.complete,
          description: "Completa el título, slug y copy principal en español.",
          content: (
            <div className="grid gap-4 lg:grid-cols-2">
              <TextInput defaultValue={row?.name_es} label="Nombre en español" name="name_es" required />
              <div className="rounded-[var(--admin-radius-card)] border border-dashed border-[color:var(--admin-border)] bg-[color:var(--admin-surface-muted)] px-4 py-3 text-sm text-[color:var(--admin-muted-foreground)]">El slug en español se revisa en la sección de SEO y slugs.</div>
              <TextArea className="lg:col-span-2" defaultValue={row?.summary_es} label="Resumen en español" name="summary_es" />
              <TextArea className="lg:col-span-2" defaultValue={row?.description_es} hint={DESCRIPTION_FIELD_HINT} label="Descripción en español" name="description_es" placeholder={DESCRIPTION_ES_PLACEHOLDER} />
            </div>
          ),
        },
        {
          key: "en",
          label: "Contenido EN",
          complete: en.complete,
          description: "Completa el equivalente en inglés para la versión bilingüe.",
          content: (
            <div className="grid gap-4 lg:grid-cols-2">
              <TextInput defaultValue={row?.name_en} label="Nombre en inglés" name="name_en" required />
              <div className="rounded-[var(--admin-radius-card)] border border-dashed border-[color:var(--admin-border)] bg-[color:var(--admin-surface-muted)] px-4 py-3 text-sm text-[color:var(--admin-muted-foreground)]">El slug en inglés se revisa en la sección de SEO y slugs.</div>
              <TextArea className="lg:col-span-2" defaultValue={row?.summary_en} label="Resumen en inglés" name="summary_en" />
              <TextArea className="lg:col-span-2" defaultValue={row?.description_en} hint={DESCRIPTION_FIELD_HINT} label="Descripción en inglés" name="description_en" placeholder={DESCRIPTION_EN_PLACEHOLDER} />
            </div>
          ),
        },
      ]}
    />
  );
}

function PromotionLanguageFields({ row }: { row?: PromotionRow }) {
  const es = localeCompletion(row ?? {} as CatalogRow, "promotions", "es");
  const en = localeCompletion(row ?? {} as CatalogRow, "promotions", "en");

  return (
    <LocalizedEditorTabs
      defaultTab="es"
      tabs={[
        {
          key: "es",
          label: "Contenido ES",
          complete: es.complete,
          description: "Título, slug, resumen y detalles de la promoción en español.",
          content: (
            <div className="grid gap-4 lg:grid-cols-2">
              <TextInput defaultValue={row?.title_es} label="Título en español" name="title_es" required />
              <div className="rounded-[var(--admin-radius-card)] border border-dashed border-[color:var(--admin-border)] bg-[color:var(--admin-surface-muted)] px-4 py-3 text-sm text-[color:var(--admin-muted-foreground)]">El slug en español se revisa en la sección de SEO y slugs.</div>
              <TextArea className="lg:col-span-2" defaultValue={row?.summary_es} label="Resumen en español" name="summary_es" />
              <TextArea className="lg:col-span-2" defaultValue={row?.details_es} hint={DESCRIPTION_FIELD_HINT} label="Detalles en español" name="details_es" placeholder={DESCRIPTION_ES_PLACEHOLDER} />
            </div>
          ),
        },
        {
          key: "en",
          label: "Contenido EN",
          complete: en.complete,
          description: "Versión en inglés para el sitio público y revisiones bilingües.",
          content: (
            <div className="grid gap-4 lg:grid-cols-2">
              <TextInput defaultValue={row?.title_en} label="Título en inglés" name="title_en" required />
              <div className="rounded-[var(--admin-radius-card)] border border-dashed border-[color:var(--admin-border)] bg-[color:var(--admin-surface-muted)] px-4 py-3 text-sm text-[color:var(--admin-muted-foreground)]">El slug en inglés se revisa en la sección de SEO y slugs.</div>
              <TextArea className="lg:col-span-2" defaultValue={row?.summary_en} label="Resumen en inglés" name="summary_en" />
              <TextArea className="lg:col-span-2" defaultValue={row?.details_en} hint={DESCRIPTION_FIELD_HINT} label="Detalles en inglés" name="details_en" placeholder={DESCRIPTION_EN_PLACEHOLDER} />
            </div>
          ),
        },
      ]}
    />
  );
}

function StatusControls({ row }: { row?: CatalogRow }) {
  const status = resolveCatalogStatusForDisplay(row);

  return (
    <div className="grid gap-4 lg:grid-cols-[1.3fr_0.8fr_1fr]">
      <div className="space-y-2">
        <p className="text-sm font-semibold text-[color:var(--admin-foreground)]">Estado actual</p>
        <div className="rounded-[var(--admin-radius-card)] border border-[color:var(--admin-border-subtle)] bg-white p-4 text-sm">
          <StatusBadge tone={statusTone(status)}>{catalogStatusLabel(status)}</StatusBadge>
          <p className="mt-2 text-xs text-[color:var(--admin-muted-foreground)]">{row?.published_at ? `Publicado: ${formatAdminDateTime(row.published_at)}` : "Sin fecha de publicación"}</p>
        </div>
      </div>
      <label className="flex items-start gap-3 rounded-[var(--admin-radius-card)] border border-[color:var(--admin-border-subtle)] bg-white p-4 text-sm font-medium text-[color:var(--admin-foreground)]">
        <input className="mt-0.5 h-4 w-4" defaultChecked={row?.is_featured ?? false} name="is_featured" type="checkbox" />
        <span>
          <span className="block">Destacado</span>
          <span className="mt-1 block text-xs font-normal text-[color:var(--admin-muted-foreground)]">Usa este estado para priorizar la ficha en listados públicos y contexto comercial.</span>
        </span>
      </label>
      <div className="rounded-[var(--admin-radius-card)] border border-[color:var(--admin-border-subtle)] bg-white p-4 text-xs leading-5 text-[color:var(--admin-muted-foreground)]">
        Guardar respeta el estado actual. Publicar, mover a borrador y archivar siguen siendo acciones explícitas y no cambian la validación existente.
      </div>
    </div>
  );
}

function CatalogForm({ resource, row, destinations, services, packages, cancelHref }: { resource: CatalogResource; row?: CatalogRow; destinations: { id: string; name_es: string }[]; services: { id: string; name_es: string }[]; packages: { id: string; name_es: string }[]; cancelHref: string }) {
  const destination = row as DestinationRow | undefined;
  const service = row as ServiceRow | undefined;
  const packageRow = row as PackageRow | undefined;
  const promotion = row as PromotionRow | undefined;
  const promotionServiceIds = resolvePromotionServiceIds(promotion ?? {});

  return (
    <form action={upsertCatalogAction} className="space-y-4">
      <input name="resource" type="hidden" value={resource} />
      {row ? <input name="id" type="hidden" value={row.id} /> : null}

      <CatalogSection defaultOpen description="Nombre o título, relaciones básicas y campos cortos que identifican la ficha." title="1. Información básica">
        <div className="grid gap-4 lg:grid-cols-2">
          {resource === "destinations" ? (
            <>
              <TextInput defaultValue={destination?.country} label="País" name="country" required />
              <TextInput defaultValue={destination?.region} label="Región" name="region" />
            </>
          ) : null}

          {resource === "services" || resource === "packages" ? (
            <TextInput defaultValue={(resource === "services" ? service?.sort_order : packageRow?.sort_order) ?? 0} hint="Menor número aparece primero." label="Orden" min={0} name="sort_order" type="number" />
          ) : null}

          {resource === "promotions" ? (
            <>
              <label className="space-y-1.5 text-sm font-medium text-[color:var(--admin-foreground)]">
                <span>Destino relacionado</span>
                <select className={adminSelectClassName} defaultValue={promotion?.destination_id ?? ""} name="destination_id">
                  <option value="">Sin destino</option>
                  {destinations.map((option) => <option key={option.id} value={option.id}>{option.name_es}</option>)}
                </select>
              </label>
              <label className="space-y-1.5 text-sm font-medium text-[color:var(--admin-foreground)]">
                <span>Paquete relacionado</span>
                <select className={adminSelectClassName} defaultValue={promotion?.package_id ?? ""} name="package_id">
                  <option value="">Sin paquete</option>
                  {packages.map((option) => <option key={option.id} value={option.id}>{option.name_es}</option>)}
                </select>
              </label>
              <label className="space-y-1.5 text-sm font-medium text-[color:var(--admin-foreground)] lg:col-span-2">
                <span>Servicios relacionados</span>
                <select className="min-h-40 w-full rounded-[var(--admin-radius-control)] border border-[color:var(--admin-input-border)] bg-white px-3.5 py-2.5 text-sm text-[color:var(--admin-foreground)] shadow-[var(--admin-shadow-control)] outline-none transition-[border-color,box-shadow] hover:border-[color:var(--admin-accent-soft)] focus-visible:border-[color:var(--admin-accent)] focus-visible:ring-4 focus-visible:ring-[color:var(--admin-ring)]" defaultValue={promotionServiceIds} multiple name="service_ids">
                  {services.map((option) => <option key={option.id} value={option.id}>{option.name_es}</option>)}
                </select>
                <p className={adminFieldHintClassName}>Mantén Ctrl o Cmd para seleccionar más de uno. Seguimos guardando también el primer servicio en el campo legacy para compatibilidad.</p>
              </label>
            </>
          ) : null}
        </div>
      </CatalogSection>

      {resource === "promotions" ? (
        <CatalogSection description="Copy principal para cada idioma, con indicador rápido de completitud." title="2 y 3. Contenido bilingüe">
          <PromotionLanguageFields row={promotion} />
        </CatalogSection>
      ) : (
        <CatalogSection description="Copy principal para cada idioma, con indicador rápido de completitud." title="2 y 3. Contenido bilingüe">
          <SharedBilingualFields row={destination ?? service ?? packageRow} />
        </CatalogSection>
      )}

      <CatalogSection description="Sube o referencia solo las imágenes que se mostrarán en tarjetas y páginas públicas." title="4. Imágenes y medios">
        <div className="grid gap-4 xl:grid-cols-2">
          <MediaField currentValue={row?.hero_image_url} label="Imagen principal" name="hero_image_url" />
          <MediaField currentValue={row?.thumbnail_image_url} label="Miniatura" name="thumbnail_image_url" />
          <div className="xl:col-span-2"><MediaPreview heroImageUrl={row?.hero_image_url} thumbnailImageUrl={row?.thumbnail_image_url} /></div>
        </div>
      </CatalogSection>

      <CatalogSection description="Precios y fechas comerciales solo cuando la ficha los soporte." title="5. Precio e información comercial">
        <div className="grid gap-4 lg:grid-cols-2">
          {resource === "services" || resource === "packages" || resource === "promotions" ? (
            <>
              <TextInput defaultValue={(row as ServiceRow | PackageRow | PromotionRow | undefined)?.price_from_mxn} label="Precio desde MXN" name="price_from_mxn" type="number" />
              <TextInput defaultValue={(row as ServiceRow | PackageRow | PromotionRow | undefined)?.price_from_usd} label="Precio desde USD" name="price_from_usd" type="number" />
            </>
          ) : null}
          {resource === "promotions" ? (
            <>
              <TextInput defaultValue={promotion?.starts_at?.slice(0, 10)} label="Inicio" name="starts_at" type="date" />
              <TextInput defaultValue={promotion?.ends_at?.slice(0, 10)} label="Fin" name="ends_at" type="date" />
            </>
          ) : null}
        </div>
        {resource === "promotions" ? <div className="mt-4"><PromotionCommercialSectionsField row={promotion} /></div> : null}
        {resource !== "promotions" ? <div className="mt-4"><DetailSectionsField row={destination ?? service ?? packageRow} /></div> : null}
      </CatalogSection>

      <CatalogSection description="Los slugs visibles ya siguen la lógica actual; solo ajústalos cuando realmente lo necesites." title="6. SEO y slugs" defaultOpen={false}>
        <div className="grid gap-4 lg:grid-cols-2">
          <TextInput defaultValue={row?.slug_es} label="Slug visible ES" name="slug_es" required />
          <TextInput defaultValue={row?.slug_en} label="Slug visible EN" name="slug_en" required />
        </div>
      </CatalogSection>

      <CatalogSection description="Mantén el control editorial sin cambiar la seguridad ni el flujo de publicación existente." title="7. Estado de publicación" defaultOpen={false}>
        <StatusControls row={row} />
      </CatalogSection>

      {row ? (
        <CatalogSection description="Abre la ficha pública disponible para validar copy, imagen y relación comercial." title="8. Vista previa" defaultOpen={false}>
          <div className="flex flex-wrap gap-2">
            {previewLinks(resource, row).length ? previewLinks(resource, row).map((link) => (
              <Button asChild key={link.href} type="button" variant="outline"><Link href={link.href} target="_blank">{link.label}</Link></Button>
            )) : <p className={adminFieldHintClassName}>Necesitas al menos un slug para abrir la vista previa pública.</p>}
          </div>
        </CatalogSection>
      ) : null}

      <CatalogSubmitBar
        archiveAction={archiveCatalogAction}
        cancelHref={cancelHref}
        deleteAction={deleteCatalogAction}
        draftAction={moveCatalogToDraftAction}
        isArchived={row?.status === "archived"}
        isEditing={Boolean(row)}
        isPublished={row?.status === "published"}
        previewLinks={previewLinks(resource, row)}
        publishAction={publishCatalogAction}
      />
    </form>
  );
}

function RowMetadata({ resource, row }: Readonly<{ resource: CatalogResource; row: CatalogRow }>) {
  const es = localeCompletion(row, resource, "es");
  const en = localeCompletion(row, resource, "en");
  const serviceCount = resource === "promotions" ? resolvePromotionServiceIds(row as PromotionRow).length : 0;
  const mediaCount = [row.hero_image_url, row.thumbnail_image_url].filter(Boolean).length;

  return (
    <div className="grid gap-3 lg:grid-cols-4">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Estado</p>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={statusTone(row.status)}>{catalogStatusLabel(row.status)}</StatusBadge>
          {row.is_featured ? <StatusBadge tone="brand">Destacado</StatusBadge> : null}
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Idiomas</p>
        <div className="flex flex-wrap gap-2 text-xs">
          <StatusBadge tone={es.complete ? "success" : "warning"}>ES · {es.detail}</StatusBadge>
          <StatusBadge tone={en.complete ? "success" : "warning"}>EN · {en.detail}</StatusBadge>
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Contexto</p>
        <p className="text-sm text-[color:var(--admin-foreground)]">{priceSummary(row, resource)}</p>
        <p className="text-xs text-[color:var(--admin-muted-foreground)]">{mediaCount} archivo(s) de imagen {resource === "promotions" ? `· ${serviceCount} servicio(s) relacionado(s)` : ""}</p>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-muted-foreground)]">Última actualización</p>
        <p className="text-sm text-[color:var(--admin-foreground)]">{row.updated_at ? formatAdminDateTime(row.updated_at) : "Por definir"}</p>
        <p className="text-xs text-[color:var(--admin-muted-foreground)]">Slug ES: {row.slug_es ?? "Sin definir"}</p>
      </div>
    </div>
  );
}

export default async function CatalogPage({ params, searchParams }: PageProps) {
  const [{ resource }, rawParams] = await Promise.all([params, searchParams, requireAdminRole(["admin", "marketing"])]);
  if (!isResource(resource)) notFound();

  const feedbackStatus = value(rawParams, "status");
  const feedbackMessage = value(rawParams, "message");
  const feedbackFocus = value(rawParams, "focus");
  const [{ rows, error }, options] = await Promise.all([getCatalogRows(resource), getCatalogOptions()]);

  const counts = summarizeCatalogStatuses<CatalogRow>(rows as CatalogRow[], (row) => !localeCompletion(row, resource, "es").complete || !localeCompletion(row, resource, "en").complete);

  const createDialogLabel = resource === "destinations"
    ? "Nuevo destino"
    : resource === "services"
      ? "Nuevo servicio"
      : resource === "packages"
        ? "Nuevo paquete"
        : "Nueva promoción";

  return (
    <PageContainer>
      <PageHeader
        actions={<OperationDialog description={`Crea un nuevo registro para ${catalogResources[resource].label.toLowerCase()} sin salir del módulo.`} title={createDialogLabel} triggerLabel={createDialogLabel}><CatalogForm cancelHref={catalogResources[resource].href} destinations={options.destinations} packages={options.packages} resource={resource} services={options.services} /></OperationDialog>}
        breadcrumbs={[{ label: "Panel", href: "/admin/dashboard" }, { label: "Catálogo", href: "/admin/catalog/destinations" }, { label: catalogResources[resource].label }]}
        description={`${rowDescription(resource)} Revisa el contenido existente antes de abrir una edición o crear una nueva ficha.`}
        eyebrow="Catálogo"
        title={catalogResources[resource].label}
      />

      <nav aria-label="Módulos del catálogo" className="overflow-x-auto">
        <div className="flex min-w-max flex-wrap gap-2 pb-1">
          {Object.entries(catalogResources).map(([key, item]) => (
            <QuietActionButton asChild className={key === resource ? "border-[color:var(--admin-accent)] bg-[color:var(--admin-brand-bg)] text-[color:var(--admin-brand-fg)]" : undefined} key={key}>
              <Link aria-current={key === resource ? "page" : undefined} href={item.href}>{item.label}</Link>
            </QuietActionButton>
          ))}
        </div>
      </nav>

      {feedbackMessage ? (
        <div className={`rounded-[var(--admin-radius-card)] border px-4 py-3 text-sm ${feedbackTone(feedbackStatus) === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`} id="catalog-feedback" role="status" tabIndex={feedbackFocus === CATALOG_ADMIN_FEEDBACK_FOCUS ? -1 : undefined}>
          {feedbackMessage}
        </div>
      ) : null}

      {error ? <ErrorState description="No pudimos cargar este módulo del catálogo en este momento. Intenta de nuevo en unos minutos." title="No se pudo cargar el catálogo" /> : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard detail="Visibles en el sitio cuando la ruta pública aplica." label="Publicados" tone="success" value={formatAdminInteger(counts.published)} />
        <MetricCard detail="Aún no aparecen en público." label="Borradores" tone="warning" value={formatAdminInteger(counts.draft)} />
        <MetricCard detail="Se mantienen fuera de publicación sin borrarse." label="Archivados" tone="neutral" value={formatAdminInteger(counts.archived)} />
        <MetricCard detail="Registros con estado recibido fuera del catálogo reconocido." label="Estado no identificado" tone="warning" value={formatAdminInteger(counts.unknown)} />
        <MetricCard detail="Falta al menos un idioma o contenido clave." label="Pendientes de revisión" tone="brand" value={formatAdminInteger(counts.incomplete)} />
      </section>

      <SectionCard description="Explora primero el contenido ya capturado. Cada tarjeta resume estado, completitud bilingüe y contexto comercial antes de editar." title={`${rows.length} registro(s) visibles`}>
        {rows.length ? (
          <div className="grid gap-4">
            {rows.map((row) => (
              <article className="rounded-[var(--admin-radius-card)] border border-[color:var(--admin-border-subtle)] bg-white p-4 shadow-[var(--admin-shadow-card)]" key={row.id}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-[color:var(--admin-foreground)]">{rowTitle(resource, row)}</h2>
                      {row.published_at ? <span className="text-xs text-[color:var(--admin-muted-foreground)]">Publicado: {formatAdminDateTime(row.published_at)}</span> : null}
                    </div>
                    <p className="text-sm text-[color:var(--admin-muted-foreground)]">{resource === "promotions" ? (row as PromotionRow).summary_es || "Sin resumen en español todavía." : (row as DestinationRow | ServiceRow | PackageRow).summary_es || "Sin resumen en español todavía."}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {previewLinks(resource, row).map((link) => (
                      <QuietActionButton asChild key={link.href} type="button"><Link href={link.href} target="_blank">{link.label}</Link></QuietActionButton>
                    ))}
                    <OperationDialog description={`Edita ${rowTitle(resource, row)} sin cambiar la seguridad ni los flujos existentes.`} title={`Editar ${rowTitle(resource, row)}`} triggerLabel="Editar">
                      <CatalogForm cancelHref={catalogResources[resource].href} destinations={options.destinations} packages={options.packages} resource={resource} row={row} services={options.services} />
                    </OperationDialog>
                  </div>
                </div>
                <div className="mt-4"><RowMetadata resource={resource} row={row} /></div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState action={<OperationDialog description={`Crea el primer registro para ${catalogResources[resource].label.toLowerCase()}.`} title={createDialogLabel} triggerLabel={createDialogLabel}><CatalogForm cancelHref={catalogResources[resource].href} destinations={options.destinations} packages={options.packages} resource={resource} services={options.services} /></OperationDialog>} description="Aún no hay contenido visible para este módulo. Empieza creando un borrador y después publícalo cuando esté listo." title={`Todavía no hay ${catalogResources[resource].label.toLowerCase()}`} />
        )}
      </SectionCard>
    </PageContainer>
  );
}
