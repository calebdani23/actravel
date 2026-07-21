import { formatAdminCurrency, formatAdminDate, formatAdminDateTime, formatAdminInteger } from "@/lib/admin/format";

type ContactLike = { first_name: string | null; last_name: string | null; email: string | null; phone: string | null } | null;
type LeadLike = { id: string; summary: string | null; contacts?: ContactLike } | null;
type BookingLike = { id: string; booking_code: string | null; status: string } | null;

export type PaymentFilters = {
  q?: string;
  relation?: string;
  status?: string;
  method?: string;
  type?: string;
  currency?: string;
  from?: string;
  to?: string;
  reconciliation?: string;
};

export type BookingFilters = {
  q?: string;
  status?: string;
  advisor?: string;
  destination?: string;
  from?: string;
  to?: string;
};

export type DocumentFilters = {
  q?: string;
  status?: string;
  type?: string;
  relation?: string;
  from?: string;
  to?: string;
};

export function contactDisplayName(contact: ContactLike) {
  if (!contact) return "Contacto no identificado";
  return [contact.first_name, contact.last_name].filter(Boolean).join(" ").trim() || contact.email || contact.phone || "Contacto no identificado";
}

export function leadDisplayName(lead: LeadLike) {
  if (!lead) return "Sin prospecto";
  return lead.summary?.trim() || contactDisplayName(lead.contacts ?? null) || "Prospecto relacionado";
}

export function bookingDisplayName(booking: BookingLike) {
  if (!booking) return "Sin reserva";
  return booking.booking_code?.trim() || "Reserva sin código";
}

export function paymentTypeLabel(type?: string | null) {
  const labels: Record<string, string> = {
    deposit: "Anticipo",
    partial: "Parcial",
    balance: "Liquidación",
    full: "Pago total",
    refund: "Reembolso",
  };
  if (!type) return "Tipo de pago no identificado";
  return labels[type] ?? "Tipo de pago no identificado";
}

export function paymentStatusLabel(status?: string | null) {
  const labels: Record<string, string> = {
    pending: "Pendiente",
    received: "Recibido",
    verified: "Verificado",
    rejected: "Rechazado",
    refunded: "Reembolsado",
  };
  if (!status) return "Estado de pago no identificado";
  return labels[status] ?? "Estado de pago no identificado";
}

export function bookingStatusLabel(status?: string | null) {
  const labels: Record<string, string> = {
    draft: "Borrador",
    confirmed: "Confirmada",
    in_progress: "En viaje",
    completed: "Completada",
    cancelled: "Cancelada",
  };
  if (!status) return "Estado de reserva no identificado";
  return labels[status] ?? "Estado de reserva no identificado";
}

export function documentStatusLabel(status?: string | null) {
  const labels: Record<string, string> = {
    draft: "Borrador",
    active: "Activo",
    archived: "Archivado",
  };
  if (!status) return "Estado no identificado";
  return labels[status] ?? "Estado no identificado";
}

export function documentTypeLabel(type?: string | null) {
  const labels: Record<string, string> = {
    itinerary: "Itinerario",
    voucher: "Voucher",
    invoice: "Factura",
    identification: "Identificación",
    contract: "Contrato",
    passport: "Pasaporte",
    visa: "Visa",
    insurance: "Seguro",
    ticket: "Boleto",
    receipt: "Recibo",
    other: "Otro",
  };
  if (!type) return "Documento operativo";
  return labels[type] ?? "Documento operativo";
}

export function paymentStatusTone(status?: string | null) {
  if (status === "verified") return "success" as const;
  if (status === "received") return "info" as const;
  if (status === "pending") return "warning" as const;
  if (status === "rejected") return "error" as const;
  return "neutral" as const;
}

export function bookingStatusTone(status?: string | null) {
  if (status === "completed") return "success" as const;
  if (status === "confirmed" || status === "in_progress") return "brand" as const;
  if (status === "draft") return "warning" as const;
  return "neutral" as const;
}

export function documentStatusTone(status?: string | null) {
  if (status === "active") return "success" as const;
  if (status === "draft") return "warning" as const;
  return "neutral" as const;
}

function normalized(value?: string | null) {
  return value?.trim().toLocaleLowerCase("es-MX") ?? "";
}

function sameDateOrAfter(value: string, from?: string) {
  return !from || value >= from;
}

function sameDateOrBefore(value: string, to?: string) {
  return !to || value <= to;
}

export function matchesDateRange(value: string | null | undefined, from?: string, to?: string) {
  if (!value) return !from && !to;
  const onlyDate = value.slice(0, 10);
  return sameDateOrAfter(onlyDate, from) && sameDateOrBefore(onlyDate, to);
}

function includesQuery(values: Array<string | null | undefined>, query?: string) {
  if (!query) return true;
  const target = normalized(query);
  return values.some((value) => normalized(value).includes(target));
}

export function paymentRecordedAt(payment: { paid_at: string | null; created_at: string }) {
  return payment.paid_at ?? payment.created_at;
}

export function formatAmountBreakdown(entries: Array<{ amount: number; currency: string }>) {
  const totals = entries.reduce<Record<string, number>>((acc, entry) => {
    if (!entry.currency) return acc;
    acc[entry.currency] = (acc[entry.currency] ?? 0) + entry.amount;
    return acc;
  }, {});
  const parts = Object.entries(totals).map(([currency, amount]) => formatAdminCurrency(amount, currency));
  return parts.length ? parts.join(" · ") : undefined;
}

export function metricCountDetail(count: number, entries: Array<{ amount: number; currency: string }>, emptyLabel: string) {
  if (!count) return emptyLabel;
  return formatAmountBreakdown(entries) ?? `${formatAdminInteger(count)} registro(s)`;
}

export function bookingAmountLabel(booking: { total_mxn: number | null; total_usd: number | null; currency: string | null }) {
  if (booking.currency === "USD" && booking.total_usd !== null) return formatAdminCurrency(booking.total_usd, "USD");
  if (booking.currency === "MXN" && booking.total_mxn !== null) return formatAdminCurrency(booking.total_mxn, "MXN");
  if (booking.total_mxn !== null) return formatAdminCurrency(booking.total_mxn, "MXN");
  if (booking.total_usd !== null) return formatAdminCurrency(booking.total_usd, "USD");
  return "Monto por definir";
}

export function bookingDateRangeLabel(booking: { starts_on: string | null; ends_on: string | null }) {
  if (!booking.starts_on && !booking.ends_on) return "Fechas por definir";
  return `${booking.starts_on ? formatAdminDate(booking.starts_on) : "Por definir"} → ${booking.ends_on ? formatAdminDate(booking.ends_on) : "Por definir"}`;
}

export function paymentRelationLabel(payment: { contact_id: string | null; lead_id: string | null; booking_id: string | null }) {
  if (payment.booking_id) return "Reserva";
  if (payment.lead_id) return "Prospecto";
  if (payment.contact_id) return "Contacto";
  return "Sin relación";
}

export function documentRelationLabel(document: { contact_id: string | null; lead_id: string | null; booking_id: string | null }) {
  if (document.booking_id) return "Reserva";
  if (document.lead_id) return "Prospecto";
  if (document.contact_id) return "Contacto";
  return "Sin relación";
}

export function filterPayments<T extends {
  contact_id: string | null;
  lead_id: string | null;
  booking_id: string | null;
  status: string;
  method_id: string | null;
  payment_type: string;
  currency: string;
  paid_at: string | null;
  created_at: string;
  contacts: ContactLike;
  leads: LeadLike;
  bookings: BookingLike;
  payment_methods: { label_es: string } | null;
}>(payments: T[], filters: PaymentFilters) {
  return payments.filter((payment) => {
    if (filters.relation === "contact" && !payment.contact_id) return false;
    if (filters.relation === "lead" && !payment.lead_id) return false;
    if (filters.relation === "booking" && !payment.booking_id) return false;
    if (filters.status && payment.status !== filters.status) return false;
    if (filters.method && payment.method_id !== filters.method) return false;
    if (filters.type && payment.payment_type !== filters.type) return false;
    if (filters.currency && payment.currency !== filters.currency) return false;
    if (filters.reconciliation === "pending" && payment.status !== "received") return false;
    if (filters.reconciliation === "done" && payment.status !== "verified") return false;
    if (!matchesDateRange(paymentRecordedAt(payment), filters.from, filters.to)) return false;

    return includesQuery([
      contactDisplayName(payment.contacts),
      payment.contacts?.email,
      payment.contacts?.phone,
      leadDisplayName(payment.leads),
      bookingDisplayName(payment.bookings),
      payment.payment_methods?.label_es,
      paymentTypeLabel(payment.payment_type),
      paymentStatusLabel(payment.status),
    ], filters.q);
  });
}

export function filterBookings<T extends {
  status: string;
  assigned_to: string | null;
  destination_id: string | null;
  starts_on: string | null;
  ends_on: string | null;
  booking_code: string | null;
  contacts: ContactLike;
  leads: LeadLike;
  destinations: { name_es: string } | null;
  profiles: { full_name: string } | null;
}>(bookings: T[], filters: BookingFilters) {
  return bookings.filter((booking) => {
    if (filters.status && booking.status !== filters.status) return false;
    if (filters.advisor === "unassigned" && booking.assigned_to) return false;
    if (filters.advisor && filters.advisor !== "unassigned" && booking.assigned_to !== filters.advisor) return false;
    if (filters.destination && booking.destination_id !== filters.destination) return false;
    if (!matchesDateRange(booking.starts_on ?? booking.ends_on, filters.from, filters.to)) return false;

    return includesQuery([
      booking.booking_code,
      contactDisplayName(booking.contacts),
      booking.contacts?.email,
      booking.contacts?.phone,
      leadDisplayName(booking.leads),
      booking.destinations?.name_es,
      booking.profiles?.full_name,
      bookingStatusLabel(booking.status),
    ], filters.q);
  });
}

export function filterDocuments<T extends {
  status: string;
  document_type: string;
  contact_id: string | null;
  lead_id: string | null;
  booking_id: string | null;
  created_at: string;
  title: string;
  contacts: ContactLike;
  leads: LeadLike;
  bookings: BookingLike;
}>(documents: T[], filters: DocumentFilters) {
  return documents.filter((document) => {
    if (filters.status && document.status !== filters.status) return false;
    if (filters.type && document.document_type !== filters.type) return false;
    if (filters.relation === "contact" && !document.contact_id) return false;
    if (filters.relation === "lead" && !document.lead_id) return false;
    if (filters.relation === "booking" && !document.booking_id) return false;
    if (!matchesDateRange(document.created_at, filters.from, filters.to)) return false;

    return includesQuery([
      document.title,
      documentTypeLabel(document.document_type),
      contactDisplayName(document.contacts),
      document.contacts?.email,
      document.contacts?.phone,
      leadDisplayName(document.leads),
      bookingDisplayName(document.bookings),
      documentStatusLabel(document.status),
    ], filters.q);
  });
}

export function currentMonthLabel(value: string | null | undefined) {
  return value ? formatAdminDateTime(value) : "Por definir";
}
