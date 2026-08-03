import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getAdvisorCapableStaff } from "@/lib/admin/staff";
import type { Tables } from "@/lib/supabase/database.types";

type ContactSummary = { id: string; first_name: string; last_name: string | null; email: string | null; phone: string | null } | null;
type LeadSummary = { id: string; summary: string | null; contacts: ContactSummary } | null;
type BookingSummary = { id: string; booking_code: string | null; status: string } | null;

export type PaymentRow = Tables<"payments"> & {
  payment_methods: { id: string; label_es: string } | null;
  contacts: ContactSummary;
  leads: LeadSummary;
  bookings: BookingSummary;
  accepted_quote_version: { id: string; quote_id: string } | null;
  proof_preview_url?: string | null;
  proof_download_url?: string | null;
};

export type BookingRow = Tables<"bookings"> & {
  contacts: ContactSummary;
  leads: LeadSummary;
  destinations: { id: string; name_es: string } | null;
  services: { id: string; name_es: string } | null;
  profiles: { id: string; full_name: string } | null;
  accepted_quote_version: { id: string; quote_id: string } | null;
};

export type DocumentRow = Tables<"documents"> & {
  contacts: ContactSummary;
  leads: LeadSummary;
  bookings: BookingSummary;
  quote_version: { id: string; quote_id: string } | null;
  document_preview_url?: string | null;
  document_download_url?: string | null;
};

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export async function signedStorageUrl(supabase: SupabaseServerClient, bucket: string, path: string, disposition: "preview" | "download") {
  const options = disposition === "download" ? { download: true } : undefined;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 10, options);
  if (error) return null;
  return data?.signedUrl ?? null;
}

export async function getOperationOptions() {
  const supabase = await createClient();
  const [contacts, leads, bookings, destinations, services, advisors, paymentMethods] = await Promise.all([
    supabase.from("contacts").select("id, first_name, last_name, email, phone").order("updated_at", { ascending: false }).limit(100),
    supabase.from("leads").select("id, summary, contacts(id, first_name, last_name, email, phone)").order("updated_at", { ascending: false }).limit(100),
    supabase.from("bookings").select("id, booking_code, status, contact_id").order("updated_at", { ascending: false }).limit(100),
    supabase.from("destinations").select("id, name_es").order("name_es").limit(200),
    supabase.from("services").select("id, name_es").order("sort_order").limit(200),
    getAdvisorCapableStaff(),
    supabase.from("payment_methods").select("id, label_es").eq("is_active", true).order("sort_order").limit(100),
  ]);

  return {
    contacts: contacts.data ?? [],
    leads: (leads.data ?? []) as unknown as NonNullable<LeadSummary>[],
    bookings: bookings.data ?? [],
    destinations: destinations.data ?? [],
    services: services.data ?? [],
    advisors: advisors,
    paymentMethods: paymentMethods.data ?? [],
  };
}

export async function getPayments() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payments")
    .select("*, payment_methods(id, label_es), contacts(id, first_name, last_name, email, phone), leads(id, summary, contacts(id, first_name, last_name, email, phone)), bookings(id, booking_code, status), accepted_quote_version:quote_versions!payments_accepted_quote_version_id_fkey(id, quote_id)")
    .order("updated_at", { ascending: false })
    .limit(100);
  const rows: PaymentRow[] = ((data ?? []) as unknown as PaymentRow[]).map((row) => ({ ...row, proof_preview_url: null, proof_download_url: null }));
  await Promise.all(rows.map(async (row) => {
    if (!row.proof_bucket || !row.proof_path) return;
    const [previewUrl, downloadUrl] = await Promise.all([
      signedStorageUrl(supabase, row.proof_bucket, row.proof_path, "preview"),
      signedStorageUrl(supabase, row.proof_bucket, row.proof_path, "download"),
    ]);
    row.proof_preview_url = previewUrl;
    row.proof_download_url = downloadUrl;
  }));
  return { payments: rows, error: error?.message ?? null };
}

export async function getBookings() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select("*, contacts(id, first_name, last_name, email, phone), leads(id, summary, contacts(id, first_name, last_name, email, phone)), destinations(id, name_es), services(id, name_es), profiles!bookings_assigned_to_fkey(id, full_name), accepted_quote_version:quote_versions!bookings_accepted_quote_version_id_fkey(id, quote_id)")
    .order("updated_at", { ascending: false })
    .limit(100);
  return { bookings: (data ?? []) as unknown as BookingRow[], error: error?.message ?? null };
}

export async function getDocuments() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .select("*, contacts(id, first_name, last_name, email, phone), leads(id, summary, contacts(id, first_name, last_name, email, phone)), bookings(id, booking_code, status), quote_version:quote_versions!documents_quote_version_id_fkey(id, quote_id)")
    .order("updated_at", { ascending: false })
    .limit(100);
  const rows: DocumentRow[] = ((data ?? []) as unknown as DocumentRow[]).map((row) => ({ ...row, document_preview_url: null, document_download_url: null }));
  await Promise.all(rows.map(async (row) => {
    if (!row.bucket || !row.path) return;
    const [previewUrl, downloadUrl] = await Promise.all([
      signedStorageUrl(supabase, row.bucket, row.path, "preview"),
      signedStorageUrl(supabase, row.bucket, row.path, "download"),
    ]);
    row.document_preview_url = previewUrl;
    row.document_download_url = downloadUrl;
  }));
  return { documents: rows, error: error?.message ?? null };
}
