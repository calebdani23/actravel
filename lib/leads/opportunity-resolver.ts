import type { Json } from "@/lib/supabase/database.types";

export const OPPORTUNITY_SIGNATURE_VERSION = 1 as const;

const WEAK_SERVICE_SLUGS = new Set([
  "cotizacion",
  "cotizaciones",
  "cotizar",
  "otro",
  "otros",
  "other",
  "package",
  "packages",
  "paquete",
  "paquetes",
  "service",
  "services",
  "servicio",
  "servicios",
  "travel",
  "trip",
  "viaje",
  "viajes",
]);

export type OpportunityPurposeInput = {
  destinationId?: string | null;
  destinationName?: string | null;
  serviceId?: string | null;
  serviceName?: string | null;
};

export type OpportunityPurposeSignature = {
  basis: Json;
  reliable: boolean;
  signature: string | null;
  version: typeof OPPORTUNITY_SIGNATURE_VERSION;
};

export type OpportunityCandidate = {
  created_at: string;
  id: string;
  lead_statuses?: { is_terminal: boolean } | null;
  updated_at: string;
};

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || null;
}

function compactText(value?: string | null, maxLength = 160) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function buildDestinationToken(input: OpportunityPurposeInput) {
  if (input.destinationId?.trim()) return `dest:${input.destinationId.trim()}`;
  const slug = slugify(input.destinationName ?? "");
  return slug && slug.length >= 3 ? `destslug:${slug}` : null;
}

function buildServiceToken(input: OpportunityPurposeInput) {
  if (input.serviceId?.trim()) return `svc:${input.serviceId.trim()}`;
  const slug = slugify(input.serviceName ?? "");
  return slug && slug.length >= 4 && !WEAK_SERVICE_SLUGS.has(slug) ? `svcslug:${slug}` : null;
}

export function buildOpportunityPurposeSignature(input: OpportunityPurposeInput): OpportunityPurposeSignature {
  const destinationToken = buildDestinationToken(input);
  const serviceToken = buildServiceToken(input);
  const reliable = Boolean(destinationToken && serviceToken);

  return {
    signature: reliable ? `opp:v${OPPORTUNITY_SIGNATURE_VERSION}|${destinationToken}|${serviceToken}` : null,
    version: OPPORTUNITY_SIGNATURE_VERSION,
    reliable,
    basis: {
      version: OPPORTUNITY_SIGNATURE_VERSION,
      reliablePurpose: reliable,
      destination: {
        id: compactText(input.destinationId),
        label: compactText(input.destinationName),
        token: destinationToken,
        reliable: Boolean(destinationToken),
      },
      service: {
        id: compactText(input.serviceId),
        label: compactText(input.serviceName),
        token: serviceToken,
        reliable: Boolean(serviceToken),
      },
    } satisfies Json,
  };
}

export function compareOpportunityCandidatePriority(a: OpportunityCandidate, b: OpportunityCandidate) {
  return (
    Number(a.lead_statuses?.is_terminal === true) - Number(b.lead_statuses?.is_terminal === true) ||
    new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime() ||
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime() ||
    a.id.localeCompare(b.id)
  );
}

export function pickReusableOpportunity(candidates: OpportunityCandidate[]) {
  return [...candidates].sort(compareOpportunityCandidatePriority)[0] ?? null;
}
