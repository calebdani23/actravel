export const adminUiLocale = "es-MX";

const adminLongDateOptions: Intl.DateTimeFormatOptions = {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
};

function asValidDate(value: string | Date | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatAdminCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat(adminUiLocale, {
    style: "currency",
    currency,
    currencyDisplay: "code",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatAdminDateTime(value: string | Date) {
  return asValidDate(value)?.toLocaleString(adminUiLocale) ?? "Por definir";
}

export function formatAdminLongDate(value: string | Date) {
  return asValidDate(value)?.toLocaleDateString(adminUiLocale, adminLongDateOptions) ?? "Por definir";
}

export function formatAdminDate(value?: string | null) {
  if (!value) return "Por definir";
  return asValidDate(`${value}T00:00:00`)?.toLocaleDateString(adminUiLocale) ?? "Por definir";
}

export function formatAdminDateWindowLabel(value: string | Date, suffix: string) {
  return `${formatAdminLongDate(value)} · ${suffix}`;
}

export function formatAdminUtcWindowStartLabel(value: string | Date) {
  const date = asValidDate(value);
  return date ? `Desde ${formatAdminDateTime(date)} UTC` : "Desde horario por definir UTC";
}

export function formatAdminFollowUpLabel(value?: string | null) {
  if (!value) return undefined;
  const date = asValidDate(value);
  return date ? `Próximo: ${formatAdminDateTime(date)}` : "Próximo por definir";
}

export function formatAdminInteger(value: number) {
  return new Intl.NumberFormat(adminUiLocale).format(value);
}

export function formatAdminTravelerCount(value?: number | null) {
  const count = value ?? 0;
  return `${formatAdminInteger(count)} ${count === 1 ? "viajero" : "viajeros"}`;
}

type AdminLeadChipFilterKind = "status" | "destination" | "advisor";

const adminLeadChipUnknownLabels: Record<AdminLeadChipFilterKind, string> = {
  status: "Estado no identificado",
  destination: "Destino no identificado",
  advisor: "Asesor no identificado",
};

export function formatAdminLeadChipStructuredValue(
  kind: AdminLeadChipFilterKind,
  value: string,
  options: Array<{ value: string; label: string }>,
) {
  if (kind === "advisor" && value === "unassigned") return "Sin asignar";
  return options.find((option) => option.value === value)?.label ?? adminLeadChipUnknownLabels[kind];
}

export function formatAdminModuleLabelFromPath(pagePath?: string | null) {
  if (!pagePath) return "Módulo administrativo";

  const adminAliasLabels: Record<string, string> = {
    "admin-lead-detail": "Detalle del prospecto",
    "admin-lead-detail-template": "Seguimiento con plantilla",
    "admin-log-retry": "Reintento desde registros",
  };

  if (pagePath in adminAliasLabels) return adminAliasLabels[pagePath];
  if (pagePath.includes("/admin/dashboard")) return "Panel operativo";
  if (pagePath.includes("/admin/leads")) return "Módulo de prospectos";
  if (pagePath.includes("/admin/logs")) return "Módulo de registros";
  if (pagePath.includes("/admin")) return "Módulo administrativo";
  if (pagePath.startsWith("admin-")) return "Módulo administrativo";
  return "Sitio público";
}
