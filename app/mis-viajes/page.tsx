import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCustomerIdentity } from "@/lib/customer/portal";
import { customerSignOut } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My trips | AC Travel", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default async function CustomerPortalPage() {
  const identity = await getCustomerIdentity();
  if (!identity) redirect("/mis-viajes/acceso");
  return <main className="mx-auto max-w-3xl space-y-6 px-6 py-16">
    <h1 className="text-3xl font-semibold">My trips</h1>
    <p>Welcome, {identity.displayName}.</p>
    <section aria-label="Customer portal" className="rounded border p-6">
      <h2 className="text-xl font-semibold">Your customer account is ready</h2>
      <p>For current trip information, please contact your AC Travel advisor.</p>
      <Link className="mt-4 inline-block underline" href="/mis-viajes/cotizaciones">View your commercial proposals</Link>
    </section>
    <form action={customerSignOut}><button className="rounded border px-4 py-2">Sign out</button></form>
  </main>;
}
