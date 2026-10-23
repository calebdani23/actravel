import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { initialMiDiaActionState } from "@/app/admin/(protected)/dashboard/action-state"
import { runMiDiaTaskAction } from "@/app/admin/(protected)/dashboard/actions"
import { readMiDiaActionContext, type MiDiaActionContext, type MiDiaActorResult, type MiDiaKind } from "@/lib/admin/mi-dia"
import type { TaskActionResult } from "@/lib/admin/task-actions"

const actorId = "10000000-0000-4000-8000-000000000001", taskId = "20000000-0000-4000-8000-000000000001", requestId = "30000000-0000-4000-8000-000000000001"
const actor = { ok: true, actorId, profile: { id: actorId, isActive: true }, rawRoleNames: ["asesor"], roles: ["asesor"], scope: "self" } as MiDiaActorResult
const context = (kind: MiDiaKind = "follow_up", navigationHref: string | null = `/admin/leads/${taskId}`): MiDiaActionContext => ({ ok: true, taskId, ownerId: actorId, kind, status: "pending", leadId: taskId, quoteId: null, navigationHref })
const form = (values: Record<string, string> = {}) => {
  const data = new FormData()
  for (const [key, value] of Object.entries({ requestId, taskId, intent: "start", taskKind: "follow_up", cancelReason: "", ...values })) data.append(key, value)
  return data
}
const actionSuccess = (outcome: "applied" | "already_at_target" = "applied") => ({ ok: true, outcome, replayed: false }) as Extract<TaskActionResult, { ok: true }>

test("authorization denial precedes parsing, Task context, canonical action, and revalidation", async () => {
  for (const [label, code] of [["anonymous", "AUTH_REQUIRED"], ["inactive", "AUTH_INACTIVE"], ["operations", "AUTH_ROLE_UNSUPPORTED"], ["finance", "AUTH_ROLE_UNSUPPORTED"], ["marketing", "AUTH_ROLE_UNSUPPORTED"], ["unsupported union", "AUTH_ROLE_UNSUPPORTED"], ["unknown", "AUTH_ROLE_UNSUPPORTED"]] as const) {
    const calls: string[] = []
    const result = await runMiDiaTaskAction(initialMiDiaActionState, form({ extra: "forged" }), {
      authorizeActor: async () => { calls.push(`auth:${label}`); return { ok: false, error: { code, message: code } } },
      readContext: async () => { calls.push("task"); return context() }, performAction: async () => { calls.push("action"); return actionSuccess() }, revalidate: (path) => calls.push(path),
    })
    assert.deepEqual(result, { status: "failure", code, message: "Tu sesión ya no permite actualizar esta tarea.", requestId: null, feedbackSequence: 1 })
    assert.deepEqual(calls, [`auth:${label}`])
  }
})

test("exact forms map start, kind-aware completion, and cancellation to the unchanged boundary", async () => {
  const cases = [
    [{ intent: "start", taskKind: "follow_up", cancelReason: "" }, { targetStatus: "in_progress", cancelReason: null, completionOutcome: null }, "Tarea iniciada."],
    [{ intent: "complete", taskKind: "first_contact", cancelReason: "" }, { targetStatus: "completed", cancelReason: null, completionOutcome: "first_contact_completed" }, "Tarea completada."],
    [{ intent: "complete", taskKind: "quote_follow_up", cancelReason: "" }, { targetStatus: "completed", cancelReason: null, completionOutcome: "work_completed" }, "Tarea completada."],
    [{ intent: "cancel", taskKind: "follow_up", cancelReason: "duplicate" }, { targetStatus: "canceled", cancelReason: "duplicate", completionOutcome: null }, "Tarea cancelada."],
  ] as const
  for (const [values, expected, message] of cases) {
    const calls: unknown[] = [], paths: string[] = []
    const result = await runMiDiaTaskAction(initialMiDiaActionState, form({ ...values }), {
      authorizeActor: async () => actor, readContext: async () => context(values.taskKind),
      performAction: async (input) => { calls.push(input); return actionSuccess() }, revalidate: (path) => paths.push(path),
    })
    assert.deepEqual(calls, [{ requestId, taskId, ...expected, note: null }])
    assert.deepEqual(result, { status: "success", code: null, message, requestId, feedbackSequence: 1 })
    assert.deepEqual(paths, ["/admin/dashboard", `/admin/leads/${taskId}`])
  }
})

test("parsing, actual kind, safe feedback, replay identity, and success-only revalidation stay closed", async () => {
  for (const invalid of [form({ requestId: "A0000000-0000-4000-8000-000000000001" }), form({ intent: "start", cancelReason: "other" }), form({ intent: "cancel", cancelReason: "unknown" }), form({ navigationHref: "/admin/leads/forged" }), form({ completionOutcome: "work_completed" })]) {
    let calls = 0
    assert.equal((await runMiDiaTaskAction(initialMiDiaActionState, invalid, { authorizeActor: async () => actor, readContext: async () => { calls++; return context() }, performAction: async () => { calls++; return actionSuccess() }, revalidate: () => { calls++ } })).code, "INVALID_REQUEST")
    assert.equal(calls, 0)
  }
  const duplicate = form(); duplicate.append("intent", "complete")
  assert.equal((await runMiDiaTaskAction(initialMiDiaActionState, duplicate, { authorizeActor: async () => actor })).code, "INVALID_REQUEST")
  assert.equal((await runMiDiaTaskAction(initialMiDiaActionState, form(), { authorizeActor: async () => actor, readContext: async () => context("first_contact") })).code, "INVALID_REQUEST")
  const copies = { AUTH_REQUIRED: "Tu sesión ya no permite actualizar esta tarea.", AUTH_INACTIVE: "Tu sesión ya no permite actualizar esta tarea.", AUTH_ROLE_UNSUPPORTED: "Tu sesión ya no permite actualizar esta tarea.", AUTH_ACTOR_MISMATCH: "Tu sesión ya no permite actualizar esta tarea.", TASK_FORBIDDEN: "Tu sesión ya no permite actualizar esta tarea.", INVALID_REQUEST: "La solicitud no es válida.", TASK_ACTION_IDEMPOTENCY_CONFLICT: "La solicitud ya se usó para otra acción.", TASK_INVALID_TRANSITION: "La tarea cambió y esta acción ya no está disponible.", PERSISTENCE_FAILURE: "No pudimos actualizar la tarea. Intenta de nuevo." } as const
  for (const [code, message] of Object.entries(copies)) {
    const paths: string[] = []
    const result = await runMiDiaTaskAction(initialMiDiaActionState, form(), { authorizeActor: async () => actor, readContext: async () => context(), performAction: async () => ({ ok: false, error: { code, message: code } }) as never, revalidate: (path) => paths.push(path) })
    assert.deepEqual(result, { status: "failure", code, message, requestId, feedbackSequence: 1 }); assert.deepEqual(paths, [])
  }
  assert.equal((await runMiDiaTaskAction(initialMiDiaActionState, form(), { authorizeActor: async () => actor, readContext: async () => context(), performAction: async () => ({ ...actionSuccess(), replayed: true }), revalidate: () => {} })).message, "Tarea iniciada.")
  const dashboardOnly: string[] = []
  assert.equal((await runMiDiaTaskAction(initialMiDiaActionState, form(), { authorizeActor: async () => actor, readContext: async () => context("follow_up", null), performAction: async () => actionSuccess("already_at_target"), revalidate: (path) => dashboardOnly.push(path) })).message, "La tarea ya estaba actualizada."); assert.deepEqual(dashboardOnly, ["/admin/dashboard"])
  assert.doesNotMatch(readFileSync("lib/admin/task-actions.ts", "utf8"), /TaskActionDomainCode[^]*AUTH_ROLE_UNSUPPORTED/)
})

test("current CRM helpers derive only an independently authorized context path", async () => {
  const calls: string[] = [], row = { id: taskId, owner_id: actorId, task_kind: "follow_up", status: "pending", lead_id: taskId, quote_id: null }
  const result = await readMiDiaActionContext(actor as never, taskId, { createClient: async () => ({}), readTask: async () => ({ data: row, error: null }), canReadLead: async () => { calls.push("lead"); return { data: true, error: null } } })
  assert.deepEqual(result, context()); assert.deepEqual(calls, ["lead"])
  const denied = await readMiDiaActionContext(actor as never, taskId, { createClient: async () => ({}), readTask: async () => ({ data: row, error: null }), canReadLead: async () => ({ data: false, error: null }) })
  assert.deepEqual(denied, context("follow_up", null))
  const helperError = await readMiDiaActionContext(actor as never, taskId, { createClient: async () => ({}), readTask: async () => ({ data: row, error: null }), canReadLead: async () => { throw new Error("provider detail") } })
  assert.deepEqual(helperError, context("follow_up", null))
  const quote = { ...row, task_kind: "quote_follow_up", lead_id: null, quote_id: taskId }
  const quoteResult = await readMiDiaActionContext(actor as never, taskId, { createClient: async () => ({}), readTask: async () => ({ data: quote, error: null }), canReadQuote: async () => ({ data: true, error: null }) })
  assert.equal(quoteResult.ok && quoteResult.navigationHref, `/admin/quotes/${taskId}`)
})

test("identical retry failures advance feedback sequence without replacing request identity", async () => {
  const deps = {
    authorizeActor: async () => actor,
    readContext: async () => context("follow_up", null),
    performAction: async () => ({ ok: false, error: { code: "PERSISTENCE_FAILURE", message: "PERSISTENCE_FAILURE" } } as const),
  }
  const first = await runMiDiaTaskAction(initialMiDiaActionState, form(), deps)
  const second = await runMiDiaTaskAction(first, form(), deps)
  assert.deepEqual([first.feedbackSequence, second.feedbackSequence], [1, 2])
  assert.deepEqual([first.requestId, second.requestId], [requestId, requestId])
  assert.equal(first.message, second.message)
})
