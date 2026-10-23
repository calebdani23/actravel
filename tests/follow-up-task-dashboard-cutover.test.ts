import assert from "node:assert/strict";
import { chdir, cwd } from "node:process";
import { dirname } from "node:path";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import test from "node:test";

import { assertLocalAdmission, localAdmissionPath } from "@/tests/helpers/follow-up-task-cutover-admission";

const selectedRequestId = "03c07000-0000-4000-8000-000000000001";
const dashboardModule = (async () => {
  assert.equal(process.env.FOLLOW_UP_TASK_CUTOVER_REQUEST_ID, selectedRequestId);
  assertLocalAdmission();
  return import("@/lib/admin/dashboard");
})();
const admissionEvidence = JSON.parse(readFileSync(localAdmissionPath, "utf8"));

type TaskRow = {
  id: string;
  lead_id: string;
  due_at: string;
  leads: {
    id: string;
    summary: string | null;
    deleted_at: string | null;
    archived_at: string | null;
    lead_statuses: { label_es: string } | null;
    profiles: { full_name: string | null } | null;
    contacts: { first_name: string | null; last_name: string | null } | null;
  };
};

function taskRow(index: number): TaskRow {
  return {
    id: `task-${String(index).padStart(4, "0")}`,
    lead_id: "shared-lead",
    due_at: index < 2 ? "2026-09-01T10:00:00.000Z" : "2026-10-01T10:00:00.000Z",
    leads: {
      id: "shared-lead",
      summary: "Shared opportunity",
      deleted_at: null,
      archived_at: null,
      lead_statuses: { label_es: "Nuevo" },
      profiles: { full_name: "Ada" },
      contacts: { first_name: "Ana", last_name: "Pérez" },
    },
  };
}

function fakeTaskClient(rows: TaskRow[], failAtStart?: number) {
  const calls = {
    tables: [] as string[],
    selects: [] as string[],
    filters: [] as unknown[][],
    orders: [] as unknown[][],
    ranges: [] as number[][],
  };

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
            if (start === failAtStart) return Promise.resolve({ data: null, error: { message: "task page unavailable" } });
            return Promise.resolve({ data: rows.slice(start, end + 1), error: null });
          },
        };
        return query;
      },
    } as never,
  };
}

test("local admission rejects every unavailable or mismatched evidence form", () => {
  const variants: Array<[string, string | undefined]> = [
    ["missing", undefined],
    ["false", JSON.stringify({ ...structuredClone(admissionEvidence), readinessResult: { ...admissionEvidence.readinessResult, ready: false } })],
    ["failed", JSON.stringify({ ...structuredClone(admissionEvidence), readinessResult: { ...admissionEvidence.readinessResult, ok: false } })],
    ["unavailable", JSON.stringify({ ...structuredClone(admissionEvidence), prerequisites: { ...admissionEvidence.prerequisites, activeReadIndex: false } })],
    ["malformed", "{"],
    ["mismatched", JSON.stringify({ ...structuredClone(admissionEvidence), selectedRequestId: "03c07000-0000-4000-8000-000000000002" })],
  ];

  for (const [label, contents] of variants) {
    const originalDirectory = cwd();
    const temporaryDirectory = mkdtempSync("/tmp/opencode/dashboard-admission-");
    try {
      chdir(temporaryDirectory);
      if (contents !== undefined) {
        mkdirSync(dirname(localAdmissionPath), { recursive: true });
        writeFileSync(localAdmissionPath, contents);
      }
      assert.throws(() => assertLocalAdmission(), /Local follow-up Task cutover admission is invalid/, label);
      assert.equal(existsSync(localAdmissionPath), false, `${label} evidence must be removed`);
    } finally {
      chdir(originalDirectory);
      rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  }
});

test("loads every visible active follow-up Task page without lead deduplication", async () => {
  const { dashboardInternals } = await dashboardModule;
  const { client, calls } = fakeTaskClient(Array.from({ length: 1002 }, (_, index) => taskRow(index)));
  const errors: string[] = [];
  const queue = await dashboardInternals.fetchFollowUpTaskQueue(client, errors, new Date("2026-09-15T00:00:00.000Z"));

  assert.equal(queue.length, 1002);
  assert.equal(queue.filter((item) => item.overdue).length, 2);
  assert.deepEqual(queue.slice(0, 2).map(({ id, leadId, followUpAt, overdue }) => ({ id, leadId, followUpAt, overdue })), [
    { id: "task-0000", leadId: "shared-lead", followUpAt: "2026-09-01T10:00:00.000Z", overdue: true },
    { id: "task-0001", leadId: "shared-lead", followUpAt: "2026-09-01T10:00:00.000Z", overdue: true },
  ]);
  assert.deepEqual(queue[0], {
    id: "task-0000", leadId: "shared-lead", contactName: "Ana Pérez", summary: "Shared opportunity",
    statusLabel: "Nuevo", advisorName: "Ada", followUpAt: "2026-09-01T10:00:00.000Z", overdue: true,
  });
  assert.deepEqual(calls.tables, ["tasks", "tasks"]);
  assert.deepEqual(calls.ranges, [[0, 999], [1000, 1999]]);
  assert.deepEqual(calls.filters, [
    ["eq", "task_kind", "follow_up"], ["in", "status", ["pending", "in_progress"]], ["not", "lead_id", "is", null],
    ["is", "leads.deleted_at", null], ["is", "leads.archived_at", null],
    ["eq", "task_kind", "follow_up"], ["in", "status", ["pending", "in_progress"]], ["not", "lead_id", "is", null],
    ["is", "leads.deleted_at", null], ["is", "leads.archived_at", null],
  ]);
  assert.deepEqual(calls.orders, [
    ["due_at", { ascending: true }], ["id", { ascending: true }],
    ["due_at", { ascending: true }], ["id", { ascending: true }],
  ]);
  assert.match(calls.selects[0], /leads!inner/);
  assert.deepEqual(errors, []);
});

test("fails a paged Task read through the existing error channel without event fallback", async () => {
  const { dashboardInternals } = await dashboardModule;
  const { client, calls } = fakeTaskClient(Array.from({ length: 1000 }, (_, index) => taskRow(index)), 1000);
  const errors: string[] = [];
  const queue = await dashboardInternals.fetchFollowUpTaskQueue(client, errors, new Date("2026-09-15T00:00:00.000Z"));

  assert.deepEqual(queue, []);
  assert.deepEqual(errors, ["seguimientos dashboard: task page unavailable"]);
  assert.deepEqual(calls.tables, ["tasks", "tasks"]);
  assert.equal(calls.tables.includes("lead_events"), false);
});

test("Dashboard metrics preserve the legacy queue by default and can disable only that queue", () => {
  const dashboard = readFileSync("lib/admin/dashboard.ts", "utf8");
  const composition = readFileSync("lib/admin/page-compositions.ts", "utf8");
  assert.match(dashboard, /getDashboardMetrics\(options: \{ includeLegacyFollowUps\?: boolean \} = \{\}\)/);
  assert.match(dashboard, /options\.includeLegacyFollowUps !== false\s*\? fetchFollowUpTaskQueue/);
  assert.match(dashboard, /: Promise\.resolve\(\[\]\)/);
  assert.match(composition, /getMetrics\(\{ includeLegacyFollowUps: false \}\)/);
  assert.match(composition, /getMetrics\(\)/);
  assert.doesNotMatch(`${dashboard}\n${composition}`, /from\(["']lead_events["']\)/);
});
