export type QuoteActionState = {
  ok: boolean;
  message: string | null;
  fieldErrors: Record<string, string[]>;
  quoteId?: string;
  quoteVersionId?: string;
  lockVersion?: number;
};

export type QuotePdfIntentDescriptor = {
  intentId: string;
  bucket: string;
  path: string;
  expectedSizeBytes: number;
  intentStatus: string;
};

export type QuotePdfSagaActionState = QuoteActionState & {
  intent?: QuotePdfIntentDescriptor;
  cleanupAllowed?: boolean;
};

export type BeginQuoteRegistrationInput = {
  contactId: string;
  opportunityId: string;
  originatingRequestId?: string;
  title: string;
  summary?: string;
  currency: string;
  totalAmount?: string;
  depositAmount?: string;
  validUntil?: string;
  notes?: string;
  expectedSizeBytes: number;
  advisorySha256: string;
  idempotencyKey: string;
};

export type BeginQuotePdfUploadInput = {
  quoteId: string;
  quoteVersionId: string;
  expectedSizeBytes: number;
  idempotencyKey: string;
};

export const initialQuoteActionState: QuoteActionState = {
  ok: false,
  message: null,
  fieldErrors: {},
};
