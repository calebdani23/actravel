type CatalogResource = "destinations" | "services" | "packages" | "promotions";
type CatalogWriteIntent = "save" | "publish" | "draft" | "archive";

const catalogResources = {
  destinations: { label: "Destinos" },
  services: { label: "Servicios" },
  packages: { label: "Paquetes" },
  promotions: { label: "Promociones" },
} satisfies Record<CatalogResource, { label: string }>;

const catalogResourceSingular = {
  destinations: "destino",
  services: "servicio",
  packages: "paquete",
  promotions: "promoción",
} satisfies Record<CatalogResource, string>;

type CatalogMutationRow = {
  id: string;
  slug_es?: string | null;
  slug_en?: string | null;
};

type CatalogMutationResult<Row extends CatalogMutationRow> = {
  data: Row | null;
  error: { message: string } | null;
};

type CatalogActionKind = CatalogWriteIntent | "delete";

export class CatalogAdminActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CatalogAdminActionError";
  }
}

function actionVerb(action: CatalogActionKind) {
  if (action === "publish") return "publicar";
  if (action === "draft") return "mover a borrador";
  if (action === "archive") return "archivar";
  if (action === "delete") return "eliminar";
  return "guardar";
}

function singularLabel(resource: CatalogResource) {
  return catalogResourceSingular[resource];
}

export function assertCatalogMutation<Row extends CatalogMutationRow>(
  result: CatalogMutationResult<Row>,
  options: { resource: CatalogResource; action: CatalogActionKind; id?: string | null },
) {
  if (result.error) {
    throw new CatalogAdminActionError(`No se pudo ${actionVerb(options.action)} el ${singularLabel(options.resource)}. ${result.error.message}`);
  }

  if (!result.data?.id) {
    const reason = options.id
      ? `No se encontró el ${singularLabel(options.resource)} a editar.`
      : `La operación no devolvió el nuevo ${singularLabel(options.resource)}.`;
    throw new CatalogAdminActionError(`No se pudo ${actionVerb(options.action)} el ${singularLabel(options.resource)}. ${reason} Recarga la página e inténtalo de nuevo.`);
  }

  return result.data;
}

export function assertCatalogExistingRecord<Row>(
  record: Row | null | undefined,
  options: { resource: CatalogResource; id: string },
) {
  if (!record) {
    throw new CatalogAdminActionError(`No se encontró el ${singularLabel(options.resource)} solicitado. Puede haber sido eliminado o ya no estar visible para tu rol.`);
  }

  return record;
}

export function catalogActionSuccessMessage(resource: CatalogResource, action: CatalogActionKind, existing: boolean) {
  const label = singularLabel(resource);

  if (action === "publish") return `${catalogResources[resource].label}: ${existing ? "publicación actualizada" : "publicado"} correctamente.`;
  if (action === "draft") return `${catalogResources[resource].label}: ${label} movido a borrador.`;
  if (action === "archive") return `${catalogResources[resource].label}: ${label} archivado.`;
  if (action === "delete") return `${catalogResources[resource].label}: ${label} eliminado.`;
  if (existing) return `${catalogResources[resource].label}: cambios guardados.`;
  return `${catalogResources[resource].label}: borrador creado.`;
}

export function buildCatalogAdminRedirectTarget(
  resource: CatalogResource,
  feedback: { status: "success" | "error"; message: string; focusId?: string | null },
) {
  const params = new URLSearchParams({ status: feedback.status, message: feedback.message });
  if (feedback.focusId) params.set("focus", feedback.focusId);
  return `/admin/catalog/${resource}?${params.toString()}`;
}

export function catalogActionErrorMessage(error: unknown) {
  if (error instanceof CatalogAdminActionError) return error.message;
  if (error instanceof Error && error.message.trim()) return `No se pudo completar la operación. ${error.message.trim()}`;
  return "No se pudo completar la operación. Intenta de nuevo y, si persiste, revisa el registro en Supabase.";
}
