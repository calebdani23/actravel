import { hasRole } from "@/lib/supabase/roles";
import { requireAdminRoute, type AdminAuthActions, type AdminSessionLoader } from "@/lib/admin/auth";
import type { getDuplicateAuditSnapshot } from "@/lib/admin/data-quality";
import type { getDashboardMetrics } from "@/lib/admin/dashboard";
import type { getAdvisorCapableStaff, getStaffAccounts, getStaffAuditEvents } from "@/lib/admin/staff";
import type { getQuotePortfolio, QuotePortfolioFilters, QuotePortfolioItemDto } from "@/lib/admin/quotes";

function isManagerOnlySession(roles: readonly string[]) {
  return hasRole(roles, "manager") && !hasRole(roles, "admin") && roles.every((role) => role === "manager");
}

export type DashboardCompositionDeps = {
  sessionLoader?: AdminSessionLoader;
  authActions?: AdminAuthActions;
  getMetrics: typeof getDashboardMetrics;
  getDataQuality: typeof getDuplicateAuditSnapshot;
};

export async function composeDashboardPage(deps: DashboardCompositionDeps) {
  const session = await requireAdminRoute("/admin/dashboard", undefined, deps.sessionLoader, deps.authActions);
  try {
    const [metrics, dataQuality] = await Promise.all([deps.getMetrics(), deps.getDataQuality()]);
    if (isManagerOnlySession(session.roles) && metrics.errors.length > 0) return { status: "redirect" as const };
    return { status: "render" as const, session, metrics, dataQuality };
  } catch (error) {
    if (isManagerOnlySession(session.roles)) return { status: "redirect" as const, error };
    throw error;
  }
}

export type AccountReadFamily = "metrics" | "dataQuality";
export type AccountCompositionDeps = {
  sessionLoader?: AdminSessionLoader;
  authActions?: AdminAuthActions;
  onDashboardReadAttempt?: (family: AccountReadFamily) => void;
};

export async function composeAccountPage(deps: AccountCompositionDeps) {
  // Keep this boundary instrumentable without giving the account page dashboard read dependencies.
  void deps.onDashboardReadAttempt;
  return { session: await requireAdminRoute("/admin/account", undefined, deps.sessionLoader, deps.authActions) };
}

type SearchParams = Record<string, string | string[] | undefined>;
export type QuotesCompositionDeps = {
  sessionLoader?: AdminSessionLoader;
  authActions?: AdminAuthActions;
  getAdvisors: typeof getAdvisorCapableStaff;
  getPortfolio: (filters: QuotePortfolioFilters) => Promise<Awaited<ReturnType<typeof getQuotePortfolio>>>;
};

export async function composeQuotesPage(
  searchParams: Promise<SearchParams>,
  buildFilters: (params: SearchParams) => QuotePortfolioFilters,
  deps: QuotesCompositionDeps,
) {
  const session = await requireAdminRoute("/admin/quotes", ["admin", "asesor", "operaciones", "finanzas"], deps.sessionLoader, deps.authActions);
  const params = await searchParams;
  const [advisors, result] = await Promise.all([deps.getAdvisors(), deps.getPortfolio(buildFilters(params))]);
  return { session, params, advisors, result };
}

export type StaffCompositionDeps = {
  sessionLoader?: AdminSessionLoader;
  authActions?: AdminAuthActions;
  getStaff: typeof getStaffAccounts;
  getEvents: typeof getStaffAuditEvents;
};

export async function composeStaffPage(deps: StaffCompositionDeps) {
  await requireAdminRoute("/admin/staff", ["admin"], deps.sessionLoader, deps.authActions);
  const [staff, events] = await Promise.all([deps.getStaff(), deps.getEvents(20)]);
  return { staff, events };
}

export type QuotePageComposition = Awaited<ReturnType<typeof composeQuotesPage>>;
export type QuoteItem = QuotePortfolioItemDto;
