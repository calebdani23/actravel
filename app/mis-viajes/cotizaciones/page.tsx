import Link from "next/link";
import { redirect } from "next/navigation";
import { getCustomerIdentity } from "@/lib/customer/portal";
import { customerQuotePage } from "@/lib/customer/quotes";

export const dynamic = "force-dynamic";
export default async function CustomerQuotesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!await getCustomerIdentity()) redirect("/mis-viajes/acceso");
  const query = await searchParams;
  const result = await customerQuotePage({ before: query.before, after: query.after });
  return <main className="mx-auto max-w-4xl space-y-6 px-6 py-12">
    <Link href="/mis-viajes" className="underline">My trips</Link>
    <h1 className="text-3xl font-semibold">Your proposals</h1>
    {!result.ok ? <p role="alert">Proposals are unavailable. <Link href="/mis-viajes/cotizaciones" className="underline">Try again</Link></p>
      : <><ul className="space-y-4">{result.items.map(quote => <li key={quote.quoteId} className="rounded border p-4">
        <Link className="text-lg font-semibold underline" href={`/mis-viajes/cotizaciones/${quote.quoteId}`}>{quote.number} — {quote.title}</Link>
        <p>{quote.status} · {quote.currency} {quote.totalAmount?.toFixed(2) ?? "—"}</p>
      </li>)}</ul>{!result.items.length && <p>No proposals have been sent to this account yet.</p>}
      {result.next && <Link className="underline" href={`/mis-viajes/cotizaciones?${new URLSearchParams({ before: result.next.createdAt, after: result.next.quoteId })}`}>More proposals</Link>}</>}
  </main>;
}
