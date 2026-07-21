export type LogActionState = {
  ok: boolean;
  message: string | null;
};

export const initialLogActionState: LogActionState = {
  ok: false,
  message: null,
};
