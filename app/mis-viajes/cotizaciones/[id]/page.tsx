import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCustomerIdentity } from "@/lib/customer/portal";
import { customerQuoteDetail } from "@/lib/customer/quotes";

export const dynamic = "force-dynamic";
export default async function CustomerQuotePage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!await getCustomerIdentity()) redirect("/mis-viajes/acceso");
  const { id } = await params, query = await searchParams;
  const result = await customerQuoteDetail(id, { versionId: query.version, beforeVersion: query.beforeVersion === undefined ? undefined : Number(query.beforeVersion) });
  if (!result.ok) { if (result.code === "NOT_AVAILABLE" || result.code === "INVALID_INPUT") notFound(); throw new Error("Proposal is unavailable."); }
  const { quote, version, terms } = result;
  return <main className="mx-auto max-w-4xl space-y-6 px-6 py-12">
    <Link className="underline" href="/mis-viajes/cotizaciones">All proposals</Link>
    <h1 className="text-3xl font-semibold">{quote.number} — {version.title}</h1>
    <p>Version {version.versionNumber} · {version.status}{!version.current && " · Previous version (read-only)"}</p>
    {version.summary && <p className="whitespace-pre-wrap">{version.summary}</p>}
    <dl className="grid grid-cols-2 gap-2"><dt>Total</dt><dd>{version.currency} {version.totalAmount?.toFixed(2) ?? "—"}</dd>
      <dt>Deposit</dt><dd>{version.currency} {version.depositAmount?.toFixed(2) ?? "—"}</dd><dt>Valid through (UTC date)</dt><dd>{version.validUntil ?? "Not specified"}</dd></dl>
    {version.pdf ? <a className="inline-block rounded border px-4 py-2" href={`/mis-viajes/cotizaciones/pdf/${version.versionId}`}>Download proposal PDF</a> : <p>PDF is unavailable. Contact your advisor.</p>}
    <section aria-label="Proposal terms" className="space-y-3 rounded border p-4"><h2 className="text-xl font-semibold">Approved terms</h2>
      {terms ? <><p>Revision {terms.revision}</p><p className="whitespace-pre-wrap">{terms.body}</p></> : <p>Acceptance is unavailable until approved terms are published.</p>}
    </section>
    <section aria-label="Version comparison"><h2 className="text-xl font-semibold">Published version history</h2>
      <div className="overflow-x-auto"><table className="w-full text-left"><thead><tr><th>Version</th><th>Status</th><th>Total</th><th>Deposit</th><th>Validity</th></tr></thead>
        <tbody>{result.history.map(row => <tr key={row.versionId}><td><Link className="underline" href={`/mis-viajes/cotizaciones/${id}?version=${row.versionId}`}>{row.versionNumber}: {row.title}</Link></td>
          <td>{row.status}</td><td>{row.currency} {row.totalAmount?.toFixed(2) ?? "—"}</td><td>{row.depositAmount?.toFixed(2) ?? "—"}</td><td>{row.validUntil ?? "—"}</td></tr>)}</tbody></table></div>
      {result.nextBeforeVersion !== null && <Link className="underline" href={`/mis-viajes/cotizaciones/${id}?beforeVersion=${result.nextBeforeVersion}&version=${version.versionId}`}>Earlier versions</Link>}
    </section>
  </main>;
}
