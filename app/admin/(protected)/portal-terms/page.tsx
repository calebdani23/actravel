import { requireAdminRoute } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";
import { PublishTerms } from "@/components/customer/publish-terms";

export default async function PortalTermsPage() {
  await requireAdminRoute("/admin/portal-terms", ["admin"]);
  const { data, error } = await (await createClient()).from("portal_quote_terms").select("id,revision,body,sha256,is_active,published_at").order("published_at", { ascending: false }).limit(20);
  if (error) throw new Error("Terms history is unavailable.");
  return <div className="space-y-6"><h1 className="text-2xl font-semibold">Customer quote terms</h1><PublishTerms />
    <h2 className="text-xl font-semibold">Published revisions</h2><ul className="space-y-4">{(data ?? []).map(row => <li key={row.id} className="rounded border p-4">
      <h3 className="font-semibold">{row.revision} — {row.is_active ? "Current" : "Retained"}</h3><p>{row.published_at}</p>
      <details><summary>Approved text and hash</summary><p className="whitespace-pre-wrap">{row.body}</p><code className="break-all">{row.sha256}</code></details>
    </li>)}</ul></div>;
}
