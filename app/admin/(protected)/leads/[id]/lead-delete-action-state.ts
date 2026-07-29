export type LeadDeleteActionState = {
  contactDeleteRequested: boolean;
  ok: boolean;
  message: string | null;
  blockerMessages: string[];
};

export const initialLeadDeleteActionState: LeadDeleteActionState = {
  contactDeleteRequested: false,
  ok: false,
  message: null,
  blockerMessages: [],
};
