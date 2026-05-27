export const ROLE_NAMES = ["admin", "asesor", "operaciones", "finanzas", "marketing"] as const;

export type RoleName = (typeof ROLE_NAMES)[number];

export const ROLE_LABELS: Record<RoleName, string> = {
  admin: "Administrador",
  asesor: "Asesor",
  operaciones: "Operaciones",
  finanzas: "Finanzas",
  marketing: "Marketing",
};

export function isRoleName(value: string): value is RoleName {
  return ROLE_NAMES.includes(value as RoleName);
}

export function hasRole(roles: readonly string[] | null | undefined, role: RoleName) {
  return Boolean(roles?.includes(role));
}

export function hasAnyRole(roles: readonly string[] | null | undefined, allowed: readonly RoleName[]) {
  return allowed.some((role) => hasRole(roles, role));
}
