import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { AdminShell } from "@/components/admin/admin-shell";
import { StaffCreateForm } from "@/components/admin/staff/staff-create-form";
import { StaffEditForm } from "@/components/admin/staff/staff-action-forms";
import { composeAccountPage, composeDashboardPage, composeStaffPage } from "@/lib/admin/page-compositions";
import type { AdminSession } from "@/lib/admin/auth";
import type { StaffAccount } from "@/lib/admin/staff";

const fixtureSession = (roles: readonly AdminSession["roles"][number][]): AdminSession => ({
  user: { id: "e2e-fixture-user", email: "fixture@example.com" },
  profile: { id: "e2e-fixture-profile", full_name: "E2E Fixture", is_active: true },
  roles: [...roles],
});

const actions = {
  redirect: (path: string) => redirect(path),
  notFound: () => { throw new FixtureAuthorizationDeniedError(); },
};

class FixtureAuthorizationDeniedError extends Error {
  constructor() {
    super("fixture authorization denied");
    this.name = "FixtureAuthorizationDeniedError";
  }
}

const staffFixture: StaffAccount = {
  id: "manager-fixture",
  email: "manager@example.com",
  full_name: "Grace Manager",
  is_active: true,
  role: "manager",
  roles: ["manager"],
  has_unsupported_role: false,
  is_manageable_in_mvp: true,
  management_block_reason: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

function FixtureShell({ session, children }: { session: AdminSession; children: React.ReactNode }) {
  return <AdminShell email={session.user.email ?? ""} profile={session.profile} roles={session.roles}>{children}</AdminShell>;
}

export default async function ManagerCapabilityFixture({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  if (process.env.E2E_DISABLE_EXTERNAL_BOUNDARIES !== "1") notFound();
  const params = await searchParams;
  const scenario = typeof params.scenario === "string" ? params.scenario : "manager-navigation";
  const roles = scenario.startsWith("admin-") ? (["admin"] as const) : scenario === "combined-denial" ? (["manager", "asesor"] as const) : (["manager"] as const);
  const sessionLoader = async () => fixtureSession(roles);

  if (scenario === "manager-navigation") {
    return <FixtureShell session={fixtureSession(["manager"])}><h1>Manager navigation</h1><p>Manager navigation fixture</p></FixtureShell>;
  }
  if (scenario === "dashboard-healthy" || scenario === "dashboard-unhealthy") {
    const dashboard = await composeDashboardPage({
      sessionLoader,
      authActions: actions,
      getMetrics: async () => ({ errors: scenario === "dashboard-unhealthy" ? ["fixture read failure"] : [] } as never),
      getDataQuality: async () => ({ totalContacts: 0 } as never),
    });
    if (dashboard.status === "redirect") redirect("/e2e-manager-capability?scenario=account");
    return <FixtureShell session={fixtureSession(["manager"])}><h1>{dashboard.status === "render" ? "Dashboard healthy" : "Fallback account"}</h1><p data-testid="dashboard-status">{dashboard.status}</p></FixtureShell>;
  }
  if (scenario === "account") {
    const dashboardReadAttempts: string[] = [];
    const account = await composeAccountPage({ sessionLoader, authActions: actions, onDashboardReadAttempt: (family) => { dashboardReadAttempts.push(family); } });
    return <FixtureShell session={account.session}><h1>Account fallback</h1><p data-testid="dashboard-read-count">Dashboard reads: {dashboardReadAttempts.length}</p></FixtureShell>;
  }
  if (scenario === "direct-denial" || scenario === "combined-denial") {
    const targetReads: string[] = [];
    let denied = false;
    try {
      await composeStaffPage({ sessionLoader, authActions: actions, getStaff: async () => { targetReads.push("staff"); return []; }, getEvents: async () => { targetReads.push("audit"); return []; } });
    } catch (error) {
      if (!(error instanceof FixtureAuthorizationDeniedError)) throw error;
      denied = true;
    }
    return <FixtureShell session={fixtureSession(roles)}><h1>{denied ? "Assignment denied" : "Unexpected access"}</h1><p data-testid="target-read-count">Target reads: {targetReads.length}</p></FixtureShell>;
  }
  if (scenario === "admin-staff") {
    return <FixtureShell session={fixtureSession(["admin"])}><h1>Manager assignment</h1><StaffCreateForm /><StaffEditForm staff={staffFixture} /><p data-testid="manager-display">Gerencia</p></FixtureShell>;
  }
  notFound();
}
