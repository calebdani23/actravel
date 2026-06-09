import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/lib/supabase/database.types";
import { normalizeEmail, normalizeWhatsApp } from "@/lib/validations/quote-request";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;
type ContactRow = Database["public"]["Tables"]["contacts"]["Row"];
type DuplicateGroupKind = "email" | "phone";
type ReferenceTableKey = "leads" | "quote_requests" | "bookings" | "payments" | "documents" | "notifications" | "whatsapp_clicks";
type ContactDependencyCounts = Record<ReferenceTableKey, number>;
type ContactReferenceRow = { id: string; contact_id: string | null };
type AmbiguousIdentityEventRow = Pick<Database["public"]["Tables"]["lead_events"]["Row"], "id" | "lead_id" | "created_at" | "payload">;

export type DuplicateGroupContact = {
  id: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  normalizedEmail: string | null;
  normalizedPhone: string | null;
  createdAt: string;
  updatedAt: string;
  totalDependencies: number;
  dependencyCounts: ContactDependencyCounts;
};

export type DuplicateGroupPlan = {
  kind: DuplicateGroupKind;
  normalizedValue: string;
  contacts: DuplicateGroupContact[];
  canonicalContactId: string;
  impactSummary: ContactDependencyCounts & { total: number };
  manualMergeGuidance: string[];
};

export type AmbiguousIdentityCase = {
  id: string;
  leadId: string;
  createdAt: string;
  reason: string | null;
  matchedContactIds: string[];
};

export type DuplicateAuditReport = {
  generatedAt: string;
  totalContacts: number;
  duplicateEmailGroups: DuplicateGroupPlan[];
  duplicatePhoneGroups: DuplicateGroupPlan[];
  ambiguousIdentityEvents: number;
  ambiguousIdentityCases: AmbiguousIdentityCase[];
  strategy: {
    deferredReason: string;
    readinessChecklist: string[];
  };
};

const PAGE_SIZE = 1000;
const referenceTableLabels: Record<ReferenceTableKey, string> = {
  leads: "leads",
  quote_requests: "quote_requests",
  bookings: "bookings",
  payments: "payments",
  documents: "documents",
  notifications: "notifications",
  whatsapp_clicks: "whatsapp clicks",
};

function emptyDependencyCounts(): ContactDependencyCounts {
  return { leads: 0, quote_requests: 0, bookings: 0, payments: 0, documents: 0, notifications: 0, whatsapp_clicks: 0 };
}

function totalDependencies(counts: ContactDependencyCounts) {
  return Object.values(counts).reduce((sum, value) => sum + value, 0);
}

function contactDisplayName(contact: Pick<ContactRow, "first_name" | "last_name">) {
  return [contact.first_name, contact.last_name].filter(Boolean).join(" ") || "Sin nombre";
}

function safeJsonObject(value: Json): Record<string, Json> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, Json>) : null;
}

function safeJsonString(value: Json | undefined) {
  return typeof value === "string" ? value : null;
}

function safeJsonStringArray(value: Json | undefined) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

async function paginate<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const rows: T[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  return rows;
}

async function fetchContacts(supabase: SupabaseClient) {
  return paginate<ContactRow>((from, to) =>
    supabase
      .from("contacts")
      .select("id, first_name, last_name, email, phone, source, preferred_locale, consent_marketing, notes, created_at, updated_at")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to),
  );
}

async function fetchReferences(supabase: SupabaseClient, table: "leads" | "quote_requests" | "bookings" | "payments" | "documents" | "notification_logs" | "whatsapp_clicks") {
  return paginate<ContactReferenceRow>((from, to) =>
    supabase
      .from(table)
      .select("id, contact_id")
      .order("id", { ascending: true })
      .range(from, to),
  );
}

async function fetchAmbiguousIdentityEvents(supabase: SupabaseClient) {
  return paginate<AmbiguousIdentityEventRow>((from, to) =>
    supabase
      .from("lead_events")
      .select("id, lead_id, created_at, payload")
      .eq("event_type", "contact_identity_ambiguous")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, to),
  );
}

function buildDependencyIndex(input: { leads: ContactReferenceRow[]; quoteRequests: ContactReferenceRow[]; bookings: ContactReferenceRow[]; payments: ContactReferenceRow[]; documents: ContactReferenceRow[]; notifications: ContactReferenceRow[]; whatsappClicks: ContactReferenceRow[] }) {
  const index = new Map<string, ContactDependencyCounts>();

  const applyRows = (rows: ContactReferenceRow[], key: ReferenceTableKey) => {
    for (const row of rows) {
      if (!row.contact_id) continue;
      const current = index.get(row.contact_id) ?? emptyDependencyCounts();
      current[key] += 1;
      index.set(row.contact_id, current);
    }
  };

  applyRows(input.leads, "leads");
  applyRows(input.quoteRequests, "quote_requests");
  applyRows(input.bookings, "bookings");
  applyRows(input.payments, "payments");
  applyRows(input.documents, "documents");
  applyRows(input.notifications, "notifications");
  applyRows(input.whatsappClicks, "whatsapp_clicks");

  return index;
}

function buildDuplicateGroupKey(kind: DuplicateGroupKind, normalizedValue: string) {
  return `${kind}:${normalizedValue}`;
}

function buildDuplicateGroupPlans(contacts: ContactRow[], dependencyIndex: Map<string, ContactDependencyCounts>) {
  const groups = new Map<string, { kind: DuplicateGroupKind; normalizedValue: string; contacts: ContactRow[] }>();

  for (const contact of contacts) {
    const normalizedEmail = normalizeEmail(contact.email);
    const normalizedPhone = contact.phone ? normalizeWhatsApp(contact.phone) : null;

    if (normalizedEmail) {
      const key = buildDuplicateGroupKey("email", normalizedEmail);
      const group = groups.get(key) ?? { kind: "email" as const, normalizedValue: normalizedEmail, contacts: [] };
      group.contacts.push(contact);
      groups.set(key, group);
    }

    if (normalizedPhone) {
      const key = buildDuplicateGroupKey("phone", normalizedPhone);
      const group = groups.get(key) ?? { kind: "phone" as const, normalizedValue: normalizedPhone, contacts: [] };
      group.contacts.push(contact);
      groups.set(key, group);
    }
  }

  return [...groups.values()]
    .filter((group) => group.contacts.length > 1)
    .map((group) => buildDuplicateGroupPlan(group.kind, group.normalizedValue, group.contacts, dependencyIndex))
    .sort((a, b) => b.impactSummary.total - a.impactSummary.total || b.contacts.length - a.contacts.length || a.normalizedValue.localeCompare(b.normalizedValue));
}

function buildDuplicateGroupPlan(kind: DuplicateGroupKind, normalizedValue: string, contacts: ContactRow[], dependencyIndex: Map<string, ContactDependencyCounts>): DuplicateGroupPlan {
  const duplicateContacts = contacts
    .map((contact) => {
      const normalizedEmail = normalizeEmail(contact.email);
      const normalizedPhone = contact.phone ? normalizeWhatsApp(contact.phone) : null;
      const dependencyCounts = { ...(dependencyIndex.get(contact.id) ?? emptyDependencyCounts()) };

      return {
        id: contact.id,
        displayName: contactDisplayName(contact),
        email: contact.email,
        phone: contact.phone,
        normalizedEmail,
        normalizedPhone,
        createdAt: contact.created_at,
        updatedAt: contact.updated_at,
        totalDependencies: totalDependencies(dependencyCounts),
        dependencyCounts,
      } satisfies DuplicateGroupContact;
    })
    .sort((a, b) => compareCanonicalPriority(a, b));

  const canonicalContactId = duplicateContacts[0]?.id ?? "";
  const impactSummary = duplicateContacts.reduce<ContactDependencyCounts & { total: number }>(
    (summary, contact) => {
      for (const key of Object.keys(contact.dependencyCounts) as ReferenceTableKey[]) {
        summary[key] += contact.dependencyCounts[key];
      }
      summary.total += contact.totalDependencies;
      return summary;
    },
    { ...emptyDependencyCounts(), total: 0 },
  );

  return {
    kind,
    normalizedValue,
    contacts: duplicateContacts,
    canonicalContactId,
    impactSummary,
    manualMergeGuidance: [
      `Mover referencias en ${Object.entries(impactSummary).filter(([key, value]) => key !== "total" && value > 0).map(([key, value]) => `${value} ${referenceTableLabels[key as ReferenceTableKey]}`).join(", ") || "tablas relacionadas"} dentro de una transacción evita relaciones huérfanas.`,
      "La recomendación canónica usa una heurística determinista; no prueba intención humana ni identidad legal.",
      "Los duplicados por email o teléfono pueden representar familiares, teléfonos compartidos o contactos capturados con cambios parciales; la revisión debe ser manual antes de consolidar.",
    ],
  };
}

function compareCanonicalPriority(a: DuplicateGroupContact, b: DuplicateGroupContact) {
  const aCompleteness = (a.normalizedEmail ? 1 : 0) + (a.normalizedPhone ? 1 : 0);
  const bCompleteness = (b.normalizedEmail ? 1 : 0) + (b.normalizedPhone ? 1 : 0);

  return (
    b.totalDependencies - a.totalDependencies ||
    bCompleteness - aCompleteness ||
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() ||
    a.id.localeCompare(b.id)
  );
}

function buildAmbiguousIdentityCases(events: AmbiguousIdentityEventRow[]) {
  return events.slice(0, 10).map((event) => {
    const payload = safeJsonObject(event.payload);
    const identityResolution = payload ? safeJsonObject(payload.identityResolution) : null;

    return {
      id: event.id,
      leadId: event.lead_id,
      createdAt: event.created_at,
      reason: identityResolution ? safeJsonString(identityResolution.reason) : null,
      matchedContactIds: identityResolution ? safeJsonStringArray(identityResolution.matchedContactIds) : [],
    } satisfies AmbiguousIdentityCase;
  });
}

export async function getDuplicateAuditReport(): Promise<DuplicateAuditReport> {
  const supabase = await createClient();
  const [contacts, leads, quoteRequests, bookings, payments, documents, notifications, whatsappClicks, ambiguousEvents] = await Promise.all([
    fetchContacts(supabase),
    fetchReferences(supabase, "leads"),
    fetchReferences(supabase, "quote_requests"),
    fetchReferences(supabase, "bookings"),
    fetchReferences(supabase, "payments"),
    fetchReferences(supabase, "documents"),
    fetchReferences(supabase, "notification_logs"),
    fetchReferences(supabase, "whatsapp_clicks"),
    fetchAmbiguousIdentityEvents(supabase),
  ]);

  const dependencyIndex = buildDependencyIndex({ leads, quoteRequests, bookings, payments, documents, notifications, whatsappClicks });
  const duplicateGroups = buildDuplicateGroupPlans(contacts, dependencyIndex);

  return {
    generatedAt: new Date().toISOString(),
    totalContacts: contacts.length,
    duplicateEmailGroups: duplicateGroups.filter((group) => group.kind === "email"),
    duplicatePhoneGroups: duplicateGroups.filter((group) => group.kind === "phone"),
    ambiguousIdentityEvents: ambiguousEvents.length,
    ambiguousIdentityCases: buildAmbiguousIdentityCases(ambiguousEvents),
    strategy: {
      deferredReason: "Las constraints únicas duras y merges automáticos siguen diferidos porque todavía falta una corrida sostenida con duplicados en cero, un workflow transaccional de re-pointing auditado y validación humana de casos ambiguos históricos.",
      readinessChecklist: [
        "Backlog de grupos duplicados y eventos ambiguos revisado y estable durante varias corridas operativas.",
        "Playbook de merge manual/transaccional definido con orden explícito para mover leads, quote_requests, bookings, payments, documents, notifications y whatsapp clicks.",
        "Pruebas y dry-run sobre staging con rollback claro para re-pointing de contactos y validación posterior de integridad.",
        "Normalización de intake y de datos legacy confirmada para teléfono/email antes de exigir unicidad a nivel base de datos.",
      ],
    },
  };
}

export async function getDuplicateAuditSnapshot() {
  const report = await getDuplicateAuditReport();

  return {
    totalContacts: report.totalContacts,
    duplicateEmailGroups: report.duplicateEmailGroups.length,
    duplicatePhoneGroups: report.duplicatePhoneGroups.length,
    ambiguousIdentityEvents: report.ambiguousIdentityEvents,
  };
}

export const dataQualityInternals = {
  buildDependencyIndex,
  buildDuplicateGroupPlans,
  buildAmbiguousIdentityCases,
  compareCanonicalPriority,
  emptyDependencyCounts,
  totalDependencies,
};
