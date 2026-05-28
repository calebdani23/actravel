import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { catalogResources, getCatalogOptions, getCatalogRows, type CatalogResource, type DestinationRow, type PromotionRow, type ServiceRow } from "@/lib/admin/catalog";
import { requireAdminRole } from "@/lib/admin/auth";
import { deleteCatalogAction, upsertCatalogAction } from "../actions";

type PageProps = { params: Promise<{ resource: string }> };
type CatalogRow = DestinationRow | ServiceRow | PromotionRow;

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

function TextArea({ name, label, defaultValue }: { name: string; label: string; defaultValue?: string | null }) {
  return (
    <label className="space-y-1 text-sm font-medium md:col-span-2">
      <span>{label}</span>
      <textarea className="min-h-20 w-full rounded-md border px-3 py-2 text-sm" defaultValue={defaultValue ?? ""} name={name} />
    </label>
  );
}

function StatusControls({ row }: { row?: CatalogRow }) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <label className="space-y-1 text-sm font-medium">
        <span>Estado</span>
        <select className="w-full rounded-md border px-3 py-2 text-sm" defaultValue={row?.status ?? "draft"} name="status">
          <option value="draft">Borrador</option>
          <option value="published">Publicado</option>
          <option value="archived">Archivado</option>
        </select>
      </label>
      <label className="flex items-center gap-2 pt-7 text-sm font-medium">
        <input defaultChecked={row?.is_featured ?? false} name="is_featured" type="checkbox" /> Destacado
      </label>
      <div className="pt-7 text-xs text-muted-foreground">Al publicar se actualiza la fecha de publicación.</div>
    </div>
  );
}

function SharedBilingualFields({ row }: { row?: DestinationRow | ServiceRow }) {
  return (
    <>
      <TextInput defaultValue={row?.name_es} label="Nombre ES" name="name_es" required />
      <TextInput defaultValue={row?.name_en} label="Nombre EN" name="name_en" required />
      <TextInput defaultValue={row?.slug_es} label="Slug ES" name="slug_es" required />
      <TextInput defaultValue={row?.slug_en} label="Slug EN" name="slug_en" required />
      <TextArea defaultValue={row?.summary_es} label="Resumen ES" name="summary_es" />
      <TextArea defaultValue={row?.summary_en} label="Resumen EN" name="summary_en" />
      <TextArea defaultValue={row?.description_es} label="Descripción ES" name="description_es" />
      <TextArea defaultValue={row?.description_en} label="Descripción EN" name="description_en" />
    </>
  );
}

function CatalogForm({ resource, row, destinations, services }: { resource: CatalogResource; row?: CatalogRow; destinations: { id: string; name_es: string }[]; services: { id: string; name_es: string }[] }) {
  const destination = row as DestinationRow | undefined;
  const service = row as ServiceRow | undefined;
  const promotion = row as PromotionRow | undefined;

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
            <TextInput defaultValue={destination?.hero_image_url} label="Hero image URL" name="hero_image_url" />
            <TextInput defaultValue={destination?.thumbnail_image_url} label="Thumbnail image URL" name="thumbnail_image_url" />
          </>
        ) : null}

        {resource === "services" ? (
          <>
            <SharedBilingualFields row={service} />
            <TextInput defaultValue={service?.price_from_mxn} label="Precio desde MXN" name="price_from_mxn" type="number" />
            <TextInput defaultValue={service?.price_from_usd} label="Precio desde USD" name="price_from_usd" type="number" />
            <TextInput defaultValue={service?.sort_order ?? 0} label="Orden" name="sort_order" type="number" />
            <TextInput defaultValue={service?.hero_image_url} label="Hero image URL" name="hero_image_url" />
            <TextInput defaultValue={service?.thumbnail_image_url} label="Thumbnail image URL" name="thumbnail_image_url" />
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
              <select className="w-full rounded-md border px-3 py-2 text-sm" defaultValue={promotion?.service_id ?? ""} name="service_id">
                <option value="">Sin servicio</option>
                {services.map((option) => <option key={option.id} value={option.id}>{option.name_es}</option>)}
              </select>
            </label>
            <TextArea defaultValue={promotion?.summary_es} label="Resumen ES" name="summary_es" />
            <TextArea defaultValue={promotion?.summary_en} label="Resumen EN" name="summary_en" />
            <TextArea defaultValue={promotion?.details_es} label="Detalles ES" name="details_es" />
            <TextArea defaultValue={promotion?.details_en} label="Detalles EN" name="details_en" />
            <TextInput defaultValue={promotion?.price_from_mxn} label="Precio desde MXN" name="price_from_mxn" type="number" />
            <TextInput defaultValue={promotion?.price_from_usd} label="Precio desde USD" name="price_from_usd" type="number" />
            <TextInput defaultValue={promotion?.starts_at?.slice(0, 10)} label="Inicio" name="starts_at" type="date" />
            <TextInput defaultValue={promotion?.ends_at?.slice(0, 10)} label="Fin" name="ends_at" type="date" />
            <TextInput defaultValue={promotion?.hero_image_url} label="Hero image URL" name="hero_image_url" />
            <TextInput defaultValue={promotion?.thumbnail_image_url} label="Thumbnail image URL" name="thumbnail_image_url" />
          </>
        ) : null}
      </div>
      <StatusControls row={row} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit">{row ? "Guardar cambios" : "Crear"}</Button>
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
  return (row as DestinationRow | ServiceRow).name_es;
}

export default async function CatalogPage({ params }: PageProps) {
  const [{ resource }] = await Promise.all([params, requireAdminRole(["admin", "marketing"])]);
  if (!isResource(resource)) notFound();
  const [{ rows, error }, options] = await Promise.all([getCatalogRows(resource), getCatalogOptions()]);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--ac-blue)]">Catálogo</p>
        <h1 className="mt-2 text-3xl font-bold">{catalogResources[resource].label}</h1>
        <p className="mt-2 text-muted-foreground">CRUD ligero con campos bilingües, estado y publicación. La subida de media queda diferida.</p>
      </div>

      <nav className="flex flex-wrap gap-2">
        {Object.entries(catalogResources).map(([key, item]) => (
          <Button asChild key={key} variant={key === resource ? "default" : "outline"}>
            <Link href={item.href}>{item.label}</Link>
          </Button>
        ))}
      </nav>

      {error ? <Card className="border-amber-200 bg-amber-50"><CardContent className="pt-6 text-sm text-amber-900">No se pudo cargar catálogo: {error}</CardContent></Card> : null}

      <Card>
        <CardHeader><CardTitle>Nuevo registro</CardTitle></CardHeader>
        <CardContent><CatalogForm destinations={options.destinations} resource={resource} services={options.services} /></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{rows.length} registros visibles</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {rows.length ? rows.map((row) => (
            <details className="rounded-lg border p-4" key={row.id}>
              <summary className="cursor-pointer font-semibold">
                {rowTitle(resource, row)} <span className="ml-2 text-xs font-normal text-muted-foreground">{row.status} · {row.published_at ? new Date(row.published_at).toLocaleDateString("es-MX") : "sin publicar"}</span>
              </summary>
              <div className="mt-4"><CatalogForm destinations={options.destinations} resource={resource} row={row} services={options.services} /></div>
            </details>
          )) : <p className="text-sm text-muted-foreground">No hay registros visibles para tu rol.</p>}
        </CardContent>
      </Card>
    </main>
  );
}
