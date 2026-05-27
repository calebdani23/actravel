import "server-only";

import { sendWithResend } from "@/lib/email/resend";
import type { Json } from "@/lib/supabase/database.types";

export type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export type SendEmailResult = {
  provider: "resend";
  messageId?: string;
  raw?: Json;
};

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  return sendWithResend(input);
}
