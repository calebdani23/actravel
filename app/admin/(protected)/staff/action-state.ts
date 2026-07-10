import type { ManagedStaffRole } from "@/lib/validations/staff";

export type StaffCreateActionState = {
  ok: boolean;
  message: string | null;
  fieldErrors: Record<string, string[]>;
  values: { email: string; full_name: string; role: ManagedStaffRole; is_active: boolean };
};

export type StaffUpdateActionState = {
  ok: boolean;
  message: string | null;
  fieldErrors: Record<string, string[]>;
};

export type StaffDeleteActionState = {
  ok: boolean;
  message: string | null;
  fieldErrors: Record<string, string[]>;
};

export const initialStaffCreateActionState: StaffCreateActionState = {
  ok: false,
  message: null,
  fieldErrors: {},
  values: { email: "", full_name: "", role: "asesor", is_active: true },
};

export const initialStaffUpdateActionState: StaffUpdateActionState = { ok: false, message: null, fieldErrors: {} };
export const initialStaffDeleteActionState: StaffDeleteActionState = { ok: false, message: null, fieldErrors: {} };
