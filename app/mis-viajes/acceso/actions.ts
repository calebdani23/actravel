"use server";

import { redirect } from "next/navigation";
import { requestCustomerCode, verifyCustomerCode } from "@/lib/customer/portal";

export async function requestCodeAction(_previous: string, form: FormData) {
  await requestCustomerCode({ email: form.get("email"), invitationToken: form.get("invitationToken") });
  return "If access is available, a code has been sent. Check your email and enter the six-digit code below.";
}

export async function verifyCodeAction(_previous: string, form: FormData) {
  const result = await verifyCustomerCode({ email: form.get("email"), invitationToken: form.get("invitationToken"), code: form.get("code") });
  if (result.ok) redirect("/mis-viajes");
  return "Access could not be verified. Check your code or request a new invitation from AC Travel.";
}
