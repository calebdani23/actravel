import { randomUUID } from "node:crypto";
import Link from "next/link";
import { requireAdminRoute } from "@/lib/admin/auth";
import { readCustomerQuoteWork } from "@/lib/admin/customer-quote-work";
import { CustomerWorkItem, type WorkRequestIds } from "@/components/admin/quotes/customer-work-actions";
import { customerQuoteWorkAction } from "./actions";

export const dynamic = "force-dynamic";
function requestIds(): WorkRequestIds {
  return { start: randomUUID(), complete: randomUUID(), cancel: {
    no_longer_needed: randomUUID(), duplicate: randomUUID(), source_invalidated: randomUUID(), other: randomUUID(),
  } };
}
export default async function CustomerQuoteWorkPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminRoute("/admin/customer-quote-work", ["admin", "asesor", "operaciones"]);
  const query = await searchParams;
  const result = await readCustomerQuoteWork({ before: query.before, after: query.after });
  return <main className="space-y-5">
    <h1 className="text-2xl font-semibold">Customer quote work</h1>
    <p>Review customer requests and prepare accepted-proposal handoffs. Missing advisor assignments appear in Admin intake.</p>
    {!result.ok ? <><p role="alert">Work items are unavailable. Reload without pagination to try again.</p><Link className="underline" href="/admin/customer-quote-work">Reload work items</Link></>
      : <>
        {result.items.length === 0 && <p>No work items available.</p>}
        {result.items.map(item => <CustomerWorkItem key={item.eventId} item={item} requestIds={requestIds()} action={customerQuoteWorkAction.bind(null, item.eventId)} />)}
        {result.next && <Link className="underline" href={`/admin/customer-quote-work?${new URLSearchParams({ before: result.next.createdAt, after: result.next.eventId })}`}>Earlier work items</Link>}
      </>}
  </main>;
}
