import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/lib/supabase/database.types";

type Functions = Database["public"]["Functions"];
type QuoteCurrencyNullabilityOverlay = {
  current_currency: string | null;
  accepted_currency: string | null;
};
type QuotePageRow = Omit<Functions["crm_quote_page"]["Returns"][number], keyof QuoteCurrencyNullabilityOverlay> & QuoteCurrencyNullabilityOverlay;
type QuoteDetailRow = Omit<Functions["crm_quote_detail"]["Returns"][number], keyof QuoteCurrencyNullabilityOverlay> & QuoteCurrencyNullabilityOverlay;
type QuoteVersionRow = Functions["crm_quote_version_page"]["Returns"][number];
type QuoteRequestRow = Functions["crm_quote_request_link_page"]["Returns"][number];
type QuoteEventRow = Functions["crm_quote_event_page"]["Returns"][number];
type QuoteHandoffRow = Functions["crm_accepted_quote_handoff"]["Returns"][number];
type ContactOptionRow = Functions["crm_contact_aggregate_page"]["Returns"][number];
type OpportunityOptionRow = Functions["crm_contact_opportunity_page"]["Returns"][number];
type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ErrorLike = {
  code?: string;
  details?: string;
  hint?: string;
  message?: string;
  status?: number;
};

export type QuoteReadSection = "portfolio" | "detail" | "versions" | "requests" | "events" | "pdf" | "contacts" | "opportunities" | "request-options" | "handoff";

export type QuoteReadIssue = {
  code: string;
  message: string;
  section: QuoteReadSection;
};

export type QuoteDocumentDto = {
  id: string;
  state: string;
  bucket: string | null;
  path: string | null;
  mimeType: string;
  byteSize: number | null;
  sha256: string | null;
  uploadedAt: string | null;
  previewUrl: string | null;
  downloadUrl: string | null;
};

export type QuoteVersionSummaryDto = {
  id: string;
  number: number;
  title: string;
  status: string;
  currency: string;
  totalAmount: number | null;
  depositAmount: number | null;
  validUntil: string | null;
  finalizedAt: string | null;
  acceptedAt: string | null;
  updatedAt: string | null;
  document: QuoteDocumentDto | null;
};

export type QuotePortfolioItemDto = {
  id: string;
  number: string;
  title: string;
  status: string;
  lockVersion: number;
  contact: { id: string; name: string; email: string | null; phone: string | null };
  opportunity: { id: string; label: string };
  owner: { id: string | null; name: string | null };
  currentVersion: QuoteVersionSummaryDto | null;
  acceptedVersion: QuoteVersionSummaryDto | null;
  versionCount: number;
  requestCount: number;
  updatedAt: string;
  deletedAt: string | null;
};

export type QuoteDetailDto = QuotePortfolioItemDto & {
  createdBy: { id: string | null; name: string | null };
  originatingRequest: { id: string; status: string | null } | null;
  eventCount: number;
  nextVersionNumber: number;
  latestEvent: { type: string; at: string | null } | null;
  lifecycle: {
    readyAt: string | null;
    sentAt: string | null;
    acceptedAt: string | null;
    rejectedAt: string | null;
    expiredAt: string | null;
    cancelledAt: string | null;
  };
  createdAt: string;
  deletedBy: { id: string | null; name: string | null };
  deletedReason: string | null;
};

export type QuoteVersionDto = QuoteVersionSummaryDto & {
  summary: string | null;
  notes: string | null;
  requestId: string | null;
  contentSha256: string | null;
  createdBy: { id: string | null; name: string | null };
  finalizedBy: { id: string | null; name: string | null };
  sentAt: string | null;
  rejectedAt: string | null;
  expiredAt: string | null;
  createdAt: string;
};

export type QuoteRequestDto = {
  id: string;
  linkId: string;
  relation: string;
  status: string;
  locale: string;
  destination: string | null;
  service: string | null;
  requestedAt: string;
  linkedAt: string;
  linkedBy: { id: string | null; name: string | null };
};

export type QuoteEventDto = {
  id: string;
  quoteVersionId: string | null;
  actor: { id: string | null; name: string | null };
  type: string;
  payload: Json;
  createdAt: string;
};

export type QuoteHandoffDto = {
  quoteId: string;
  quoteNumber: string;
  quoteStatus: string;
  lockVersion: number;
  acceptedVersion: {
    id: string;
    number: number;
    title: string;
    currency: string;
    totalAmount: number | null;
    depositAmount: number | null;
    balanceAmount: number | null;
    validUntil: string | null;
    acceptedAt: string;
  };
  contact: { id: string; name: string };
  opportunity: {
    id: string;
    label: string;
    destinationId: string | null;
    serviceId: string | null;
    travelStartDate: string | null;
    travelEndDate: string | null;
    travelersCount: number;
  };
  ownerId: string | null;
  document: QuoteDocumentDto;
  operations: {
    bookingCount: number;
    latestBookingId: string | null;
    paymentCount: number;
    latestPaymentId: string | null;
    canManageBooking: boolean;
    canManagePayment: boolean;
  };
};

export type QuoteContactOption = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  opportunityCount: number;
};

export type QuoteOpportunityOption = {
  id: string;
  contactId: string;
  label: string;
  status: string;
  ownerName: string | null;
  updatedAt: string;
};

export type QuoteRequestOption = {
  id: string;
  contactId: string;
  opportunityId: string;
  status: string;
  locale: string;
  destination: string | null;
  service: string | null;
  createdAt: string;
};

export type QuoteCreateScope = {
  contactId: string;
  opportunityId: string;
  requestId: string | null;
};

export type QuoteCreatePrefill = {
  contactId: string | null;
  opportunityId: string | null;
  requestId: string | null;
};

export type QuotePortfolioFilters = {
  limit?: number;
  afterUpdatedAt?: string | null;
  afterId?: string | null;
  search?: string | null;
  status?: string | null;
  ownerId?: string | null;
  contactId?: string | null;
  opportunityId?: string | null;
  currency?: string | null;
  validity?: "all" | "valid" | "expired" | "no_expiry";
  pdf?: "ready" | "missing";
  view?: "drafts" | "ready" | "sent" | "accepted" | "expiring" | "missing_pdf";
  includeDeleted?: boolean;
};

export type OpportunityQuoteNavigation = {
  opportunityId: string;
  count: number;
  currentQuoteId: string | null;
  acceptedQuoteId: string | null;
};

function boundedLimit(value: number | undefined, fallback: number, maximum: number) {
  if (!Number.isInteger(value)) return fallback;
  return Math.min(maximum, Math.max(1, value ?? fallback));
}

function cleanSearch(value: string | null | undefined) {
  const normalized = value?.trim().slice(0, 120);
  return normalized || null;
}

function rows<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function readIssue(section: QuoteReadSection): QuoteReadIssue {
  const messages: Record<QuoteReadSection, string> = {
    portfolio: "No se pudo cargar la página de cotizaciones.",
    detail: "No se pudo cargar el detalle de la cotización.",
    versions: "No se pudo cargar el historial de versiones.",
    requests: "No se pudieron cargar las solicitudes vinculadas.",
    events: "No se pudo cargar la actividad de la cotización.",
    pdf: "El acceso temporal al PDF no está disponible.",
    contacts: "No se pudo cargar la búsqueda de contactos.",
    opportunities: "No se pudieron cargar las oportunidades del contacto.",
    "request-options": "No se pudieron cargar las solicitudes de la oportunidad.",
    handoff: "No se pudo cargar el contexto operativo de la cotización aceptada.",
  };
  return { code: `quote_${section.replace("-", "_")}_unavailable`, message: messages[section], section };
}

export function logQuoteServerDiagnostic(operation: string, error: unknown, context: Record<string, unknown> = {}) {
  const value = error && typeof error === "object" ? error as ErrorLike : {};
  console.error("[admin-quotes] server operation failed", {
    operation,
    context,
    error: {
      code: value.code ?? "unknown",
      details: value.details ?? null,
      hint: value.hint ?? null,
      message: value.message ?? (error instanceof Error ? error.message : "unknown"),
      status: value.status ?? null,
    },
  });
}

function mapDocument(input: {
  id: string | null;
  state: string | null;
  bucket?: string | null;
  path?: string | null;
  mimeType: string | null;
  byteSize: number | null;
  sha256: string | null;
  uploadedAt: string | null;
}): QuoteDocumentDto | null {
  if (!input.id || !input.state || !input.mimeType) return null;
  return {
    id: input.id,
    state: input.state,
    bucket: input.bucket ?? null,
    path: input.path ?? null,
    mimeType: input.mimeType,
    byteSize: input.byteSize,
    sha256: input.sha256,
    uploadedAt: input.uploadedAt,
    previewUrl: null,
    downloadUrl: null,
  };
}

function mapPageVersion(row: QuotePageRow, kind: "current" | "accepted"): QuoteVersionSummaryDto | null {
  const current = kind === "current";
  const id = current ? row.current_version_id : row.accepted_version_id;
  const number = current ? row.current_version_number : row.accepted_version_number;
  const title = current ? row.current_version_title : row.accepted_version_title;
  const status = current ? row.current_version_status : row.accepted_version_status;
  const currency = current ? row.current_currency : row.accepted_currency;
  if (!id || number === null || !title || !status || !currency) return null;
  return {
    id,
    number,
    title,
    status,
    currency,
    totalAmount: current ? row.current_total_amount : row.accepted_total_amount,
    depositAmount: current ? row.current_deposit_amount : row.accepted_deposit_amount,
    validUntil: current ? row.current_valid_until : row.accepted_valid_until,
    finalizedAt: current ? row.current_finalized_at : null,
    acceptedAt: current ? null : row.accepted_accepted_at,
    updatedAt: current ? row.current_updated_at : row.accepted_accepted_at,
    document: mapDocument({
      id: current ? row.current_document_id : row.accepted_document_id,
      state: current ? row.current_pdf_state : row.accepted_pdf_state,
      mimeType: current ? row.current_pdf_mime_type : row.accepted_pdf_mime_type,
      byteSize: current ? row.current_pdf_byte_size : row.accepted_pdf_byte_size,
      sha256: current ? row.current_pdf_sha256 : row.accepted_pdf_sha256,
      uploadedAt: current ? row.current_pdf_uploaded_at : row.accepted_pdf_uploaded_at,
    }),
  };
}

function mapPortfolioRow(row: QuotePageRow): QuotePortfolioItemDto {
  return {
    id: row.quote_id,
    number: row.quote_number,
    title: row.title,
    status: row.status,
    lockVersion: row.lock_version,
    contact: { id: row.contact_id, name: row.contact_name, email: row.contact_email, phone: row.contact_phone },
    opportunity: { id: row.opportunity_id, label: row.opportunity_label },
    owner: { id: row.owner_id, name: row.advisor_name },
    currentVersion: mapPageVersion(row, "current"),
    acceptedVersion: mapPageVersion(row, "accepted"),
    versionCount: row.version_count,
    requestCount: row.request_count,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function matchesPortfolioPostFilters(quote: QuotePortfolioItemDto, filters: QuotePortfolioFilters) {
  const readyPdf = quote.currentVersion?.document?.state === "ready";
  if (filters.pdf === "ready" && !readyPdf) return false;
  if (filters.pdf === "missing" && readyPdf) return false;
  if (filters.view === "missing_pdf") return !readyPdf;
  if (filters.view === "expiring") {
    const validUntil = quote.currentVersion?.validUntil;
    if (!validUntil) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const horizon = new Date(today);
    horizon.setDate(horizon.getDate() + 14);
    const expiry = new Date(`${validUntil}T00:00:00`);
    return expiry >= today && expiry <= horizon && ["ready", "sent"].includes(quote.status);
  }
  return true;
}

function mapDetailVersion(row: QuoteDetailRow, kind: "current" | "accepted"): QuoteVersionSummaryDto | null {
  const current = kind === "current";
  const id = current ? row.current_version_id : row.accepted_version_id;
  const number = current ? row.current_version_number : row.accepted_version_number;
  const title = current ? row.current_version_title : row.accepted_version_title;
  const status = current ? row.current_version_status : row.accepted_version_status;
  const currency = current ? row.current_currency : row.accepted_currency;
  if (!id || number === null || !title || !status || !currency) return null;
  return {
    id,
    number,
    title,
    status,
    currency,
    totalAmount: current ? row.current_total_amount : row.accepted_total_amount,
    depositAmount: current ? row.current_deposit_amount : row.accepted_deposit_amount,
    validUntil: current ? row.current_valid_until : row.accepted_valid_until,
    finalizedAt: current ? row.current_finalized_at : null,
    acceptedAt: current ? null : row.accepted_accepted_at,
    updatedAt: current ? row.updated_at : row.accepted_accepted_at,
    document: mapDocument({
      id: current ? row.current_document_id : row.accepted_document_id,
      state: current ? row.current_pdf_state : row.accepted_pdf_state,
      bucket: current ? row.current_pdf_bucket : row.accepted_pdf_bucket,
      path: current ? row.current_pdf_path : row.accepted_pdf_path,
      mimeType: current ? row.current_pdf_mime_type : row.accepted_pdf_mime_type,
      byteSize: current ? row.current_pdf_byte_size : row.accepted_pdf_byte_size,
      sha256: current ? row.current_pdf_sha256 : row.accepted_pdf_sha256,
      uploadedAt: current ? row.current_pdf_uploaded_at : row.accepted_pdf_uploaded_at,
    }),
  };
}

export function mapQuoteDetail(row: QuoteDetailRow): QuoteDetailDto {
  return {
    id: row.quote_id,
    number: row.quote_number,
    title: row.title,
    status: row.status,
    lockVersion: row.lock_version,
    contact: { id: row.contact_id, name: row.contact_name, email: row.contact_email, phone: row.contact_phone },
    opportunity: { id: row.opportunity_id, label: row.opportunity_label },
    owner: { id: row.owner_id, name: row.advisor_name },
    createdBy: { id: row.created_by, name: row.created_by_name },
    currentVersion: mapDetailVersion(row, "current"),
    acceptedVersion: mapDetailVersion(row, "accepted"),
    versionCount: row.version_count ?? 0,
    requestCount: row.request_count ?? 0,
    eventCount: row.event_count ?? 0,
    originatingRequest: row.originating_request_id ? { id: row.originating_request_id, status: row.originating_request_status } : null,
    nextVersionNumber: row.next_version_number ?? 1,
    latestEvent: row.latest_event_type ? { type: row.latest_event_type, at: row.latest_event_at } : null,
    lifecycle: {
      readyAt: row.ready_at,
      sentAt: row.sent_at,
      acceptedAt: row.accepted_at,
      rejectedAt: row.rejected_at,
      expiredAt: row.expired_at,
      cancelledAt: row.cancelled_at,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    deletedBy: { id: row.deleted_by, name: row.deleted_by_name },
    deletedReason: row.deleted_reason,
  };
}

function mapVersion(row: QuoteVersionRow): QuoteVersionDto {
  return {
    id: row.quote_version_id,
    number: row.version_number,
    title: row.title,
    summary: row.summary,
    status: row.status,
    currency: row.currency,
    totalAmount: row.total_amount,
    depositAmount: row.deposit_amount,
    validUntil: row.valid_until,
    notes: row.notes,
    requestId: row.quote_request_id,
    finalizedAt: row.finalized_at,
    contentSha256: row.content_sha256,
    sentAt: row.sent_at,
    acceptedAt: row.accepted_at,
    rejectedAt: row.rejected_at,
    expiredAt: row.expired_at,
    createdBy: { id: row.created_by, name: row.created_by_name },
    finalizedBy: { id: row.finalized_by, name: row.finalized_by_name },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    document: mapDocument({
      id: row.document_id,
      state: row.pdf_state,
      bucket: row.pdf_bucket,
      path: row.pdf_path,
      mimeType: row.pdf_mime_type,
      byteSize: row.pdf_byte_size,
      sha256: row.pdf_sha256,
      uploadedAt: row.pdf_uploaded_at,
    }),
  };
}

async function signCanonicalDocument(supabase: SupabaseServerClient, document: QuoteDocumentDto | null, context: Record<string, unknown>) {
  if (!document || document.state !== "ready" || document.mimeType !== "application/pdf" || !document.bucket || !document.path) return { document, issue: null };
  const [preview, download] = await Promise.all([
    supabase.storage.from(document.bucket).createSignedUrl(document.path, 60 * 10),
    supabase.storage.from(document.bucket).createSignedUrl(document.path, 60 * 10, { download: true }),
  ]);
  if (preview.error || download.error || !preview.data?.signedUrl || !download.data?.signedUrl) {
    logQuoteServerDiagnostic("sign-canonical-pdf", preview.error ?? download.error ?? new Error("signed_url_missing"), context);
    return { document, issue: readIssue("pdf") };
  }
  return {
    document: { ...document, previewUrl: preview.data.signedUrl, downloadUrl: download.data.signedUrl },
    issue: null,
  };
}

async function signVersionDocument(supabase: SupabaseServerClient, version: QuoteVersionSummaryDto | null, context: Record<string, unknown>) {
  if (!version) return { version, issue: null };
  const signed = await signCanonicalDocument(supabase, version.document, { ...context, quoteVersionId: version.id });
  return { version: { ...version, document: signed.document }, issue: signed.issue };
}

export async function getQuotePortfolio(filters: QuotePortfolioFilters = {}) {
  const supabase = await createClient();
  const limit = boundedLimit(filters.limit, 25, 100);
  if (Boolean(filters.afterUpdatedAt) !== Boolean(filters.afterId)) {
    return { quotes: [], pageHasMore: false, nextCursor: null, issues: [readIssue("portfolio")] };
  }
  const viewStatus = filters.view && ["drafts", "ready", "sent", "accepted"].includes(filters.view)
    ? filters.view === "drafts" ? "draft" : filters.view
    : null;
  const result = await supabase.rpc("crm_quote_page", {
    p_limit: limit,
    p_after_updated_at: filters.afterUpdatedAt ?? null,
    p_after_id: filters.afterId ?? null,
    p_search: cleanSearch(filters.search),
    p_status: filters.status ?? viewStatus,
    p_owner_id: filters.ownerId ?? null,
    p_contact_id: filters.contactId ?? null,
    p_opportunity_id: filters.opportunityId ?? null,
    p_currency: filters.currency ?? null,
    p_validity: filters.validity ?? "all",
    p_include_deleted: filters.includeDeleted ?? false,
  });
  if (result.error) {
    logQuoteServerDiagnostic("load-portfolio", result.error, { filters: { ...filters, search: filters.search ? "[provided]" : null } });
    return { quotes: [], pageHasMore: false, nextCursor: null, issues: [readIssue("portfolio")] };
  }
  const pageRows = rows<QuotePageRow>(result.data);
  const quotes = pageRows.map(mapPortfolioRow).filter((quote) => matchesPortfolioPostFilters(quote, filters));
  const pageHasMore = pageRows[0]?.page_has_more ?? false;
  const last = pageRows.at(-1);
  return {
    quotes,
    pageHasMore,
    nextCursor: pageHasMore && last ? { updatedAt: last.updated_at, id: last.quote_id } : null,
    issues: [] as QuoteReadIssue[],
  };
}

export async function getQuoteDetail(quoteId: string) {
  const supabase = await createClient();
  const result = await supabase.rpc("crm_quote_detail", { p_quote_id: quoteId });
  if (result.error) {
    logQuoteServerDiagnostic("load-detail", result.error, { quoteId });
    return { quote: null, issues: [readIssue("detail")] };
  }
  const row = rows<QuoteDetailRow>(result.data)[0];
  if (!row) return { quote: null, issues: [] as QuoteReadIssue[] };
  const quote = mapQuoteDetail(row);
  const [current, accepted] = await Promise.all([
    signVersionDocument(supabase, quote.currentVersion, { quoteId, pointer: "current" }),
    quote.acceptedVersion?.id === quote.currentVersion?.id
      ? Promise.resolve({ version: null, issue: null })
      : signVersionDocument(supabase, quote.acceptedVersion, { quoteId, pointer: "accepted" }),
  ]);
  const acceptedVersion = quote.acceptedVersion?.id === quote.currentVersion?.id ? current.version : accepted.version;
  return {
    quote: { ...quote, currentVersion: current.version, acceptedVersion },
    issues: [current.issue, accepted.issue].filter((issue): issue is QuoteReadIssue => Boolean(issue)),
  };
}

export async function getQuoteVersionPage(quoteId: string, options: { limit?: number; afterVersionNumber?: number | null; afterId?: string | null } = {}) {
  const supabase = await createClient();
  if (Boolean(options.afterVersionNumber) !== Boolean(options.afterId)) {
    return { versions: [], pageHasMore: false, nextCursor: null, issues: [readIssue("versions")] };
  }
  const result = await supabase.rpc("crm_quote_version_page", {
    p_quote_id: quoteId,
    p_limit: boundedLimit(options.limit, 20, 100),
    p_after_version_number: options.afterVersionNumber ?? null,
    p_after_id: options.afterId ?? null,
  });
  if (result.error) {
    logQuoteServerDiagnostic("load-versions", result.error, { quoteId });
    return { versions: [], pageHasMore: false, nextCursor: null, issues: [readIssue("versions")] };
  }
  const pageRows = rows<QuoteVersionRow>(result.data);
  const versions = pageRows.map(mapVersion);
  const signed = await Promise.all(versions.map(async (version) => {
    const access = await signCanonicalDocument(supabase, version.document, { quoteId, quoteVersionId: version.id });
    return { version: { ...version, document: access.document }, issue: access.issue };
  }));
  const pageHasMore = pageRows[0]?.page_has_more ?? false;
  const last = signed.at(-1)?.version;
  return {
    versions: signed.map((item) => item.version),
    pageHasMore,
    nextCursor: pageHasMore && last ? { versionNumber: last.number, id: last.id } : null,
    issues: signed.map((item) => item.issue).filter((issue): issue is QuoteReadIssue => Boolean(issue)),
  };
}

export async function getQuoteRequestPage(quoteId: string, options: { limit?: number; afterCreatedAt?: string | null; afterId?: string | null } = {}) {
  const supabase = await createClient();
  if (Boolean(options.afterCreatedAt) !== Boolean(options.afterId)) {
    return { requests: [], pageHasMore: false, nextCursor: null, issues: [readIssue("requests")] };
  }
  const result = await supabase.rpc("crm_quote_request_link_page", {
    p_quote_id: quoteId,
    p_limit: boundedLimit(options.limit, 20, 100),
    p_after_created_at: options.afterCreatedAt ?? null,
    p_after_id: options.afterId ?? null,
  });
  if (result.error) {
    logQuoteServerDiagnostic("load-requests", result.error, { quoteId });
    return { requests: [], pageHasMore: false, nextCursor: null, issues: [readIssue("requests")] };
  }
  const pageRows = rows<QuoteRequestRow>(result.data);
  const requests: QuoteRequestDto[] = pageRows.map((row) => ({
    id: row.quote_request_id,
    linkId: row.link_id,
    relation: row.relation,
    status: row.request_status,
    locale: row.request_locale,
    destination: row.destination_slug,
    service: row.service_slug,
    requestedAt: row.request_created_at,
    linkedAt: row.linked_at,
    linkedBy: { id: row.linked_by, name: row.linked_by_name },
  }));
  const pageHasMore = pageRows[0]?.page_has_more ?? false;
  const last = requests.at(-1);
  return {
    requests,
    pageHasMore,
    nextCursor: pageHasMore && last ? { createdAt: last.linkedAt, id: last.linkId } : null,
    issues: [] as QuoteReadIssue[],
  };
}

export async function getQuoteEventPage(quoteId: string, options: { limit?: number; afterCreatedAt?: string | null; afterId?: string | null } = {}) {
  const supabase = await createClient();
  if (Boolean(options.afterCreatedAt) !== Boolean(options.afterId)) {
    return { events: [], pageHasMore: false, nextCursor: null, issues: [readIssue("events")] };
  }
  const result = await supabase.rpc("crm_quote_event_page", {
    p_quote_id: quoteId,
    p_limit: boundedLimit(options.limit, 30, 100),
    p_after_created_at: options.afterCreatedAt ?? null,
    p_after_id: options.afterId ?? null,
  });
  if (result.error) {
    logQuoteServerDiagnostic("load-events", result.error, { quoteId });
    return { events: [], pageHasMore: false, nextCursor: null, issues: [readIssue("events")] };
  }
  const pageRows = rows<QuoteEventRow>(result.data);
  const events: QuoteEventDto[] = pageRows.map((row) => ({
    id: row.event_id,
    quoteVersionId: row.quote_version_id,
    actor: { id: row.actor_id, name: row.actor_name },
    type: row.event_type,
    payload: row.payload,
    createdAt: row.created_at,
  }));
  const pageHasMore = pageRows[0]?.page_has_more ?? false;
  const last = events.at(-1);
  return {
    events,
    pageHasMore,
    nextCursor: pageHasMore && last ? { createdAt: last.createdAt, id: last.id } : null,
    issues: [] as QuoteReadIssue[],
  };
}

export async function getAcceptedQuoteHandoff(quoteId: string) {
  const supabase = await createClient();
  const result = await supabase.rpc("crm_accepted_quote_handoff", { p_quote_id: quoteId });
  if (result.error) {
    logQuoteServerDiagnostic("load-handoff", result.error, { quoteId });
    return { handoff: null, issues: [readIssue("handoff")] };
  }
  const row = rows<QuoteHandoffRow>(result.data)[0];
  if (!row) return { handoff: null, issues: [] as QuoteReadIssue[] };
  const document = mapDocument({
    id: row.document_id,
    state: "ready",
    bucket: row.pdf_bucket,
    path: row.pdf_path,
    mimeType: "application/pdf",
    byteSize: row.pdf_byte_size,
    sha256: row.pdf_sha256,
    uploadedAt: null,
  });
  if (!document) {
    logQuoteServerDiagnostic("map-handoff-document", new Error("canonical_document_invalid"), { quoteId });
    return { handoff: null, issues: [readIssue("handoff")] };
  }
  const signed = await signCanonicalDocument(supabase, document, { quoteId, quoteVersionId: row.accepted_quote_version_id, pointer: "accepted-handoff" });
  const handoff: QuoteHandoffDto = {
    quoteId: row.quote_id,
    quoteNumber: row.quote_number,
    quoteStatus: row.quote_status,
    lockVersion: row.lock_version,
    acceptedVersion: {
      id: row.accepted_quote_version_id,
      number: row.accepted_version_number,
      title: row.accepted_title,
      currency: row.accepted_currency,
      totalAmount: row.accepted_total_amount,
      depositAmount: row.accepted_deposit_amount,
      balanceAmount: row.accepted_balance_amount,
      validUntil: row.accepted_valid_until,
      acceptedAt: row.accepted_at,
    },
    contact: { id: row.contact_id, name: row.contact_name },
    opportunity: {
      id: row.opportunity_id,
      label: row.opportunity_label,
      destinationId: row.destination_id,
      serviceId: row.service_id,
      travelStartDate: row.travel_start_date,
      travelEndDate: row.travel_end_date,
      travelersCount: row.travelers_count,
    },
    ownerId: row.owner_id,
    document: signed.document ?? document,
    operations: {
      bookingCount: row.linked_booking_count,
      latestBookingId: row.latest_booking_id,
      paymentCount: row.linked_payment_count,
      latestPaymentId: row.latest_payment_id,
      canManageBooking: row.can_manage_booking,
      canManagePayment: row.can_manage_payment,
    },
  };
  return { handoff, issues: signed.issue ? [signed.issue] : [] as QuoteReadIssue[] };
}

export async function getAcceptedQuoteHandoffByVersion(acceptedQuoteVersionId: string) {
  if (!UUID_PATTERN.test(acceptedQuoteVersionId)) return { handoff: null, issues: [readIssue("handoff")] };
  const supabase = await createClient();
  const quoteResult = await supabase
    .from("quotes")
    .select("id")
    .eq("accepted_version_id", acceptedQuoteVersionId)
    .is("deleted_at", null)
    .maybeSingle();
  if (quoteResult.error) {
    logQuoteServerDiagnostic("resolve-handoff-version", quoteResult.error, { acceptedQuoteVersionId });
    return { handoff: null, issues: [readIssue("handoff")] };
  }
  if (!quoteResult.data) return { handoff: null, issues: [] as QuoteReadIssue[] };
  const result = await getAcceptedQuoteHandoff(quoteResult.data.id);
  if (result.handoff?.acceptedVersion.id !== acceptedQuoteVersionId) {
    return { handoff: null, issues: [readIssue("handoff")] };
  }
  return result;
}

export async function getOpportunityQuoteNavigation(opportunityIds: string[]) {
  const ids = Array.from(new Set(opportunityIds.filter((id) => UUID_PATTERN.test(id)))).slice(0, 100);
  const supabase = await createClient();
  const results = await Promise.all(ids.map(async (opportunityId): Promise<{ item: OpportunityQuoteNavigation; issue: QuoteReadIssue | null }> => {
    const [countResult, currentResult, acceptedResult] = await Promise.all([
      supabase.from("quotes").select("id", { count: "exact", head: true }).eq("lead_id", opportunityId).is("deleted_at", null),
      supabase.from("quotes").select("id").eq("lead_id", opportunityId).is("deleted_at", null).order("updated_at", { ascending: false }).order("id", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("quotes").select("id").eq("lead_id", opportunityId).eq("status", "accepted").is("deleted_at", null).order("accepted_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    const error = countResult.error ?? currentResult.error ?? acceptedResult.error;
    if (error) logQuoteServerDiagnostic("load-opportunity-quote-navigation", error, { opportunityId });
    return {
      item: {
        opportunityId,
        count: countResult.count ?? 0,
        currentQuoteId: currentResult.data?.id ?? null,
        acceptedQuoteId: acceptedResult.data?.id ?? null,
      },
      issue: error ? readIssue("portfolio") : null,
    };
  }));
  return {
    items: results.map((result) => result.item),
    issues: results.map((result) => result.issue).filter((issue): issue is QuoteReadIssue => Boolean(issue)),
  };
}

export async function searchQuoteContacts(options: { search?: string | null; page?: number; limit?: number; selectedContactId?: string | null } = {}) {
  const supabase = await createClient();
  const limit = boundedLimit(options.limit, 20, 50);
  const page = Number.isInteger(options.page) ? Math.max(1, options.page ?? 1) : 1;
  const primary = await supabase.rpc("crm_contact_aggregate_page", {
    p_limit: limit,
    p_offset: (page - 1) * limit,
    p_include_deleted: false,
    p_deleted_only: false,
    p_search: cleanSearch(options.search),
  });
  const selected = options.selectedContactId
    ? await supabase.rpc("crm_contact_aggregate_page", {
        p_limit: 1,
        p_offset: 0,
        p_contact_id: options.selectedContactId,
        p_include_deleted: false,
        p_deleted_only: false,
      })
    : { data: [], error: null };
  if (primary.error) {
    logQuoteServerDiagnostic("search-contacts", primary.error, { page, search: options.search ? "[provided]" : null });
    return { contacts: [], pageHasMore: false, page, issues: [readIssue("contacts")] };
  }
  if (selected.error) logQuoteServerDiagnostic("load-selected-contact", selected.error, { contactId: options.selectedContactId });
  const primaryRows = rows<ContactOptionRow>(primary.data);
  const allRows = [...rows<ContactOptionRow>(selected.data), ...primaryRows];
  const seen = new Set<string>();
  const contacts: QuoteContactOption[] = allRows.filter((row) => {
    if (seen.has(row.contact_id)) return false;
    seen.add(row.contact_id);
    return true;
  }).map((row) => ({
    id: row.contact_id,
    name: [row.first_name, row.last_name].filter(Boolean).join(" "),
    email: row.email,
    phone: row.phone,
    opportunityCount: row.total_opportunity_count,
  }));
  const totalCount = primaryRows[0]?.total_count ?? 0;
  return {
    contacts,
    pageHasMore: page * limit < totalCount,
    page,
    issues: selected.error ? [readIssue("contacts")] : [] as QuoteReadIssue[],
  };
}

export async function getQuoteOpportunityOptions(contactId: string, options: { limit?: number; afterUpdatedAt?: string | null; afterId?: string | null } = {}) {
  const supabase = await createClient();
  if (Boolean(options.afterUpdatedAt) !== Boolean(options.afterId)) {
    return { opportunities: [], pageHasMore: false, nextCursor: null, issues: [readIssue("opportunities")] };
  }
  const result = await supabase.rpc("crm_contact_opportunity_page", {
    p_contact_id: contactId,
    p_state: "active",
    p_limit: boundedLimit(options.limit, 25, 100),
    p_after_updated_at: options.afterUpdatedAt ?? null,
    p_after_id: options.afterId ?? null,
  });
  if (result.error) {
    logQuoteServerDiagnostic("load-opportunity-options", result.error, { contactId });
    return { opportunities: [], pageHasMore: false, nextCursor: null, issues: [readIssue("opportunities")] };
  }
  const optionRows = rows<OpportunityOptionRow>(result.data);
  const opportunities: QuoteOpportunityOption[] = optionRows.map((row) => ({
    id: row.opportunity_id,
    contactId: row.contact_id,
    label: row.summary?.trim() || [row.destination_name, row.service_name].filter(Boolean).join(" / ") || `Oportunidad ${row.opportunity_id.slice(0, 8)}`,
    status: row.status_label,
    ownerName: row.owner_name,
    updatedAt: row.updated_at,
  }));
  const pageHasMore = optionRows[0]?.page_has_more ?? false;
  const last = opportunities.at(-1);
  return {
    opportunities,
    pageHasMore,
    nextCursor: pageHasMore && last ? { updatedAt: last.updatedAt, id: last.id } : null,
    issues: [] as QuoteReadIssue[],
  };
}

export async function getQuoteRequestOptions(contactId: string, opportunityId: string, options: { limit?: number; offset?: number } = {}) {
  const supabase = await createClient();
  const limit = boundedLimit(options.limit, 25, 50);
  const offset = Number.isInteger(options.offset) ? Math.max(0, options.offset ?? 0) : 0;
  const result = await supabase
    .from("quote_requests")
    .select("id, contact_id, lead_id, status, locale, destination_slug, service_slug, created_at")
    .eq("contact_id", contactId)
    .eq("lead_id", opportunityId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + limit);
  if (result.error) {
    logQuoteServerDiagnostic("load-request-options", result.error, { contactId, opportunityId, offset });
    return { requests: [], pageHasMore: false, nextOffset: null, issues: [readIssue("request-options")] };
  }
  const requestRows = (result.data ?? []).filter((row) => row.contact_id && row.lead_id);
  const pageHasMore = requestRows.length > limit;
  const requests: QuoteRequestOption[] = requestRows.slice(0, limit).map((row) => ({
    id: row.id,
    contactId: row.contact_id as string,
    opportunityId: row.lead_id as string,
    status: row.status,
    locale: row.locale,
    destination: row.destination_slug,
    service: row.service_slug,
    createdAt: row.created_at,
  }));
  return {
    requests,
    pageHasMore,
    nextOffset: pageHasMore ? offset + limit : null,
    issues: [] as QuoteReadIssue[],
  };
}

export async function getQuoteCreateFormOptions(options: { contactSearch?: string | null; contactPage?: number; selectedContactId?: string | null; selectedOpportunityId?: string | null; selectedRequestId?: string | null } = {}) {
  const prefill = await resolveQuoteCreatePrefill({
    contactId: options.selectedContactId,
    opportunityId: options.selectedOpportunityId,
    requestId: options.selectedRequestId,
  });
  const selectedContactId = prefill.selection.contactId;
  const selectedOpportunityId = prefill.selection.opportunityId;
  const contacts = await searchQuoteContacts({
    search: options.contactSearch,
    page: options.contactPage,
    selectedContactId,
  });
  const opportunities = selectedContactId
    ? await getQuoteOpportunityOptions(selectedContactId)
    : { opportunities: [], pageHasMore: false, nextCursor: null, issues: [] as QuoteReadIssue[] };
  const requests = selectedContactId && selectedOpportunityId
    ? await getQuoteRequestOptions(selectedContactId, selectedOpportunityId)
    : { requests: [], pageHasMore: false, nextOffset: null, issues: [] as QuoteReadIssue[] };
  return {
    prefill: prefill.selection,
    contacts: contacts.contacts,
    contactPageHasMore: contacts.pageHasMore,
    opportunities: opportunities.opportunities,
    opportunityPageHasMore: opportunities.pageHasMore,
    requests: requests.requests,
    requestPageHasMore: requests.pageHasMore,
    issues: [...prefill.issues, ...contacts.issues, ...opportunities.issues, ...requests.issues],
  };
}

export async function resolveQuoteCreatePrefill(input: { contactId?: string | null; opportunityId?: string | null; requestId?: string | null }) {
  const requested: QuoteCreatePrefill = {
    contactId: input.contactId && UUID_PATTERN.test(input.contactId) ? input.contactId : null,
    opportunityId: input.opportunityId && UUID_PATTERN.test(input.opportunityId) ? input.opportunityId : null,
    requestId: input.requestId && UUID_PATTERN.test(input.requestId) ? input.requestId : null,
  };
  const invalidProvidedId = Boolean(
    (input.contactId && !requested.contactId)
    || (input.opportunityId && !requested.opportunityId)
    || (input.requestId && !requested.requestId),
  );
  if (invalidProvidedId) return { selection: { contactId: null, opportunityId: null, requestId: null } as QuoteCreatePrefill, issues: [readIssue("opportunities")] };

  const supabase = await createClient();
  let requestScope: { contact_id: string | null; lead_id: string | null } | null = null;
  if (requested.requestId) {
    const request = await supabase.from("quote_requests").select("contact_id, lead_id").eq("id", requested.requestId).maybeSingle();
    if (request.error) {
      logQuoteServerDiagnostic("resolve-prefill-request", request.error, { requestId: requested.requestId });
      return { selection: { contactId: null, opportunityId: null, requestId: null } as QuoteCreatePrefill, issues: [readIssue("request-options")] };
    }
    if (!request.data?.contact_id || !request.data.lead_id) {
      return { selection: { contactId: requested.contactId, opportunityId: requested.opportunityId, requestId: null } as QuoteCreatePrefill, issues: [readIssue("request-options")] };
    }
    requestScope = request.data;
  }

  const opportunityId = requested.opportunityId ?? requestScope?.lead_id ?? null;
  if (!opportunityId) return { selection: { contactId: requested.contactId, opportunityId: null, requestId: null } as QuoteCreatePrefill, issues: [] as QuoteReadIssue[] };
  const opportunity = await supabase.from("leads").select("id, contact_id, deleted_at").eq("id", opportunityId).maybeSingle();
  if (opportunity.error) {
    logQuoteServerDiagnostic("resolve-prefill-opportunity", opportunity.error, { opportunityId });
    return { selection: { contactId: requested.contactId, opportunityId: null, requestId: null } as QuoteCreatePrefill, issues: [readIssue("opportunities")] };
  }
  if (!opportunity.data || opportunity.data.deleted_at) {
    return { selection: { contactId: requested.contactId, opportunityId: null, requestId: null } as QuoteCreatePrefill, issues: [readIssue("opportunities")] };
  }
  const derivedContactId = opportunity.data.contact_id;
  const scopeMismatch = Boolean(
    (requested.contactId && requested.contactId !== derivedContactId)
    || (requestScope && (requestScope.contact_id !== derivedContactId || requestScope.lead_id !== opportunity.data.id)),
  );
  if (scopeMismatch) return { selection: { contactId: null, opportunityId: null, requestId: null } as QuoteCreatePrefill, issues: [readIssue("opportunities")] };
  return {
    selection: { contactId: derivedContactId, opportunityId: opportunity.data.id, requestId: requestScope ? requested.requestId : null } as QuoteCreatePrefill,
    issues: [] as QuoteReadIssue[],
  };
}

export async function verifyQuoteCreateScope(contactId: string, opportunityId: string, requestId?: string | null): Promise<QuoteCreateScope | null> {
  const supabase = await createClient();
  const opportunity = await supabase.from("leads").select("id, contact_id, deleted_at").eq("id", opportunityId).maybeSingle();
  if (opportunity.error) {
    logQuoteServerDiagnostic("verify-create-opportunity", opportunity.error, { contactId, opportunityId });
    return null;
  }
  if (!opportunity.data || opportunity.data.deleted_at || opportunity.data.contact_id !== contactId) return null;
  if (requestId) {
    const request = await supabase.from("quote_requests").select("id, contact_id, lead_id").eq("id", requestId).maybeSingle();
    if (request.error) {
      logQuoteServerDiagnostic("verify-create-request", request.error, { contactId, opportunityId, requestId });
      return null;
    }
    if (!request.data || request.data.contact_id !== opportunity.data.contact_id || request.data.lead_id !== opportunity.data.id) return null;
  }
  return { contactId: opportunity.data.contact_id, opportunityId: opportunity.data.id, requestId: requestId ?? null };
}

export async function getQuoteWorkspace(quoteId: string, options: {
  versionAfterNumber?: number | null;
  versionAfterId?: string | null;
  requestAfterCreatedAt?: string | null;
  requestAfterId?: string | null;
  eventAfterCreatedAt?: string | null;
  eventAfterId?: string | null;
} = {}) {
  const [detail, versions, requests, events] = await Promise.all([
    getQuoteDetail(quoteId),
    getQuoteVersionPage(quoteId, { afterVersionNumber: options.versionAfterNumber, afterId: options.versionAfterId }),
    getQuoteRequestPage(quoteId, { afterCreatedAt: options.requestAfterCreatedAt, afterId: options.requestAfterId }),
    getQuoteEventPage(quoteId, { afterCreatedAt: options.eventAfterCreatedAt, afterId: options.eventAfterId }),
  ]);
  const handoff = detail.quote?.status === "accepted"
    ? await getAcceptedQuoteHandoff(quoteId)
    : { handoff: null, issues: [] as QuoteReadIssue[] };
  return {
    quote: detail.quote,
    versions: versions.versions,
    versionPage: { pageHasMore: versions.pageHasMore, nextCursor: versions.nextCursor },
    requests: requests.requests,
    requestPage: { pageHasMore: requests.pageHasMore, nextCursor: requests.nextCursor },
    events: events.events,
    eventPage: { pageHasMore: events.pageHasMore, nextCursor: events.nextCursor },
    handoff: handoff.handoff,
    issues: [...detail.issues, ...versions.issues, ...requests.issues, ...events.issues, ...handoff.issues],
  };
}

export function requireSingleQuoteMutationResult<T>(resultRows: readonly T[] | null | undefined, operation: string): T {
  if (!resultRows || resultRows.length !== 1) throw new Error(`${operation}_result_invalid`);
  return resultRows[0];
}
