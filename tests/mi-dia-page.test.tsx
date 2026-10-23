import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { MiDiaTaskActions, miDiaRequestId, type MiDiaTaskRequestIds } from "@/components/admin/tasks/mi-dia-task-actions";
import { MiDiaLoading, MiDiaTaskList } from "@/components/admin/tasks/mi-dia-task-list";
import { composeDashboardPage } from "@/lib/admin/page-compositions";
import type { MiDiaResult } from "@/lib/admin/mi-dia";

const session = (roles: string[]) => ({ user: { id: "10000000-0000-4000-8000-000000000001" }, profile: { id: "10000000-0000-4000-8000-000000000001", full_name: "Test", is_active: true }, roles: roles as never[] });
const actions = { redirect: () => { throw new Error("redirected"); }, notFound: () => { throw new Error("not found"); } };
const failure: MiDiaResult = { ok: false, error: { code: "PERSISTENCE_FAILURE", message: "PERSISTENCE_FAILURE" } };

test("Dashboard composition selects Mi día only for supported role unions", async () => {
  for (const [roles, scope] of [["admin", "all"], ["manager", "team"], ["asesor", "self"], ["asesor,operaciones", "self"]]) {
    const calls: string[] = [];
    const result = await composeDashboardPage({
      sessionLoader: async () => { calls.push("auth"); return session(roles.split(",")); }, authActions: actions,
      getMetrics: async (options) => { calls.push(`metrics:${options?.includeLegacyFollowUps}`); return { errors: [] } as never; },
      getDataQuality: async () => { calls.push("quality"); return {} as never; },
      readMiDia: async () => { calls.push("mi-dia"); return failure; }, miDiaRequest: { cursor: null },
    });
    assert.equal(result.status, "render");
    assert.equal(result.mode, "mi-dia");
    assert.equal(result.scope, scope);
    assert.deepEqual(calls, ["auth", "metrics:false", "quality", "mi-dia"]);
  }
  for (const role of ["operaciones", "finanzas", "marketing"]) {
    let miDiaReads = 0;
    const result = await composeDashboardPage({ sessionLoader: async () => session([role]), authActions: actions, getMetrics: async (options) => ({ errors: [], options } as never), getDataQuality: async () => ({} as never), readMiDia: async () => { miDiaReads += 1; return failure; } });
    assert.equal(result.mode, "legacy");
    assert.equal(miDiaReads, 0);
    assert.equal("options" in result.metrics ? result.metrics.options : undefined, undefined);
  }
});

test("Mi día failure stays local and does not trigger the Manager fallback", async () => {
  const result = await composeDashboardPage({ sessionLoader: async () => session(["manager"]), authActions: actions, getMetrics: async () => ({ errors: [], counts: { leadsToday: 7 } } as never), getDataQuality: async () => ({ totalContacts: 3 } as never), readMiDia: async () => failure, miDiaRequest: { cursor: null } });
  assert.equal(result.status, "render");
  assert.equal(result.mode, "mi-dia");
  assert.deepEqual(await result.miDia, failure);
});

test("Mi día renders isolated loading, empty, error, and exact paginated states", () => {
  const loading = renderToStaticMarkup(<MiDiaLoading />);
  assert.match(loading, /aria-busy="true"[^]*Cargando Mi día/);
  assert.doesNotMatch(loading, /<form|Vencidas<\/dt>/);
  for (const [scope, copy] of [["self", "No tienes tareas activas."], ["team", "No hay tareas activas para mostrar."], ["all", "No hay tareas activas para mostrar."]] as const) {
    const html = renderToStaticMarkup(<MiDiaTaskList result={{ ok: true, referenceTime: "2026-09-28T12:00:00.000000Z", todayStart: "2026-09-28T06:00:00.000000Z", tomorrowStart: "2026-09-29T06:00:00.000000Z", scope, counts: { overdue: 0, today: 0, upcoming: 0, total: 0 }, items: [], pageInfo: { hasMore: false, nextCursor: null } }} />);
    assert.match(html, new RegExp(copy.replace(".", "\\.")));
    assert.doesNotMatch(html, /Siguiente|<form/);
  }
  const error = renderToStaticMarkup(<MiDiaTaskList result={failure} />);
  assert.match(error, /role="alert"[^]*No pudimos cargar Mi día\. Intenta de nuevo\.[^]*href="\/admin\/dashboard"[^]*Reintentar/);
  assert.doesNotMatch(error, /PERSISTENCE_FAILURE/);
  const items = [
    { taskId: "20000000-0000-4000-8000-000000000001", ownerId: "10000000-0000-4000-8000-000000000001", ownerLabel: "Ana", kind: "follow_up", status: "pending", description: "Primera", dueAt: "2026-09-28T11:00:00.000000Z", bucket: "overdue", leadId: null, quoteId: null, navigationHref: null },
    { taskId: "20000000-0000-4000-8000-000000000002", ownerId: "10000000-0000-4000-8000-000000000001", ownerLabel: "Ana", kind: "first_contact", status: "in_progress", description: "Segunda", dueAt: "2026-09-28T13:00:00.000000Z", bucket: "today", leadId: null, quoteId: null, navigationHref: null },
    { taskId: "20000000-0000-4000-8000-000000000003", ownerId: "10000000-0000-4000-8000-000000000001", ownerLabel: "Ana", kind: "quote_follow_up", status: "pending", description: "Tercera", dueAt: "2026-09-30T13:00:00.000000Z", bucket: "upcoming", leadId: null, quoteId: null, navigationHref: null },
  ] as const;
  const page = renderToStaticMarkup(<MiDiaTaskList result={{ ok: true, referenceTime: "2026-09-28T12:00:00.000000Z", todayStart: "2026-09-28T06:00:00.000000Z", tomorrowStart: "2026-09-29T06:00:00.000000Z", scope: "team", counts: { overdue: 8, today: 7, upcoming: 6, total: 21 }, items: [...items], pageInfo: { hasMore: true, nextCursor: { referenceTime: "2026-09-28T12:00:00.000000Z", afterDueAt: items[2].dueAt, afterId: items[2].taskId } } }} />);
  for (const text of ["Mi día", "Tareas del equipo", "Vencidas", "Hoy", "Próximas", "Total", "Seguimiento", "Primer contacto", "Seguimiento de cotización", "Pendiente", "En curso", "hora de Ciudad de México", "Siguiente"]) assert.match(page, new RegExp(text));
  assert.ok(page.indexOf("Primera") < page.indexOf("Segunda") && page.indexOf("Segunda") < page.indexOf("Tercera"));
  assert.match(page, /dateTime="2026-09-28T11:00:00.000000Z"/);
  assert.match(page, /referenceTime=2026-09-28T12%3A00%3A00\.000000Z&amp;afterDueAt=2026-09-30T13%3A00%3A00\.000000Z&amp;afterId=20000000-0000-4000-8000-000000000003/);
  assert.match(page, /<form[^]*Iniciar[^]*Completar[^]*Cancelar/);
});

test("Mi día action forms preserve retry identity and expose exact interaction states", () => {
  const requestIds: MiDiaTaskRequestIds = { start: "30000000-0000-4000-8000-000000000001", complete: "30000000-0000-4000-8000-000000000002", cancel: { no_longer_needed: "30000000-0000-4000-8000-000000000003", duplicate: "30000000-0000-4000-8000-000000000004", source_invalidated: "30000000-0000-4000-8000-000000000005", other: "30000000-0000-4000-8000-000000000006" } };
  const item = { taskId: "20000000-0000-4000-8000-000000000001", kind: "first_contact", status: "pending" } as const;
  const action = async () => ({ status: "idle", code: null, message: null, requestId: null, feedbackSequence: 0 } as const);
  const page = renderToStaticMarkup(<MiDiaTaskActions action={action} item={item} requestIds={requestIds} />);
  for (const text of ["Iniciar", "Completar", "Cancelar", "Ya no es necesaria", "Duplicada", "Origen invalidado", "Otro"]) assert.match(page, new RegExp(text));
  for (const name of ["requestId", "taskId", "taskKind", "cancelReason", "intent"]) assert.match(page, new RegExp(`name="${name}"`));
  assert.equal(miDiaRequestId(requestIds, "complete", "other"), requestIds.complete);
  assert.equal(miDiaRequestId(requestIds, "cancel", "other"), requestIds.cancel.other);
  assert.notEqual(miDiaRequestId(requestIds, "cancel", "duplicate"), requestIds.cancel.other);
  const inProgress = renderToStaticMarkup(<MiDiaTaskActions action={action} item={{ ...item, status: "in_progress" }} requestIds={requestIds} />);
  assert.doesNotMatch(inProgress, /Iniciar/); assert.match(inProgress, /Completar[^]*Cancelar/);
  const source = readFileSync("components/admin/tasks/mi-dia-task-actions.tsx", "utf8");
  for (const behavior of [/aria-busy=\{pending\}/, /disabled=\{pending\}/, /role=\{state\.status === "success" \? "status" : "alert"\}/, /aria-live=\{state\.status === "success" \? "polite" : "assertive"\}/, /feedbackRef\.current\?\.focus\(\)/]) assert.match(source, behavior);
});

test("two consecutive identical failures each move focus to the alert without replacing request identity", async () => {
  const requestId = "30000000-0000-4000-8000-000000000001";
  const first = { status: "failure", code: "PERSISTENCE_FAILURE", message: "No pudimos actualizar la tarea. Intenta de nuevo.", requestId, feedbackSequence: 1 } as const;
  const second = { ...first, feedbackSequence: 2 } as const;
  assert.equal(first.requestId, second.requestId);
  assert.equal(first.message, second.message);
  const { focusMiDiaFailureFeedback } = await import("@/components/admin/tasks/mi-dia-task-actions");
  let focusCount = 0;
  const alert = { current: { focus: () => { focusCount += 1; } } };
  focusMiDiaFailureFeedback(first.status, alert); focusMiDiaFailureFeedback(second.status, alert);
  assert.equal(focusCount, 2);
  assert.match(readFileSync("components/admin/tasks/mi-dia-task-actions.tsx", "utf8"), /\[state\.status, state\.feedbackSequence\]/);
});
