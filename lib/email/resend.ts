import "server-only";

import type { Json } from "@/lib/supabase/database.types";

export type ResendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export type ResendEmailResult = {
  provider: "resend";
  messageId?: string;
  raw?: Json;
};

export type EmailProviderUnavailable = {
  ok: false;
  provider: "resend";
  reason: string;
};

export function getResendReadiness(recipient?: string | null): { ok: true; from: string; apiKey: string } | EmailProviderUnavailable {
  if (!process.env.RESEND_API_KEY) return { ok: false, provider: "resend", reason: "RESEND_API_KEY is not configured" };
  if (!process.env.EMAIL_FROM) return { ok: false, provider: "resend", reason: "EMAIL_FROM is not configured" };
  if (!recipient) return { ok: false, provider: "resend", reason: "Recipient email is not configured" };
  return { ok: true, from: process.env.EMAIL_FROM, apiKey: process.env.RESEND_API_KEY };
}

export async function sendWithResend(input: ResendEmailInput): Promise<ResendEmailResult> {
  const ready = getResendReadiness(input.to);
  if (!ready.ok) throw new Error(ready.reason);

  const { Resend } = await import("resend");
  const resend = new Resend(ready.apiKey);
  const result = await resend.emails.send({ from: ready.from, to: input.to, subject: input.subject, text: input.text, html: input.html });

  if (result.error) throw new Error(result.error.message || "Resend rejected the email request");
  return { provider: "resend", messageId: result.data?.id, raw: result.data ? { id: result.data.id } : undefined };
}
