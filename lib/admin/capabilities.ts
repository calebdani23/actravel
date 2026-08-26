import type { RoleName } from "@/lib/supabase/roles";

export type CapabilityKey =
  | "discount:approve"
  | "handoff:accept"
  | "payment:verify"
  | "refund:approve"
  | "traveler:sensitive-read"
  | "identity:merge"
  | "content:publish"
  | "incident:escalate";

export const CAPABILITY_KEYS = [
  "discount:approve",
  "handoff:accept",
  "payment:verify",
  "refund:approve",
  "traveler:sensitive-read",
  "identity:merge",
  "content:publish",
  "incident:escalate",
] as const satisfies readonly CapabilityKey[];

export const CAPABILITY_GRANTS: Record<RoleName, readonly CapabilityKey[]> = {
  admin: CAPABILITY_KEYS,
  manager: ["discount:approve", "handoff:accept", "payment:verify", "refund:approve", "traveler:sensitive-read", "incident:escalate"],
  asesor: [],
  operaciones: ["handoff:accept", "traveler:sensitive-read", "incident:escalate"],
  finanzas: ["payment:verify", "refund:approve"],
  marketing: ["content:publish"],
};

export function canCapability(roles: readonly string[] | null | undefined, key: string): boolean {
  if (!CAPABILITY_KEYS.includes(key as CapabilityKey)) return false;

  return (roles ?? []).some((role): role is RoleName =>
    Object.prototype.hasOwnProperty.call(CAPABILITY_GRANTS, role) && CAPABILITY_GRANTS[role as RoleName].includes(key as CapabilityKey),
  );
}
