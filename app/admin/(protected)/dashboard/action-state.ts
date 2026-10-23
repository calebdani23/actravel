export type MiDiaActionCode =
  | "AUTH_REQUIRED" | "AUTH_INACTIVE" | "AUTH_ROLE_UNSUPPORTED" | "AUTH_ACTOR_MISMATCH"
  | "INVALID_REQUEST" | "TASK_FORBIDDEN" | "TASK_ACTION_IDEMPOTENCY_CONFLICT"
  | "TASK_INVALID_TRANSITION" | "PERSISTENCE_FAILURE"

export type MiDiaActionState =
  | { status: "idle"; code: null; message: null; requestId: null; feedbackSequence: number }
  | { status: "success"; code: null; message: string; requestId: string; feedbackSequence: number }
  | { status: "failure"; code: MiDiaActionCode; message: string; requestId: string | null; feedbackSequence: number }

export const initialMiDiaActionState: MiDiaActionState = {
  status: "idle", code: null, message: null, requestId: null, feedbackSequence: 0,
}
