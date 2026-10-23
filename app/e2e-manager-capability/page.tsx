import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { AdminShell } from "@/components/admin/admin-shell";
import { StaffCreateForm } from "@/components/admin/staff/staff-create-form";
import { StaffEditForm } from "@/components/admin/staff/staff-action-forms";
import { MiDiaTaskActions } from "@/components/admin/tasks/mi-dia-task-actions";
import { composeAccountPage, composeDashboardPage, composeStaffPage } from "@/lib/admin/page-compositions";
import type { AdminSession } from "@/lib/admin/auth";
import type { StaffAccount } from "@/lib/admin/staff";
import { fixtureMiDiaAction } from "./actions";
import { DashboardRouteErrorFixture } from "./route-error-fixture";

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

const taskId = "11111111-1111-4111-8111-111111111111";
const requestIds = {
  start: "21111111-1111-4111-8111-111111111111", complete: "31111111-1111-4111-8111-111111111111",
  cancel: { no_longer_needed: "41111111-1111-4111-8111-111111111111", duplicate: "51111111-1111-4111-8111-111111111111", source_invalidated: "61111111-1111-4111-8111-111111111111", other: "71111111-1111-4111-8111-111111111111" },
};

function MiDiaAccessibilityFixture({ pageTwo }: { pageTwo: boolean }) {
  if (pageTwo) return <section aria-labelledby="fixture-mi-dia"><h1 id="fixture-mi-dia">Mi día</h1><p>Página siguiente activada</p></section>;
  const next = "/e2e-manager-capability?scenario=mi-dia-accessibility&referenceTime=2026-09-28T12%3A00%3A00.000000Z&afterDueAt=2026-09-28T12%3A00%3A00.000000Z&afterId=11111111-1111-4111-8111-111111111111";
  return <section aria-labelledby="fixture-mi-dia"><h1 id="fixture-mi-dia">Mi día</h1><p>Mis tareas</p>
    <section aria-labelledby="fixture-hoy"><h2 id="fixture-hoy">Hoy (1)</h2><ul><li><strong>Seguimiento</strong> <span>Pendiente</span><time dateTime="2026-09-28T12:00:00.000000Z">28 sept 2026, 06:00 hora de Ciudad de México</time>
      <MiDiaTaskActions action={fixtureMiDiaAction} item={{ taskId, kind: "follow_up", status: "pending" }} requestIds={requestIds} />
    </li></ul></section><nav aria-label="Paginación de Mi día"><a href={next}>Siguiente</a></nav></section>;
}

export default async function ManagerCapabilityFixture({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  if (process.env.E2E_DISABLE_EXTERNAL_BOUNDARIES !== "1") notFound();
  const params = await searchParams;
  const scenario = typeof params.scenario === "string" ? params.scenario : "manager-navigation";
  const unsupportedRole = scenario.startsWith("unsupported-") ? scenario.slice("unsupported-".length) as "operaciones" | "finanzas" | "marketing" : null;
  const roles = unsupportedRole ? ([unsupportedRole] as const) : scenario.startsWith("admin-") ? (["admin"] as const) : scenario === "combined-denial" ? (["manager", "asesor"] as const) : (["manager"] as const);
  const sessionLoader = async () => fixtureSession(roles);

  if (scenario === "manager-navigation") {
    return <FixtureShell session={fixtureSession(["manager"])}><h1>Manager navigation</h1><p>Manager navigation fixture</p></FixtureShell>;
  }
  if (scenario === "mi-dia-accessibility") {
    return <MiDiaAccessibilityFixture pageTwo={typeof params.afterId === "string"} />;
  }
  if (scenario === "dashboard-route-error") {
    return <DashboardRouteErrorFixture />;
  }
  if (unsupportedRole) {
    return <FixtureShell session={fixtureSession([unsupportedRole])}><h1>Legacy Dashboard preserved</h1><p>Existing Dashboard content</p></FixtureShell>;
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
