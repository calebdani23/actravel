import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";

export const localAdmissionPath = "tmp/week-03-followups-to-tasks-cutover/local-admission.json";

const schema = "follow-up-task-local-admission.v1";
const database = "disposable-postgres";
const readinessRpc = "read_follow_up_task_disposition_readiness";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const countKeys = [
  "eligible", "invalidDateNoTask", "manualReviewUnassignedOwner", "excludedLeadNotOperational",
  "excludedNonSelectedHistory", "alreadyConverted", "collisionManualReview", "taskBacked",
  "intentionalNoTask", "unresolvedManualReview", "total",
] as const;
const prerequisiteKeys = ["futureWrite", "activeReadIndex", "contactAggregate", "contact360Summary", "contactOpportunityPage"] as const;
const dispositionOutcomes = {
  eligible: "task_backed",
  "invalid-date/no-task": "intentional_no_task",
  "manual-review/unassigned-owner": "unresolved_manual_review",
  "excluded/lead-not-operational": "intentional_no_task",
  "excluded/non-selected-history": "intentional_no_task",
  "already-converted": "task_backed",
  "collision/manual-review": "unresolved_manual_review",
} as const;

type JsonObject = Record<string, unknown>;
type Prerequisites = Record<(typeof prerequisiteKeys)[number], true>;

export type LocalAdmission = {
  schema: typeof schema;
  selectedRequestId: string;
  database: typeof database;
  readinessRpc: typeof readinessRpc;
  readinessResult: JsonObject;
  prerequisites: Prerequisites;
};

function object(value: unknown, label: string): JsonObject {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as JsonObject;
}

function exactKeys(value: JsonObject, keys: readonly string[], label: string) {
  if (Object.keys(value).sort().join("|") !== [...keys].sort().join("|")) throw new Error(`${label} has invalid keys`);
}

function canonicalUuid(value: unknown, label: string): string {
  if (typeof value !== "string" || !uuidPattern.test(value)) throw new Error(`${label} must be a canonical UUID`);
  return value;
}

function selectedRequestId() {
  return canonicalUuid(process.env.FOLLOW_UP_TASK_CUTOVER_REQUEST_ID, "FOLLOW_UP_TASK_CUTOVER_REQUEST_ID");
}

function validatePrerequisites(value: unknown): Prerequisites {
  const prerequisites = object(value, "prerequisites");
  exactKeys(prerequisites, prerequisiteKeys, "prerequisites");
  for (const key of prerequisiteKeys) if (prerequisites[key] !== true) throw new Error(`prerequisite ${key} is unavailable`);
  return prerequisites as Prerequisites;
}

function validateReadiness(value: unknown, requestId: string) {
  const result = object(value, "readinessResult");
  exactKeys(result, ["ok", "requestId", "approvalId", "applyReceiptId", "ready", "counts", "rows"], "readinessResult");
  if (result.ok !== true || result.ready !== true || result.requestId !== requestId) throw new Error("readinessResult is not ready for the selected request");
  canonicalUuid(result.approvalId, "readinessResult.approvalId");
  canonicalUuid(result.applyReceiptId, "readinessResult.applyReceiptId");
  const counts = object(result.counts, "readinessResult.counts");
  exactKeys(counts, countKeys, "readinessResult.counts");
  for (const key of countKeys) if (!Number.isSafeInteger(counts[key]) || (counts[key] as number) < 0) throw new Error(`readinessResult.counts.${key} is invalid`);
  if (!Array.isArray(result.rows) || result.rows.length !== counts.total) throw new Error("readinessResult rows do not match total");
  const observed = Object.fromEntries(Object.keys(dispositionOutcomes).map((key) => [key, 0])) as Record<string, number>;
  const eventIds = new Set<string>();
  for (const [ordinal, value] of result.rows.entries()) {
    const row = object(value, `readinessResult.rows[${ordinal}]`);
    exactKeys(row, ["ordinal", "eventId", "disposition", "outcome", "taskId"], `readinessResult.rows[${ordinal}]`);
    const eventId = canonicalUuid(row.eventId, `readinessResult.rows[${ordinal}].eventId`);
    const disposition = row.disposition as keyof typeof dispositionOutcomes;
    if (row.ordinal !== ordinal || !(disposition in dispositionOutcomes) || row.outcome !== dispositionOutcomes[disposition] || eventIds.has(eventId)) throw new Error(`readinessResult.rows[${ordinal}] is invalid`);
    eventIds.add(eventId);
    observed[disposition] += 1;
    if (row.outcome === "task_backed") canonicalUuid(row.taskId, `readinessResult.rows[${ordinal}].taskId`);
    else if (row.taskId !== null) throw new Error(`readinessResult.rows[${ordinal}].taskId must be null`);
  }
  const mappedCounts = ["eligible", "invalid-date/no-task", "manual-review/unassigned-owner", "excluded/lead-not-operational", "excluded/non-selected-history", "already-converted", "collision/manual-review"];
  for (const [index, key] of mappedCounts.entries()) if (counts[countKeys[index]] !== observed[key]) throw new Error(`readinessResult count mismatch for ${key}`);
  if (counts.taskBacked !== (counts.eligible as number) + (counts.alreadyConverted as number)
    || counts.intentionalNoTask !== (counts.invalidDateNoTask as number) + (counts.excludedLeadNotOperational as number) + (counts.excludedNonSelectedHistory as number)
    || counts.unresolvedManualReview !== (counts.manualReviewUnassignedOwner as number) + (counts.collisionManualReview as number)
    || counts.unresolvedManualReview !== 0
    || counts.total !== (counts.taskBacked as number) + (counts.intentionalNoTask as number) + (counts.unresolvedManualReview as number)) throw new Error("readinessResult accounting is invalid");
  return result;
}

function validateEvidence(value: unknown, requestId: string): LocalAdmission {
  const evidence = object(value, "local admission evidence");
  exactKeys(evidence, ["schema", "selectedRequestId", "database", "readinessRpc", "readinessResult", "prerequisites"], "local admission evidence");
  if (evidence.schema !== schema || evidence.selectedRequestId !== requestId || evidence.database !== database || evidence.readinessRpc !== readinessRpc) throw new Error("local admission evidence identity is invalid");
  validateReadiness(evidence.readinessResult, requestId);
  validatePrerequisites(evidence.prerequisites);
  return evidence as LocalAdmission;
}

export function removeLocalAdmission() {
  rmSync(localAdmissionPath, { force: true });
}

export function assertLocalAdmission(): LocalAdmission {
  try {
    return validateEvidence(JSON.parse(readFileSync(localAdmissionPath, "utf8")), selectedRequestId());
  } catch (cause) {
    removeLocalAdmission();
    throw new Error("Local follow-up Task cutover admission is invalid", { cause });
  }
}

export function writeLocalAdmission(readinessResult: unknown, prerequisites: unknown): LocalAdmission {
  const temporaryPath = `${localAdmissionPath}.${process.pid}.tmp`;
  removeLocalAdmission();
  rmSync(temporaryPath, { force: true });
  try {
    const requestId = selectedRequestId();
    const evidence = validateEvidence({ schema, selectedRequestId: requestId, database, readinessRpc, readinessResult, prerequisites }, requestId);
    mkdirSync("tmp/week-03-followups-to-tasks-cutover", { recursive: true });
    writeFileSync(temporaryPath, `${JSON.stringify(evidence, null, 2)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
    renameSync(temporaryPath, localAdmissionPath);
    return evidence;
  } catch (cause) {
    removeLocalAdmission();
    rmSync(temporaryPath, { force: true });
    throw new Error("Local follow-up Task cutover admission is invalid", { cause });
  }
}
