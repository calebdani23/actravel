import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { stringifyDetailSectionsEditorValue } from "@/lib/catalog-detail-sections";
import { stringifyPromotionCommercialSectionsEditorValue } from "@/lib/promotion-commercial-sections";
import { CATALOG_MEDIA_ACCEPT, catalogMediaSourceLabel, resolveCatalogMedia, resolveCatalogMediaUrl } from "@/lib/catalog-media";
import { catalogResources, catalogStatusLabel, getCatalogOptions, getCatalogRows, resolvePromotionServiceIds, type CatalogResource, type DestinationRow, type PackageRow, type PromotionRow, type ServiceRow } from "@/lib/admin/catalog";
import { requireAdminRole } from "@/lib/admin/auth";
import { archiveCatalogAction, deleteCatalogAction, moveCatalogToDraftAction, publishCatalogAction, upsertCatalogAction } from "../actions";

type PageProps = { params: Promise<{ resource: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
type CatalogRow = DestinationRow | ServiceRow | PackageRow | PromotionRow;

function isResource(value: string): value is CatalogResource {
  return value in catalogResources;
}

function TextInput({ name, label, defaultValue, required = false, type = "text" }: { name: string; label: string; defaultValue?: string | number | null; required?: boolean; type?: string }) {
  return (
    <label className="space-y-1 text-sm font-medium">
      <span>{label}</span>
      <input className="w-full rounded-md border px-3 py-2 text-sm" defaultValue={defaultValue ?? ""} name={name} required={required} type={type} />
    </label>
  );
}

function TextArea({ name, label, defaultValue, placeholder, hint }: { name: string; label: string; defaultValue?: string | null; placeholder?: string; hint?: string }) {
  return (
    <label className="space-y-1 text-sm font-medium md:col-span-2">
      <span>{label}</span>
      <textarea className="min-h-20 w-full rounded-md border px-3 py-2 text-sm" defaultValue={defaultValue ?? ""} name={name} placeholder={placeholder} />
      {hint ? <p className="text-xs font-normal text-muted-foreground">{hint}</p> : null}
    </label>
  );
}

const DESCRIPTION_FIELD_HINT = "Usa párrafos cortos con una línea en blanco entre ideas. Si necesitas listar puntos rápidos, escribe cada renglón con `- ` al inicio.";
const DESCRIPTION_ES_PLACEHOLDER = "Párrafo inicial con contexto claro.\n\nSegundo párrafo con beneficios o enfoque.\n\n- Punto breve\n- Otro punto breve";
const DESCRIPTION_EN_PLACEHOLDER = "Opening paragraph with clear context.\n\nSecond paragraph with benefits or approach.\n\n- Short point\n- Another short point";

function DetailSectionsField({ row }: { row?: DestinationRow | ServiceRow | PackageRow }) {
  return (
    <div className="space-y-3 rounded-lg border p-3 md:col-span-2">
      <div className="space-y-1">
        <p className="text-sm font-semibold">Structured detail sections</p>
        <p className="text-xs text-muted-foreground">Formato: [Título de sección] y bullets con - para cada item. Línea en blanco separa secciones.</p>
      </div>
      <TextArea defaultValue={stringifyDetailSectionsEditorValue(row?.detail_sections_es)} label="Secciones ES" name="detail_sections_es_input" />
      <TextArea defaultValue={stringifyDetailSectionsEditorValue(row?.detail_sections_en)} label="Sections EN" name="detail_sections_en_input" />
    </div>
  );
}

function PromotionCommercialSectionsField({ row }: { row?: PromotionRow }) {
  return (
    <div className="space-y-3 rounded-lg border p-3 md:col-span-2">
      <div className="space-y-1">
        <p className="text-sm font-semibold">Secciones comerciales de promoción</p>
        <p className="text-xs text-muted-foreground">Usa solo estos bloques: [Datos de oferta], [Incluye], [Restricciones], [Valor] y [Nota CTA]. En datos de oferta usa `Etiqueta | Valor | destacado` y en listas usa `-` por renglón.</p>
      </div>
      <TextArea defaultValue={stringifyPromotionCommercialSectionsEditorValue(row?.commercial_sections_es)} label="Contenido comercial ES" name="commercial_sections_es_input" />
      <TextArea defaultValue={stringifyPromotionCommercialSectionsEditorValue(row?.commercial_sections_en)} label="Contenido comercial EN" name="commercial_sections_en_input" />
    </div>
  );
}

function statusTone(status?: string | null) {
  if (status === "published") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "archived") return "border-zinc-300 bg-zinc-100 text-zinc-700";
  return "border-amber-200 bg-amber-50 text-amber-800";
}

function value(params: Record<string, string | string[] | undefined>, key: string) {
  const raw = params[key];
  return Array.isArray(raw) ? raw[0] : raw;
}

function feedbackTone(status?: string) {
  if (status === "success") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  return "border-amber-200 bg-amber-50 text-amber-900";
}

function StatusControls({ row }: { row?: CatalogRow }) {
  const status = row?.status ?? "draft";
  return (
    <div className="grid gap-3 md:grid-cols-[1.3fr_0.8fr_1fr]">
      <div className="space-y-1 text-sm font-medium">
        <span>Estado actual</span>
        <div className={`rounded-md border px-3 py-2 text-sm ${statusTone(status)}`}>
          <p className="font-semibold">{catalogStatusLabel(status)}</p>
          <p className="mt-1 text-xs opacity-80">{row?.published_at ? `published_at: ${new Date(row.published_at).toLocaleString("es-MX")}` : "Sin fecha de publicación"}</p>
        </div>
      </div>
      <label className="flex items-center gap-2 pt-7 text-sm font-medium">
        <input defaultChecked={row?.is_featured ?? false} name="is_featured" type="checkbox" /> Destacado
      </label>
      <div className="pt-7 text-xs text-muted-foreground">Guardar conserva el estado actual. Publicar, mover a borrador y archivar son acciones explícitas.</div>
    </div>
  );
}

function MediaPreview({ heroImageUrl, thumbnailImageUrl }: { heroImageUrl?: string | null; thumbnailImageUrl?: string | null }) {
  const hero = resolveCatalogMediaUrl(heroImageUrl);
  const thumbnail = resolveCatalogMediaUrl(thumbnailImageUrl);
  const preview = hero ?? thumbnail;

  if (!preview) {
    return <p className="text-xs text-muted-foreground">Sin media configurada.</p>;
  }

  return (
    <div className="space-y-2 rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
      <div className="flex gap-3">
        {preview ? (
          <Image
            alt=""
            src={preview}
            width={96}
            height={64}
            unoptimized
            className="h-16 w-24 rounded-md object-cover"
          />
        ) : null}
        <div className="space-y-1 break-all">
          <p><span className="font-medium text-foreground">Hero:</span> {hero ?? "—"}</p>
          <p><span className="font-medium text-foreground">Thumbnail:</span> {thumbnail ?? "—"}</p>
        </div>
      </div>
      <p>Cards públicas prefieren thumbnail. Detalles públicos prefieren hero.</p>
    </div>
  );
}

function MediaField({ name, label, currentValue }: { name: "hero_image_url" | "thumbnail_image_url"; label: string; currentValue?: string | null }) {
  const resolved = resolveCatalogMedia(currentValue);

  return (
    <div className="space-y-3 rounded-lg border p-3 md:col-span-2">
      <div className="space-y-1">
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-xs text-muted-foreground">Acepta URL absoluta o ref `storage://catalog-media/...`. Si subes un archivo, reemplaza el valor manual.</p>
      </div>

      <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
        <p><span className="font-medium text-foreground">Fuente actual:</span> {catalogMediaSourceLabel(currentValue)}</p>
        <p className="break-all"><span className="font-medium text-foreground">Valor guardado:</span> {currentValue ?? "Sin media"}</p>
        <p className="break-all"><span className="font-medium text-foreground">URL resuelta:</span> {resolved.url ?? "Sin preview"}</p>
      </div>

      <TextInput defaultValue={currentValue} label="URL pública o ref Storage" name={name} />
      <label className="space-y-1 text-sm font-medium">
        <span>Subir imagen</span>
        <input accept={CATALOG_MEDIA_ACCEPT} className="w-full rounded-md border px-3 py-2 text-sm" name={`${name}_file`} type="file" />
      </label>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input name={`${name}_clear`} type="checkbox" /> Limpiar valor actual
      </label>
    </div>
  );
}

function SharedBilingualFields({ row }: { row?: DestinationRow | ServiceRow | PackageRow }) {
  return (
    <>
      <TextInput defaultValue={row?.name_es} label="Nombre ES" name="name_es" required />
      <TextInput defaultValue={row?.name_en} label="Nombre EN" name="name_en" required />
      <TextInput defaultValue={row?.slug_es} label="Slug ES" name="slug_es" required />
      <TextInput defaultValue={row?.slug_en} label="Slug EN" name="slug_en" required />
      <TextArea defaultValue={row?.summary_es} label="Resumen ES" name="summary_es" />
      <TextArea defaultValue={row?.summary_en} label="Resumen EN" name="summary_en" />
      <TextArea defaultValue={row?.description_es} hint={DESCRIPTION_FIELD_HINT} label="Descripción ES" name="description_es" placeholder={DESCRIPTION_ES_PLACEHOLDER} />
      <TextArea defaultValue={row?.description_en} hint={DESCRIPTION_FIELD_HINT} label="Descripción EN" name="description_en" placeholder={DESCRIPTION_EN_PLACEHOLDER} />
    </>
  );
}

function CatalogForm({ resource, row, destinations, services, packages }: { resource: CatalogResource; row?: CatalogRow; destinations: { id: string; name_es: string }[]; services: { id: string; name_es: string }[]; packages: { id: string; name_es: string }[] }) {
  const destination = row as DestinationRow | undefined;
  const service = row as ServiceRow | undefined;
  const packageRow = row as PackageRow | undefined;
  const promotion = row as PromotionRow | undefined;
  const promotionServiceIds = resolvePromotionServiceIds(promotion ?? {});

  return (
    <form action={upsertCatalogAction} className="space-y-5 rounded-lg border p-4">
      <input name="resource" type="hidden" value={resource} />
      {row ? <input name="id" type="hidden" value={row.id} /> : null}
      <div className="grid gap-3 md:grid-cols-2">
        {resource === "destinations" ? (
          <>
            <SharedBilingualFields row={destination} />
            <TextInput defaultValue={destination?.country} label="País" name="country" required />
            <TextInput defaultValue={destination?.region} label="Región" name="region" />
            <DetailSectionsField row={destination} />
            <MediaField currentValue={destination?.hero_image_url} label="Hero image" name="hero_image_url" />
            <MediaField currentValue={destination?.thumbnail_image_url} label="Thumbnail image" name="thumbnail_image_url" />
            <div className="md:col-span-2"><MediaPreview heroImageUrl={destination?.hero_image_url} thumbnailImageUrl={destination?.thumbnail_image_url} /></div>
          </>
        ) : null}

        {resource === "services" ? (
          <>
            <SharedBilingualFields row={service} />
            <TextInput defaultValue={service?.price_from_mxn} label="Precio desde MXN" name="price_from_mxn" type="number" />
            <TextInput defaultValue={service?.price_from_usd} label="Precio desde USD" name="price_from_usd" type="number" />
            <TextInput defaultValue={service?.sort_order ?? 0} label="Orden" name="sort_order" type="number" />
            <DetailSectionsField row={service} />
            <MediaField currentValue={service?.hero_image_url} label="Hero image" name="hero_image_url" />
            <MediaField currentValue={service?.thumbnail_image_url} label="Thumbnail image" name="thumbnail_image_url" />
            <div className="md:col-span-2"><MediaPreview heroImageUrl={service?.hero_image_url} thumbnailImageUrl={service?.thumbnail_image_url} /></div>
          </>
        ) : null}

        {resource === "packages" ? (
          <>
            <SharedBilingualFields row={packageRow} />
            <TextInput defaultValue={packageRow?.price_from_mxn} label="Precio desde MXN" name="price_from_mxn" type="number" />
            <TextInput defaultValue={packageRow?.price_from_usd} label="Precio desde USD" name="price_from_usd" type="number" />
            <TextInput defaultValue={packageRow?.sort_order ?? 0} label="Orden" name="sort_order" type="number" />
            <DetailSectionsField row={packageRow} />
            <MediaField currentValue={packageRow?.hero_image_url} label="Hero image" name="hero_image_url" />
            <MediaField currentValue={packageRow?.thumbnail_image_url} label="Thumbnail image" name="thumbnail_image_url" />
            <div className="md:col-span-2"><MediaPreview heroImageUrl={packageRow?.hero_image_url} thumbnailImageUrl={packageRow?.thumbnail_image_url} /></div>
          </>
        ) : null}

        {resource === "promotions" ? (
          <>
            <TextInput defaultValue={promotion?.title_es} label="Título ES" name="title_es" required />
            <TextInput defaultValue={promotion?.title_en} label="Título EN" name="title_en" required />
            <TextInput defaultValue={promotion?.slug_es} label="Slug ES" name="slug_es" required />
            <TextInput defaultValue={promotion?.slug_en} label="Slug EN" name="slug_en" required />
            <label className="space-y-1 text-sm font-medium">
              <span>Destino</span>
              <select className="w-full rounded-md border px-3 py-2 text-sm" defaultValue={promotion?.destination_id ?? ""} name="destination_id">
                <option value="">Sin destino</option>
                {destinations.map((option) => <option key={option.id} value={option.id}>{option.name_es}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-sm font-medium">
              <span>Servicio</span>
              <select className="w-full rounded-md border px-3 py-2 text-sm" defaultValue={promotion?.package_id ?? ""} name="package_id">
                <option value="">Sin paquete</option>
                {packages.map((option) => <option key={option.id} value={option.id}>{option.name_es}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-sm font-medium md:col-span-2">
              <span>Servicios relacionados</span>
              <select className="min-h-40 w-full rounded-md border px-3 py-2 text-sm" defaultValue={promotionServiceIds} multiple name="service_ids">
                {services.map((option) => <option key={option.id} value={option.id}>{option.name_es}</option>)}
              </select>
              <p className="text-xs text-muted-foreground">Mantén Ctrl/Cmd para seleccionar más de un servicio. Guardamos también el primer servicio en el campo legacy para compatibilidad.</p>
            </label>
            <TextArea defaultValue={promotion?.summary_es} label="Resumen ES" name="summary_es" />
            <TextArea defaultValue={promotion?.summary_en} label="Resumen EN" name="summary_en" />
             <TextArea defaultValue={promotion?.details_es} hint={DESCRIPTION_FIELD_HINT} label="Detalles ES" name="details_es" placeholder={DESCRIPTION_ES_PLACEHOLDER} />
             <TextArea defaultValue={promotion?.details_en} hint={DESCRIPTION_FIELD_HINT} label="Detalles EN" name="details_en" placeholder={DESCRIPTION_EN_PLACEHOLDER} />
            <PromotionCommercialSectionsField row={promotion} />
            <TextInput defaultValue={promotion?.price_from_mxn} label="Precio desde MXN" name="price_from_mxn" type="number" />
            <TextInput defaultValue={promotion?.price_from_usd} label="Precio desde USD" name="price_from_usd" type="number" />
            <TextInput defaultValue={promotion?.starts_at?.slice(0, 10)} label="Inicio" name="starts_at" type="date" />
            <TextInput defaultValue={promotion?.ends_at?.slice(0, 10)} label="Fin" name="ends_at" type="date" />
            <MediaField currentValue={promotion?.hero_image_url} label="Hero image" name="hero_image_url" />
            <MediaField currentValue={promotion?.thumbnail_image_url} label="Thumbnail image" name="thumbnail_image_url" />
            <div className="md:col-span-2"><MediaPreview heroImageUrl={promotion?.hero_image_url} thumbnailImageUrl={promotion?.thumbnail_image_url} /></div>
          </>
        ) : null}
      </div>
      <StatusControls row={row} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit">{row ? "Guardar cambios" : "Crear borrador"}</Button>
        <Button formAction={publishCatalogAction} type="submit" variant="outline">
          {row ? (row.status === "published" ? "Actualizar publicado" : "Publicar") : "Crear y publicar"}
        </Button>
        {row && row.status !== "draft" ? (
          <Button formAction={moveCatalogToDraftAction} type="submit" variant="outline">
            Mover a borrador
          </Button>
        ) : null}
        {row && row.status !== "archived" ? <Button formAction={archiveCatalogAction} type="submit" variant="outline">Archivar</Button> : null}
        {row ? (
          <Button formAction={deleteCatalogAction} type="submit" variant="outline">
            Eliminar
          </Button>
        ) : null}
      </div>
    </form>
  );
}

function rowTitle(resource: CatalogResource, row: CatalogRow) {
  if (resource === "promotions") return (row as PromotionRow).title_es;
  return (row as DestinationRow | ServiceRow | PackageRow).name_es;
}

export default async function CatalogPage({ params, searchParams }: PageProps) {
  const [{ resource }, rawParams] = await Promise.all([params, searchParams, requireAdminRole(["admin", "marketing"])]);
  if (!isResource(resource)) notFound();
  const feedbackStatus = value(rawParams, "status");
  const feedbackMessage = value(rawParams, "message");
  const feedbackFocus = value(rawParams, "focus");
  const [{ rows, error }, options] = await Promise.all([getCatalogRows(resource), getCatalogOptions()]);
  const counts = rows.reduce((summary, row) => {
    const key = row.status === "published" || row.status === "archived" ? row.status : "draft";
    summary[key] += 1;
    return summary;
  }, { draft: 0, published: 0, archived: 0 } as Record<"draft" | "published" | "archived", number>);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--ac-blue)]">Catálogo</p>
        <h1 className="mt-2 text-3xl font-bold">{catalogResources[resource].label}</h1>
        <p className="mt-2 text-muted-foreground">CRUD bilingüe con media real, estados explícitos y publicación más segura.</p>
      </div>

      <nav className="flex flex-wrap gap-2">
        {Object.entries(catalogResources).map(([key, item]) => (
          <Button asChild key={key} variant={key === resource ? "default" : "outline"}>
            <Link href={item.href}>{item.label}</Link>
          </Button>
        ))}
      </nav>

      {feedbackMessage ? <Card className={feedbackTone(feedbackStatus)}><CardContent className="pt-6 text-sm">{feedbackMessage}</CardContent></Card> : null}
      {error ? <Card className="border-amber-200 bg-amber-50"><CardContent className="pt-6 text-sm text-amber-900">No se pudo cargar catálogo: {error}</CardContent></Card> : null}

      <div className="grid gap-3 md:grid-cols-3">
        <Card><CardContent className="pt-6 text-sm"><p className="font-semibold">Publicados</p><p className="mt-1 text-2xl font-bold">{counts.published}</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-sm"><p className="font-semibold">Borradores</p><p className="mt-1 text-2xl font-bold">{counts.draft}</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-sm"><p className="font-semibold">Archivados</p><p className="mt-1 text-2xl font-bold">{counts.archived}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Nuevo registro</CardTitle></CardHeader>
        <CardContent><CatalogForm destinations={options.destinations} packages={options.packages} resource={resource} services={options.services} /></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{rows.length} registros visibles</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {rows.length ? rows.map((row) => (
            <details className="rounded-lg border p-4" key={row.id} open={feedbackFocus === row.id}>
              <summary className="cursor-pointer font-semibold">
                {rowTitle(resource, row)} <span className="ml-2 text-xs font-normal text-muted-foreground">{row.status === "published" ? "Publicado" : row.status === "archived" ? "Archivado" : "Borrador"} · {row.published_at ? new Date(row.published_at).toLocaleDateString("es-MX") : "sin publicar"}</span>
              </summary>
              <div className="mt-4 space-y-4"><CatalogForm destinations={options.destinations} packages={options.packages} resource={resource} row={row} services={options.services} /></div>
            </details>
          )) : <p className="text-sm text-muted-foreground">No hay registros visibles para tu rol.</p>}
        </CardContent>
      </Card>
    </main>
  );
}
