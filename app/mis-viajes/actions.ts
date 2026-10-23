"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function customerSignOut() {
  await (await createClient()).auth.signOut({ scope: "local" });
  redirect("/mis-viajes/acceso");
}
