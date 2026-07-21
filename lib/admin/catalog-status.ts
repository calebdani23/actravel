export type CatalogStatus = "draft" | "published" | "archived";

export type CatalogStatusSummary = {
  draft: number;
  published: number;
  archived: number;
  unknown: number;
  incomplete: number;
};

export function isCatalogStatus(status?: string | null): status is CatalogStatus {
  return status === "draft" || status === "published" || status === "archived";
}

export function catalogStatusLabel(status?: string | null) {
  if (status === "draft") return "Borrador";
  if (status === "published") return "Publicado";
  if (status === "archived") return "Archivado";
  return "Estado no identificado";
}

export function resolveCatalogStatusForDisplay(row?: { status?: string | null } | null) {
  return row ? row.status : "draft";
}

export function summarizeCatalogStatuses<T extends { status?: string | null }>(
  rows: readonly T[],
  isIncomplete: (row: T) => boolean,
): CatalogStatusSummary {
  return rows.reduce<CatalogStatusSummary>((summary, row) => {
    if (isCatalogStatus(row.status)) {
      summary[row.status] += 1;
    } else {
      summary.unknown += 1;
    }

    if (isIncomplete(row)) {
      summary.incomplete += 1;
    }

    return summary;
  }, { draft: 0, published: 0, archived: 0, unknown: 0, incomplete: 0 });
}
