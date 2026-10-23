import type { Metadata } from "next";
import { PortalLogin } from "@/components/customer/portal-login";

export const metadata: Metadata = { title: "Customer access | AC Travel", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default function CustomerAccessPage() {
  return <main className="mx-auto max-w-lg space-y-6 px-6 py-16">
    <h1 className="text-3xl font-semibold">Customer access</h1>
    <PortalLogin />
  </main>;
}
