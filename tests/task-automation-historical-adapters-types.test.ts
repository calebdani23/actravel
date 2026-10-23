import assert from "node:assert/strict"
import test from "node:test"
import type { BootstrapAuthResult } from "../lib/admin/task-automation-historical-auth"
import type {
  HistoricalPreviewSourceResult,
  HistoricalBoundarySuccess,
  HistoricalSourceSuccess,
} from "../lib/admin/task-automation-historical-preview-source"
import type { HistoricalPreviewResult } from "../lib/admin/task-automation-historical-preview"
import type { HistoricalApprovalInput, HistoricalApprovalProjection, HistoricalApprovalResult,
  HistoricalApprovalRpcArgs } from "../lib/admin/task-automation-historical-approval"
import type { HistoricalApplyInput, HistoricalApplyResult, HistoricalApplyRpcArgs } from "../lib/admin/task-automation-historical-apply"
import type { HistoricalReadinessCounts, HistoricalReadinessInput, HistoricalReadinessResult,
  HistoricalReadinessRow, HistoricalReadinessRpcArgs } from "../lib/admin/task-automation-historical-readiness"
import type { DispositionCounts, HistoricalPlan, OperationSourceKind, SnapshotCutoffs, SourceCutoffs } from "../lib/admin/task-automation-historical-contract"
import type { Database, Json } from "../lib/supabase/database.types"

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false
type Assert<T extends true> = T
type Failure<Code extends string> = Code extends string ? { ok: false; error: { code: Code; message: Code } } : never
type ExpectedAuth = { ok: true; actorId: string; actorRole: "admin" }
  | Failure<"AUTH_REQUIRED" | "AUTH_INACTIVE" | "AUTH_NOT_ADMIN" | "CLIENT_UNAVAILABLE">
type PreviewCode = "AUTH_REQUIRED" | "AUTH_INACTIVE" | "AUTH_NOT_ADMIN" | "AUTH_ACTOR_MISMATCH" | "CLIENT_UNAVAILABLE"
  | "CUTOFF_UNAVAILABLE" | "LIMIT_EXCEEDED" | "MALFORMED_ROW" | "INCOMPLETE_JOIN" | "QUERY_FAILED"
type ExpectedSource = { ok: true; actorId: string; boundary: HistoricalBoundarySuccess; source: HistoricalSourceSuccess }
  | Failure<PreviewCode>
type PreviewResultCode = PreviewCode | "SNAPSHOT_NOT_CONVERGED" | "CLASSIFICATION_FAILED" | "CANONICALIZATION_FAILURE"
type Diagnostics = { passes: number; logicalReads: number; physicalAttempts: number; opportunityRootCount: number; quoteVersionRootCount: number }
type PreviewFailure<Code extends string> = Code extends string
  ? { ok: false; error: { code: Code; message: Code }; diagnostics?: Diagnostics } : never
type ExpectedPreview = { ok: true; schema: "task-automation-historical-preview.v1"; ruleVersion: "task-automation-historical.v1";
  sourceCutoffs: SourceCutoffs; snapshotCutoffs: SnapshotCutoffs; snapshotHash: string; plan: HistoricalPlan; planHash: string;
  counts: DispositionCounts; totalCount: number; diagnostics: Diagnostics }
  | PreviewFailure<PreviewResultCode>
type ApprovalRow = Database["public"]["Tables"]["task_automation_historical_approvals"]["Row"]
type ExpectedApprovalRow = {
  id: string; request_id: string; actor_id: string; actor_role: string; schema_version: string; preview_schema: string
  rule_version: string; source_cutoffs: Json; snapshot_cutoffs: Json; snapshot_hash: string; plan: Json; plan_hash: string
  projections: Json; projection_hash: string; request_fingerprint: string; approval_fingerprint: string
  apply_generate_count: number; apply_suppress_count: number; already_projected_count: number; already_suppressed_count: number
  excluded_not_actionable_count: number; manual_review_owner_invalid_count: number; manual_review_context_invalid_count: number
  collision_manual_review_count: number; total_count: number; row_count: number; generate_count: number; suppress_count: number
  projection_count: number; plan_byte_count: number; projection_byte_count: number; request_byte_count: number; created_at: string
}
type Expand<T> = { [K in keyof T]: T[K] }
type ExpectedApprovalInsert = Expand<Omit<ExpectedApprovalRow, "id" | "actor_role" | "created_at">
  & Partial<Pick<ExpectedApprovalRow, "id" | "actor_role" | "created_at">>>
type ReceiptRow = Database["public"]["Tables"]["task_automation_historical_apply_receipts"]["Row"]
type ExpectedReceiptRow = {
  id: string; request_id: string; approval_id: string; actor_id: string; approval_fingerprint: string; plan_hash: string
  projection_hash: string; task_ids: string[]; origin_keys: string[]; outcome_keys: string[]; tombstone_keys: string[]
  generated_count: number; suppressed_count: number; projection_count: number; result: Json; result_hash: string
  result_byte_count: number; created_at: string
}
type ExpectedReceiptInsert = Expand<Omit<ExpectedReceiptRow, "id" | "created_at"> & Partial<Pick<ExpectedReceiptRow, "id" | "created_at">>>
type ExpectedProjection = { ordinal: number; action: "generate" | "suppress"; operationSourceKind: OperationSourceKind; operationSourceId: string;
  sourceKey: string; sourceOrder: number; originKey: string; taskId: string | null; taskKind: "first_contact" | "quote_follow_up" | null;
  ownerId: string | null; opportunityId: string | null; quoteId: string | null; quoteVersionId: string | null; sentEventId: string | null;
  anchorAt: string | null; dueRuleVersion: "mx-calendar.v1" | "elapsed-48h.v1" | null; dueAt: string | null; outcomeKey: string; tombstoneKey: string | null }
type ApprovalCode = "AUTH_REQUIRED" | "AUTH_INACTIVE" | "AUTH_NOT_ADMIN" | "AUTH_ACTOR_MISMATCH" | "INVALID_REQUEST"
  | "INVALID_PREVIEW" | "INVALID_PLAN" | "INVALID_PROJECTION" | "LIMIT_EXCEEDED" | "HASH_MISMATCH"
  | "APPROVAL_IDEMPOTENCY_CONFLICT" | "PERSISTENCE_FAILURE"
type ExpectedApproval = { ok: true; status: "success"; replayed: boolean; approvalId: string; requestId: string; actorId: string;
  actorRole: "admin"; schema: "task-automation-historical-approval.v1"; previewSchema: "task-automation-historical-preview.v1";
  ruleVersion: "task-automation-historical.v1"; sourceCutoffs: SourceCutoffs; snapshotCutoffs: SnapshotCutoffs; snapshotHash: string;
  plan: HistoricalPlan; planHash: string; projections: HistoricalApprovalProjection[]; projectionHash: string; requestFingerprint: string;
  counts: DispositionCounts; totalCount: number; rowCount: number; generateCount: number; suppressCount: number; projectionCount: number;
  planByteCount: number; projectionByteCount: number; requestByteCount: number; createdAt: string } | Failure<ApprovalCode>
type ApplyCode = "AUTH_REQUIRED" | "AUTH_INACTIVE" | "AUTH_NOT_ADMIN" | "AUTH_ACTOR_MISMATCH" | "INVALID_REQUEST"
  | "APPLY_IDEMPOTENCY_CONFLICT" | "APPLY_RECEIPT_INTEGRITY_FAILURE" | "APPROVAL_NOT_FOUND" | "APPROVAL_INTEGRITY_FAILURE"
  | "STALE_PLAN_INTEGRITY" | "STALE_LIVE_CONTEXT" | "STALE_SOURCE_ORDER" | "IDENTITY_OCCUPANCY_CONFLICT" | "LIMIT_EXCEEDED"
  | "PERSISTENCE_FAILURE"
type ExpectedApplyResultValue = { schema: "task-automation-historical-apply-result.v1"; requestId: string; approvalId: string;
  actorId: string; planHash: string; projectionHash: string; taskIds: string[]; originKeys: string[]; outcomeKeys: string[];
  tombstoneKeys: string[]; generatedCount: number; suppressedCount: number; projectionCount: number }
type ExpectedApply = { ok: true; status: "success"; replayed: boolean; receiptId: string; requestId: string; approvalId: string;
  actorId: string; approvalFingerprint: string; planHash: string; projectionHash: string; taskIds: string[]; originKeys: string[];
  outcomeKeys: string[]; tombstoneKeys: string[]; generatedCount: number; suppressedCount: number; projectionCount: number;
  result: ExpectedApplyResultValue; resultHash: string; resultByteCount: number; createdAt: string } | Failure<ApplyCode>
type ReadinessCode = "AUTH_REQUIRED" | "AUTH_INACTIVE" | "AUTH_NOT_ADMIN" | "AUTH_ACTOR_MISMATCH" | "INVALID_REQUEST"
  | "APPROVAL_NOT_FOUND" | "APPLY_RECEIPT_NOT_FOUND" | "APPROVAL_INTEGRITY_FAILURE" | "APPLY_RECEIPT_INTEGRITY_FAILURE"
  | "ROOT_ACCOUNTING_FAILURE" | "WRITE_PARITY_FAILURE" | "LIMIT_EXCEEDED" | "PERSISTENCE_FAILURE"
type ExpectedReadinessCounts = { applyGenerate: number; applySuppress: number; alreadyProjected: number; alreadySuppressed: number;
  excludedNotActionable: number; manualReviewOwnerInvalid: number; manualReviewContextInvalid: number;
  collisionManualReview: number; receiptGenerated: number; receiptSuppressed: number; plannedWrites: number;
  receiptWrites: number; taskBacked: number; suppressed: number; intentionalNoWrite: number;
  unresolvedManualReview: number; total: number }
type ExpectedReadinessRow = { ordinal: number; sourceKind: "opportunity_assignment" | "quote_sent"; rootId: string;
  disposition: "apply/generate" | "apply/suppress" | "already/projected" | "already/suppressed" | "excluded/not-actionable"
    | "manual-review/owner-invalid" | "manual-review/context-invalid" | "collision/manual-review";
  outcome: "generated" | "suppressed" | "already_projected" | "already_suppressed" | "excluded_not_actionable"
    | "manual_review_owner_invalid" | "manual_review_context_invalid" | "collision_manual_review";
  taskId: string | null; originKey: string | null; outcomeKey: string | null; tombstoneKey: string | null }
type ExpectedReadiness = { ok: true; requestId: string; approvalId: string; applyReceiptId: string; ready: boolean;
  counts: ExpectedReadinessCounts; rows: ExpectedReadinessRow[] } | Failure<ReadinessCode>
type Contracts = [
  Assert<Equal<BootstrapAuthResult<"CLIENT_UNAVAILABLE">, ExpectedAuth>>,
  Assert<Equal<HistoricalPreviewSourceResult, ExpectedSource>>,
  Assert<Equal<HistoricalPreviewResult, ExpectedPreview>>,
  Assert<Equal<ApprovalRow, ExpectedApprovalRow>>,
  Assert<Equal<Database["public"]["Tables"]["task_automation_historical_approvals"]["Insert"], ExpectedApprovalInsert>>,
  Assert<Equal<Database["public"]["Tables"]["task_automation_historical_approvals"]["Update"], Partial<ExpectedApprovalRow>>>,
  Assert<Equal<Database["public"]["Tables"]["task_automation_historical_approvals"]["Relationships"], []>>,
  Assert<Equal<ReceiptRow, ExpectedReceiptRow>>,
  Assert<Equal<Database["public"]["Tables"]["task_automation_historical_apply_receipts"]["Insert"], ExpectedReceiptInsert>>,
  Assert<Equal<Database["public"]["Tables"]["task_automation_historical_apply_receipts"]["Update"], Partial<ExpectedReceiptRow>>>,
  Assert<Equal<Database["public"]["Tables"]["task_automation_historical_apply_receipts"]["Relationships"], []>>,
  Assert<Equal<HistoricalApprovalInput, { requestId: string; preview: Extract<HistoricalPreviewResult, { ok: true }> }>>,
  Assert<Equal<HistoricalApprovalProjection, ExpectedProjection>>,
  Assert<Equal<HistoricalApprovalResult, ExpectedApproval>>,
  Assert<Equal<Database["public"]["Functions"]["approve_task_automation_historical_plan"]["Args"], HistoricalApprovalRpcArgs>>,
  Assert<Equal<Database["public"]["Functions"]["approve_task_automation_historical_plan"]["Returns"], Json>>,
  Assert<Equal<HistoricalApplyInput, { requestId: string }>>,
  Assert<Equal<HistoricalApplyRpcArgs, { p_request_id_text: string; p_expected_actor_id: string }>>,
  Assert<Equal<HistoricalApplyResult, ExpectedApply>>,
  Assert<Equal<Database["public"]["Functions"]["apply_task_automation_historical_plan"]["Args"], HistoricalApplyRpcArgs>>,
  Assert<Equal<Database["public"]["Functions"]["apply_task_automation_historical_plan"]["Returns"], Json>>,
  Assert<Equal<HistoricalReadinessInput, { requestId: string }>>,
  Assert<Equal<HistoricalReadinessRpcArgs, { p_request_id_text: string; p_expected_actor_id: string }>>,
  Assert<Equal<HistoricalReadinessCounts, ExpectedReadinessCounts>>,
  Assert<Equal<HistoricalReadinessRow, ExpectedReadinessRow>>,
  Assert<Equal<HistoricalReadinessResult, ExpectedReadiness>>,
  Assert<Equal<Database["public"]["Functions"]["read_task_automation_historical_readiness"]["Args"], HistoricalReadinessRpcArgs>>,
  Assert<Equal<Database["public"]["Functions"]["read_task_automation_historical_readiness"]["Returns"], Json>>,
]
const contracts: Contracts = [true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true,
  true, true, true, true, true, true, true, true, true, true, true, true]

test("historical bootstrap auth and source adapter expose exact closed types", () => {
  assert.deepEqual(contracts, Array(28).fill(true))
})
