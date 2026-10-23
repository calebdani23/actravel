import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { assertLocalAdmission } from "@/tests/helpers/follow-up-task-cutover-admission";

const selectedRequestId = "03c07000-0000-4000-8000-000000000001";
const applicationModules = (async () => {
  assert.equal(process.env.FOLLOW_UP_TASK_CUTOVER_REQUEST_ID, selectedRequestId);
  assertLocalAdmission();
  return Promise.all([import("@/lib/admin/tasks"), import("@/lib/admin/leads")]);
})();

type TaskFixture = {
  id: string;
  lead_id: string | null;
  due_at: string;
  task_kind: string;
  status: string;
  leads: { deleted_at: string | null; archived_at: string | null } | Array<{ deleted_at: string | null; archived_at: string | null }> | null;
};

const liveLead = { deleted_at: null, archived_at: null };

function taskFixture(id: string, leadId: string, dueAt: string, status = "pending", taskKind = "follow_up", leads: TaskFixture["leads"] = liveLead): TaskFixture {
  return { id, lead_id: leadId, due_at: dueAt, task_kind: taskKind, status, leads };
}

function fakeTaskClient(rows: TaskFixture[], failAtStart?: number) {
  const calls = { tables: [] as string[], selects: [] as string[], filters: [] as unknown[][], orders: [] as unknown[][], ranges: [] as number[][] };
  return {
    calls,
    client: {
      from(table: string) {
        calls.tables.push(table);
        const query = {
          select(columns: string) { calls.selects.push(columns); return query; },
          eq(...args: unknown[]) { calls.filters.push(["eq", ...args]); return query; },
          in(...args: unknown[]) { calls.filters.push(["in", ...args]); return query; },
          not(...args: unknown[]) { calls.filters.push(["not", ...args]); return query; },
          is(...args: unknown[]) { calls.filters.push(["is", ...args]); return query; },
          order(...args: unknown[]) { calls.orders.push(args); return query; },
          range(start: number, end: number) {
            calls.ranges.push([start, end]);
            if (start === failAtStart) return Promise.resolve({ data: null, error: { message: "Task projection unavailable" } });
            return Promise.resolve({ data: rows.slice(start, end + 1), error: null });
          },
        };
        return query;
      },
    } as never,
  };
}

test("earliest visible active Tasks drive lead and related-opportunity DTOs", async () => {
  const [{ followUpTaskReadInternals }, { leadSearchInternals }] = await applicationModules;
  const reference = new Date("2026-09-15T00:00:00.000Z");
  const projections = followUpTaskReadInternals.buildActiveFollowUpTaskIndex([
    taskFixture("task-terminal", "lead-a", "2026-09-01T00:00:00.000Z", "completed"),
    taskFixture("task-b", "lead-a", "2026-09-20T00:00:00.000Z", "in_progress"),
    taskFixture("task-a", "lead-a", "2026-09-20T00:00:00.000Z"),
    taskFixture("task-overdue", "lead-b", "2026-09-10T00:00:00.000Z"),
    taskFixture("task-manual", "lead-c", "2026-09-01T00:00:00.000Z", "pending", "manual"),
    taskFixture("task-archived", "lead-d", "2026-09-01T00:00:00.000Z", "pending", "follow_up", { deleted_at: null, archived_at: "2026-09-02T00:00:00.000Z" }),
  ], reference);

  assert.deepEqual(Object.fromEntries(projections), {
    "lead-a": { taskId: "task-a", nextFollowUpAt: "2026-09-20T00:00:00.000Z", followUpOverdue: false },
    "lead-b": { taskId: "task-overdue", nextFollowUpAt: "2026-09-10T00:00:00.000Z", followUpOverdue: true },
  });
  assert.equal(followUpTaskReadInternals.buildActiveFollowUpTaskIndex([
    taskFixture("task-done", "lead-a", "2026-09-20T00:00:00.000Z", "completed"),
    taskFixture("task-canceled", "lead-a", "2026-09-21T00:00:00.000Z", "canceled"),
  ], reference).has("lead-a"), false);
  assert.deepEqual(followUpTaskReadInternals.buildActiveFollowUpTaskIndex([
    taskFixture("task-equal", "lead-e", reference.toISOString(), "pending", "follow_up", [liveLead]),
  ], reference).get("lead-e"), { taskId: "task-equal", nextFollowUpAt: reference.toISOString(), followUpOverdue: false });

  const related = leadSearchInternals.buildRelatedOpportunities([{ id: "lead-a", updated_at: "2026-09-01T00:00:00.000Z", summary: null, destinations: null, profiles: null, lead_statuses: null }], projections, new Map());
  assert.deepEqual({ nextFollowUpAt: related[0].nextFollowUpAt, followUpOverdue: related[0].followUpOverdue }, { nextFollowUpAt: "2026-09-20T00:00:00.000Z", followUpOverdue: false });
  assert.deepEqual(leadSearchInternals.buildContact360Summary({ ambiguousIdentityEvents: 0, duplicateEmailMatches: 0, duplicatePhoneMatches: 0, followUps: projections, opportunities: [{ id: "lead-a" }, { id: "lead-b" }], quoteRequests: [] }), {
    opportunityCount: 2, requestCount: 0, duplicateEmailMatches: 0, duplicatePhoneMatches: 0, ambiguousIdentityEvents: 0,
    hasDuplicateRisk: false, hasIdentityReview: false, overdueFollowUps: 1, upcomingFollowUps: 1,
  });
});

test("Task reads exhaust pages and fail closed through the lead error channel", async () => {
  const [{ readActiveFollowUpTaskIndex }] = await applicationModules;
  const rows = Array.from({ length: 1001 }, (_, index) => taskFixture(`task-${String(index).padStart(4, "0")}`, index === 1000 ? "lead-b" : "lead-a", "2026-09-20T00:00:00.000Z"));
  const success = fakeTaskClient(rows);
  const errors: string[] = [];
  const projections = await readActiveFollowUpTaskIndex(success.client, ["lead-a", "lead-b"], "seguimientos de prospectos", errors, new Date("2026-09-15T00:00:00.000Z"));
  assert.deepEqual(success.calls.ranges, [[0, 999], [1000, 1999]]);
  assert.equal(projections.get("lead-b")?.taskId, "task-1000");
  assert.match(success.calls.selects[0], /leads!inner/);
  assert.deepEqual(success.calls.filters.slice(0, 6), [
    ["in", "lead_id", ["lead-a", "lead-b"]], ["eq", "task_kind", "follow_up"], ["in", "status", ["pending", "in_progress"]],
    ["not", "lead_id", "is", null], ["is", "leads.deleted_at", null], ["is", "leads.archived_at", null],
  ]);
  assert.deepEqual(success.calls.orders.slice(0, 2), [["due_at", { ascending: true }], ["id", { ascending: true }]]);
  assert.equal(success.calls.tables.includes("lead_events"), false);
  assert.deepEqual(errors, []);

  const failure = fakeTaskClient(rows.slice(0, 1000), 1000);
  const failureErrors: string[] = [];
  const failed = await readActiveFollowUpTaskIndex(failure.client, ["lead-a"], "seguimientos de prospectos", failureErrors, new Date());
  assert.deepEqual(Object.fromEntries(failed), {});
  assert.deepEqual(failureErrors, ["seguimientos de prospectos: Task projection unavailable"]);
  assert.equal(failure.calls.tables.includes("lead_events"), false);
});

test("lead and Contact readers keep limits, compatible Task aliases, and event history", async () => {
  await applicationModules;
  const leads = readFileSync("lib/admin/leads.ts", "utf8");
  const contacts = readFileSync("lib/admin/contacts.ts", "utf8");
  assert.doesNotMatch(leads, /buildLatestFollowUpIndex|crossOpportunityFollowUps/);
  assert.equal((leads.match(/readActiveFollowUpTaskIndex\(/g) ?? []).length, 2);
  assert.match(leads, /\.limit\(100\)/);
  assert.match(leads, /\.limit\(20\)/);
  assert.match(leads, /from\("lead_events"\).*event_type, payload/);
  for (const alias of ["row.overdue_count", "row.next_follow_up_at", "row.latest_follow_up_at", "row.follow_up_overdue", "row.latest_follow_up_created_at", "row.last_activity_at"]) assert.match(contacts, new RegExp(alias.replace(".", "\\.")));
  assert.match(contacts, /p_limit: options\.limit \?\? 20/);
  assert.match(contacts, /from\("lead_events"\).*\.limit\(30\)/);
});
