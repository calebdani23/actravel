import type { RoleName } from "@/lib/supabase/roles";

export type AdminNavIcon =
  | "layout-dashboard"
  | "users-round"
  | "wallet"
  | "briefcase-business"
  | "file-text"
  | "map"
  | "package"
  | "messages-square"
  | "shield-alert"
  | "database-zap"
  | "user-cog"
  | "circle-user-round";

export type AdminNavGroup = "Resumen" | "Comercial" | "Contenido" | "Administración";

export type AdminNavItem = {
  href: string;
  label: string;
  group: AdminNavGroup;
  roles: RoleName[];
  icon: AdminNavIcon;
  matchPrefixes?: string[];
};

export const ADMIN_NAV_ITEMS = [
  {
    href: "/admin/dashboard",
    label: "Resumen",
    group: "Resumen",
    roles: ["admin", "asesor", "operaciones", "finanzas", "marketing"],
    icon: "layout-dashboard",
  },
  {
    href: "/admin/logs",
    label: "Registro",
    group: "Resumen",
    roles: ["admin", "marketing", "asesor"],
    icon: "shield-alert",
  },
  {
    href: "/admin/leads",
    label: "Prospectos",
    group: "Comercial",
    roles: ["admin", "asesor"],
    icon: "users-round",
    matchPrefixes: ["/admin/leads/"],
  },
  {
    href: "/admin/payments",
    label: "Pagos",
    group: "Comercial",
    roles: ["admin", "finanzas"],
    icon: "wallet",
  },
  {
    href: "/admin/operations/bookings",
    label: "Reservas",
    group: "Comercial",
    roles: ["admin", "operaciones"],
    icon: "briefcase-business",
  },
  {
    href: "/admin/operations/documents",
    label: "Documentos",
    group: "Comercial",
    roles: ["admin", "operaciones"],
    icon: "file-text",
  },
  {
    href: "/admin/catalog/destinations",
    label: "Destinos",
    group: "Contenido",
    roles: ["admin", "marketing"],
    icon: "map",
    matchPrefixes: ["/admin/catalog/destinations/"],
  },
  {
    href: "/admin/catalog/packages",
    label: "Paquetes",
    group: "Contenido",
    roles: ["admin", "marketing"],
    icon: "package",
    matchPrefixes: ["/admin/catalog/packages/"],
  },
  {
    href: "/admin/templates",
    label: "Plantillas",
    group: "Contenido",
    roles: ["admin", "marketing"],
    icon: "messages-square",
  },
  {
    href: "/admin/data-quality",
    label: "Calidad de datos",
    group: "Administración",
    roles: ["admin"],
    icon: "database-zap",
  },
  {
    href: "/admin/staff",
    label: "Usuarios",
    group: "Administración",
    roles: ["admin"],
    icon: "user-cog",
  },
  {
    href: "/admin/account",
    label: "Mi cuenta",
    group: "Administración",
    roles: ["admin", "asesor", "operaciones", "finanzas", "marketing"],
    icon: "circle-user-round",
  },
] satisfies AdminNavItem[];
