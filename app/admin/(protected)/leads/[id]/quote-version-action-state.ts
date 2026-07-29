export type QuoteVersionActionState = {
  ok: boolean;
  message: string | null;
  fieldErrors: Record<string, string[]>;
};

export const initialQuoteVersionActionState: QuoteVersionActionState = {
  ok: false,
  message: null,
  fieldErrors: {},
};
