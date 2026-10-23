import assert from "node:assert/strict"
import test from "node:test"
import type { Database, Json } from "../lib/supabase/database.types"

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false
type Assert<T extends true> = T

type ReceiptRow = Database["public"]["Tables"]["follow_up_task_apply_receipts"]["Row"]
type ReceiptInsert = Database["public"]["Tables"]["follow_up_task_apply_receipts"]["Insert"]
type ReceiptUpdate = Database["public"]["Tables"]["follow_up_task_apply_receipts"]["Update"]
type ApplyFunction = Database["public"]["Functions"]["apply_approved_follow_up_task_plan"]

type ReceiptFields = {
  id: string
  request_id: string
  approval_id: string
  actor_id: string
  approval_fingerprint: string
  request_fingerprint: string
  canonical_plan_hash: string
  projection_hash: string
  status: string
  task_ids: string[]
  task_count: number
  result: Json
  result_hash: string
  result_byte_count: number
  created_at: string
}

type ApplyRpcArgs = {
  p_request_id_text: string
  p_expected_actor_id: string
}

type ApplyDomainCode =
  | "AUTH_REQUIRED"
  | "AUTH_INACTIVE"
  | "AUTH_NOT_ADMIN"
  | "AUTH_ACTOR_MISMATCH"
  | "INVALID_REQUEST"
  | "APPLY_IDEMPOTENCY_CONFLICT"
  | "APPROVAL_NOT_FOUND"
  | "APPROVAL_INTEGRITY_FAILURE"
  | "STALE_LIVE_CONTEXT"
  | "TASK_OCCUPANCY_CONFLICT"
  | "LIMIT_EXCEEDED"

type ApplyRpcSuccess = {
  ok: true
  status: "applied" | "replayed"
  id: string
  request_id: string
  approval_id: string
  actor_id: string
  approval_fingerprint: string
  request_fingerprint: string
  canonical_plan_hash: string
  projection_hash: string
  task_ids: string[]
  task_count: number
  result: Json
  result_hash: string
  result_byte_count: number
  created_at: string
}

type ApplyRpcFailure = {
  ok: false
  error: { code: ApplyDomainCode; message: ApplyDomainCode }
}

type ApplyRpcResult = ApplyRpcSuccess | ApplyRpcFailure

type _ReceiptRowExact = Assert<Equal<ReceiptRow, ReceiptFields>>
type ReceiptInsertFields = {
  id?: string
  request_id: string
  approval_id: string
  actor_id: string
  approval_fingerprint: string
  request_fingerprint: string
  canonical_plan_hash: string
  projection_hash: string
  status: string
  task_ids: string[]
  task_count: number
  result: Json
  result_hash: string
  result_byte_count: number
  created_at?: string
}
type _ReceiptInsertExact = Assert<Equal<ReceiptInsert, ReceiptInsertFields>>
type _ReceiptUpdateExact = Assert<Equal<ReceiptUpdate, { [K in keyof ReceiptFields]?: ReceiptFields[K] }>>
type _ReceiptRelationshipsExact = Assert<Equal<Database["public"]["Tables"]["follow_up_task_apply_receipts"]["Relationships"], []>>
type _ApplyArgsExact = Assert<Equal<ApplyFunction["Args"], ApplyRpcArgs>>
type _ApplyReturnsJson = Assert<Equal<ApplyFunction["Returns"], Json>>
type _ClosedResultUnion = Assert<Equal<ApplyRpcResult, ApplyRpcSuccess | ApplyRpcFailure>>

type TypeContracts = [
  _ReceiptRowExact,
  _ReceiptInsertExact,
  _ReceiptUpdateExact,
  _ReceiptRelationshipsExact,
  _ApplyArgsExact,
  _ApplyReturnsJson,
  _ClosedResultUnion,
]

const typeContracts: TypeContracts = [true, true, true, true, true, true, true]

test("manual apply boundary preserves exact receipt and private RPC contracts", () => {
  const applied: ApplyRpcResult = {
    ok: true,
    status: "applied",
    id: "00000000-0000-4000-8000-000000000001",
    request_id: "00000000-0000-4000-8000-000000000002",
    approval_id: "00000000-0000-4000-8000-000000000003",
    actor_id: "00000000-0000-4000-8000-000000000004",
    approval_fingerprint: "a".repeat(64),
    request_fingerprint: "b".repeat(64),
    canonical_plan_hash: "c".repeat(64),
    projection_hash: "d".repeat(64),
    task_ids: [],
    task_count: 0,
    result: { schema: "follow-up-task-apply-result.v1" },
    result_hash: "e".repeat(64),
    result_byte_count: 0,
    created_at: "2026-09-09T00:00:00.000Z",
  }
  const rejected: ApplyRpcResult = {
    ok: false,
    error: { code: "INVALID_REQUEST", message: "INVALID_REQUEST" },
  }
  assert.deepEqual(typeContracts, [true, true, true, true, true, true, true])
  assert.equal(applied.ok, true)
  assert.equal(rejected.ok, false)
})
