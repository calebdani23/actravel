import "server-only";

import { createClient } from "@/lib/supabase/server";

type DashboardCounts = {
  newLeads: number;
  followUpLeads: number;
  activeQuotes: number;
  pendingPayments: number;
  upcomingBookings: number;
  activePromotions: number;
  whatsappClicks: number;
};

async function safeCount(label: string, query: PromiseLike<{ count: number | null; error: { message: string } | null }>, errors: string[]) {
  const { count, error } = await query;
  if (error) {
    errors.push(`${label}: ${error.message}`);
    return 0;
  }
  return count ?? 0;
}

export async function getDashboardMetrics() {
  const supabase = await createClient();
  const errors: string[] = [];
  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [newLeads, followUpLeads, activeQuotes, pendingPayments, upcomingBookings, activePromotions, whatsappClicks] = await Promise.all([
    safeCount("leads nuevos", supabase.from("leads").select("id, lead_statuses!inner(name)", { count: "exact", head: true }).eq("lead_statuses.name", "new"), errors),
    safeCount("leads pendientes", supabase.from("leads").select("id, lead_statuses!inner(name)", { count: "exact", head: true }).in("lead_statuses.name", ["new", "contacted", "quoted"]), errors),
    safeCount("cotizaciones", supabase.from("quote_requests").select("id", { count: "exact", head: true }).in("status", ["received", "processing"]), errors),
    safeCount("pagos", supabase.from("payments").select("id", { count: "exact", head: true }).in("status", ["pending", "received"]), errors),
    safeCount("reservas", supabase.from("bookings").select("id", { count: "exact", head: true }).gte("starts_on", today).in("status", ["pending", "confirmed"]), errors),
    safeCount("promociones", supabase.from("promotions").select("id", { count: "exact", head: true }).eq("status", "published"), errors),
    safeCount("whatsapp", supabase.from("whatsapp_clicks").select("id", { count: "exact", head: true }).gte("created_at", thirtyDaysAgo), errors),
  ]);

  const { data: leadSources, error: channelError } = await supabase.from("leads").select("source").limit(500);
  if (channelError) errors.push(`canales: ${channelError.message}`);

  const leadsByChannel = Object.entries(
    (leadSources ?? []).reduce<Record<string, number>>((acc, lead) => {
      const source = lead.source || "sin_canal";
      acc[source] = (acc[source] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);

  return {
    counts: { newLeads, followUpLeads, activeQuotes, pendingPayments, upcomingBookings, activePromotions, whatsappClicks } satisfies DashboardCounts,
    leadsByChannel,
    errors,
  };
}
