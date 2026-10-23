import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { composeAccountPage } from "@/lib/admin/page-compositions";
import { composeDashboardPage } from "@/lib/admin/page-compositions";
import { composeQuotesPage } from "@/lib/admin/page-compositions";
import { composeStaffPage } from "@/lib/admin/page-compositions";
import { requireAdminRole, requireAdminRoute } from "@/lib/admin/auth";
import type { getDashboardMetrics } from "@/lib/admin/dashboard";
import type { getDuplicateAuditSnapshot } from "@/lib/admin/data-quality";
import { readMiDiaActionContext, type MiDiaActorResult } from "@/lib/admin/mi-dia";

const session = (roles: string[]) => ({
  user: { id: "user-1", email: "test@example.com" },
  profile: { id: "profile-1", full_name: "Test", is_active: true },
  roles: roles as never[],
});
const filters = () => ({ status: null, ownerId: null, contactId: null, opportunityId: null, currency: null, validity: "all" as const, pdf: undefined, view: undefined, afterUpdatedAt: null, afterId: null });
const actions = { redirect: () => { throw new Error("redirected"); }, notFound: () => { throw new Error("not found"); } };

test("Manager-only quotes denial happens before advisor and portfolio reads", async () => {
  let advisorReads = 0;
  let portfolioReads = 0;
  await assert.rejects(() => composeQuotesPage(Promise.resolve({}), filters, {
    sessionLoader: async () => session(["manager"]),
    authActions: actions,
    getAdvisors: async () => { advisorReads += 1; return []; },
    getPortfolio: async () => { portfolioReads += 1; return { quotes: [], issues: [], pageHasMore: false, nextCursor: null }; },
  }));
  assert.equal(advisorReads, 0);
  assert.equal(portfolioReads, 0);
});

test("Manager+asesor retains quote/advisor access and reads execute after authorization", async () => {
  const calls: string[] = [];
  const result = await composeQuotesPage(Promise.resolve({}), filters, {
    sessionLoader: async () => { calls.push("authorize"); return session(["manager", "asesor"]); },
    authActions: actions,
    getAdvisors: async () => { calls.push("advisors"); return []; },
    getPortfolio: async () => { calls.push("portfolio"); return { quotes: [], issues: [], pageHasMore: false, nextCursor: null }; },
  });
  assert.deepEqual(calls, ["authorize", "advisors", "portfolio"]);
  assert.deepEqual(result.result.quotes, []);
});

test("Manager+asesor is denied from Admin-only staff before staff target operations", async () => {
  const calls: string[] = [];
  await assert.rejects(() => composeStaffPage({
    sessionLoader: async () => { calls.push("authorize"); return session(["manager", "asesor"]); },
    authActions: actions,
    getStaff: async () => { calls.push("staff"); return []; },
    getEvents: async () => { calls.push("audit"); return []; },
  }));
  assert.deepEqual(calls, ["authorize"]);
});

test("Account composition executes no dashboard read", async () => {
  const reads: string[] = [];
  const result = await composeAccountPage({
    sessionLoader: async () => session(["manager"]),
    authActions: actions,
    onDashboardReadAttempt: (family) => reads.push(family),
  });
  assert.deepEqual(result.session.roles, ["manager"]);
  assert.deepEqual(reads, []);
});

test("Dashboard composition invokes both read families once, reuses results, and redirects failures", async () => {
  let metricReads = 0;
  let auditReads = 0;
  const metrics = { errors: [], counts: { leadsToday: 7 } } as unknown as Awaited<ReturnType<typeof getDashboardMetrics>>;
  const dataQuality = { totalContacts: 3 } as unknown as Awaited<ReturnType<typeof getDuplicateAuditSnapshot>>;
  const healthy = await composeDashboardPage({
    sessionLoader: async () => session(["manager"]),
    authActions: actions,
    getMetrics: async () => { metricReads += 1; return metrics; },
    getDataQuality: async () => { auditReads += 1; return dataQuality; },
  });
  assert.equal(healthy.status, "render");
  if (healthy.status === "render") {
    assert.equal(healthy.metrics, metrics);
    assert.equal(healthy.dataQuality, dataQuality);
  }
  assert.equal(metricReads, 1);
  assert.equal(auditReads, 1);

  const metricFailure = await composeDashboardPage({
    sessionLoader: async () => session(["manager"]),
    authActions: actions,
    getMetrics: async () => ({ errors: ["denied"] } as never),
    getDataQuality: async () => dataQuality,
  });
  assert.equal(metricFailure.status, "redirect");
  const thrownFailure = await composeDashboardPage({
    sessionLoader: async () => session(["manager"]),
    authActions: actions,
    getMetrics: async () => { throw new Error("read failed"); },
    getDataQuality: async () => dataQuality,
  });
  assert.equal(thrownFailure.status, "redirect");
});

test("Dashboard authorization denial happens before either dashboard read family", async () => {
  let metricReads = 0;
  let dataQualityReads = 0;
  let miDiaReads = 0;
  await assert.rejects(() => composeDashboardPage({
    sessionLoader: async () => null,
    authActions: actions,
    getMetrics: async () => { metricReads += 1; return { errors: [] } as never; },
    getDataQuality: async () => { dataQualityReads += 1; return {} as never; },
    readMiDia: async () => { miDiaReads += 1; return { ok: false } as never; },
  }));
  assert.equal(metricReads, 0);
  assert.equal(dataQualityReads, 0);
  assert.equal(miDiaReads, 0);
});

test("production authorization seams use the injected session loader", async () => {
  let loaded = 0;
  const loadSession = async () => {
    loaded += 1;
    return session(["manager"]);
  };

  await assert.rejects(() => requireAdminRole(["admin"], loadSession, actions));
  await assert.rejects(() => requireAdminRoute("/admin/quotes", undefined, loadSession, actions));
  assert.equal(loaded, 2);
});

test("Dashboard route error boundary is focused, safe, and resettable", () => {
  const source = readFileSync("app/admin/(protected)/dashboard/error.tsx", "utf8");
  assert.match(source, /^"use client";/);
  assert.match(source, /role="alert"[^>]*tabIndex=\{-1\}/);
  assert.match(source, /\.current\?\.focus\(\)/);
  assert.match(source, /onClick=\{reset\}/);
  assert.match(source, /No pudimos mostrar el Dashboard\./);
  assert.doesNotMatch(source, /error\.(?:message|stack|digest)/);
});

test("Mi día context links require exact current route authority", async () => {
  const actor = (roles: ("manager" | "asesor")[], actorId: string): Extract<MiDiaActorResult, { ok: true }> => ({ ok: true, actorId, profile: { id: actorId, isActive: true }, rawRoleNames: roles, roles, scope: roles.includes("manager") ? "team" : "self" });
  const owner = "11111111-1111-4111-8111-111111111111", other = "22222222-2222-4222-8222-222222222222", taskId = "33333333-3333-4333-8333-333333333333", contextId = "44444444-4444-4444-8444-444444444444";
  const readTask = async () => ({ data: { id: taskId, owner_id: owner, task_kind: "follow_up", status: "pending", lead_id: contextId, quote_id: null }, error: null });
  let helperCalls = 0;
  const manager = await readMiDiaActionContext(actor(["manager"], other), taskId, { createClient: async () => ({}), readTask, canReadLead: async () => { helperCalls += 1; return { data: true, error: null }; } });
  assert.equal(manager.ok && manager.navigationHref, null);
  assert.equal(helperCalls, 0);
  const allowed = await readMiDiaActionContext(actor(["asesor"], owner), taskId, { createClient: async () => ({}), readTask, canReadLead: async (_client, leadId) => ({ data: leadId === contextId, error: null }) });
  assert.equal(allowed.ok && allowed.navigationHref, `/admin/leads/${contextId}`);
  const stale = await readMiDiaActionContext(actor(["asesor"], owner), taskId, { createClient: async () => ({}), readTask, canReadLead: async () => ({ data: false, error: null }) });
  assert.equal(stale.ok && stale.navigationHref, null);
});
