"use server";
import { revalidatePath } from "next/cache";
import { requireAdminRole } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";

export async function publishTermsAction(_previous: string, form: FormData) {
  await requireAdminRole(["admin"]);
  const revision = form.get("revision"), body = form.get("body");
  if (form.get("approved") !== "on" || typeof revision !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(revision)
    || typeof body !== "string" || !body.trim() || Buffer.byteLength(body.trim(), "utf8") > 16000) return "Confirm the approved text and a unique revision label.";
  try {
    const { data, error } = await (await createClient()).rpc("publish_portal_quote_terms", { p_revision: revision, p_body: body.trim() });
    if (error || data?.ok !== true) return "Terms could not be published. Use a new revision label and try again.";
    revalidatePath("/admin/portal-terms"); revalidatePath("/mis-viajes/cotizaciones", "layout");
    return "Approved terms published. Previous revisions remain preserved.";
  } catch { return "Terms could not be published. Try again."; }
}
