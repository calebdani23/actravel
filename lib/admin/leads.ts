import "server-only";

import { createClient } from "@/lib/supabase/server";

export type LeadFilters = {
  status?: string;
  destination?: string;
  channel?: string;
  advisor?: string;
  currency?: string;
  from?: string;
  to?: string;
};

export type LeadListRow = {
  id: string;
  created_at: string;
  updated_at: string;
  travel_start_date: string | null;
  travel_end_date: string | null;
  travelers_count: number;
  budget_mxn: number | null;
  budget_usd: number | null;
  source: string;
  priority: string;
  summary: string | null;
  contacts: { first_name: string; last_name: string | null; email: string | null; phone: string | null } | null;
  lead_statuses: { id: string; name: string; label_es: string } | null;
  destinations: { id: string; name_es: string } | null;
  profiles: { id: string; full_name: string } | null;
};

export type LeadDetail = LeadListRow & {
  contacts: (LeadListRow["contacts"] & { preferred_locale: string; source: string | null; notes: string | null }) | null;
  services: { id: string; name_es: string } | null;
};

export async function getLeadStatuses() {
  const supabase = await createClient();
  const { data } = await supabase.from("lead_statuses").select("id, name, label_es").order("sort_order");
  return data ?? [];
}

export async function getAdvisors() {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id, full_name").eq("is_active", true).order("full_name");
  return data ?? [];
}

export async function getDestinations() {
  const supabase = await createClient();
  const { data } = await supabase.from("destinations").select("id, name_es").order("name_es");
  return data ?? [];
}

export async function getLeads(filters: LeadFilters) {
  const supabase = await createClient();
  let query = supabase
    .from("leads")
    .select("id, created_at, updated_at, travel_start_date, travel_end_date, travelers_count, budget_mxn, budget_usd, source, priority, summary, contacts(first_name, last_name, email, phone), lead_statuses!inner(id, name, label_es), destinations(id, name_es), profiles!leads_assigned_to_fkey(id, full_name)")
    .order("updated_at", { ascending: false })
    .limit(100);

  if (filters.status) query = query.eq("lead_statuses.name", filters.status);
  if (filters.destination) query = query.eq("destination_id", filters.destination);
  if (filters.channel) query = query.eq("source", filters.channel);
  if (filters.advisor === "unassigned") query = query.is("assigned_to", null);
  else if (filters.advisor) query = query.eq("assigned_to", filters.advisor);
  if (filters.currency === "MXN") query = query.not("budget_mxn", "is", null);
  if (filters.currency === "USD") query = query.not("budget_usd", "is", null);
  if (filters.from) query = query.gte("created_at", filters.from);
  if (filters.to) query = query.lte("created_at", `${filters.to}T23:59:59`);

  const { data, error } = await query;
  return { leads: (data ?? []) as unknown as LeadListRow[], error: error?.message ?? null };
}

export async function getLeadDetail(id: string) {
  const supabase = await createClient();
  const { data: lead, error } = await supabase
    .from("leads")
    .select("id, created_at, updated_at, travel_start_date, travel_end_date, travelers_count, budget_mxn, budget_usd, source, priority, summary, contacts(first_name, last_name, email, phone, preferred_locale, source, notes), lead_statuses(id, name, label_es), destinations(id, name_es), services(id, name_es), profiles!leads_assigned_to_fkey(id, full_name)")
    .eq("id", id)
    .maybeSingle();

  const [{ data: notes }, { data: events }, { data: payments }, { data: bookings }, { data: documents }] = await Promise.all([
    supabase.from("lead_notes").select("id, created_at, body, is_internal, profiles!lead_notes_author_id_fkey(full_name)").eq("lead_id", id).order("created_at", { ascending: false }).limit(20),
    supabase.from("lead_events").select("id, created_at, event_type, payload").eq("lead_id", id).order("created_at", { ascending: false }).limit(20),
    supabase.from("payments").select("id, created_at, amount, currency, status, payment_type").eq("lead_id", id).order("created_at", { ascending: false }).limit(10),
    supabase.from("bookings").select("id, created_at, booking_code, status, starts_on, ends_on, currency, total_mxn, total_usd").eq("lead_id", id).order("created_at", { ascending: false }).limit(10),
    supabase.from("documents").select("id, created_at, title, document_type, status").eq("lead_id", id).order("created_at", { ascending: false }).limit(10),
  ]);

  return { lead: (lead ?? null) as unknown as LeadDetail | null, notes: notes ?? [], events: events ?? [], payments: payments ?? [], bookings: bookings ?? [], documents: documents ?? [], error: error?.message ?? null };
}
