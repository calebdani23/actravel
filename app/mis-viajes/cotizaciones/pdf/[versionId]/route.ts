import { customerQuotePdf } from "@/lib/customer/quotes";
import { QUOTE_PDF_MIME_TYPE } from "@/lib/admin/quote-pdf-client";

export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ versionId: string }> }) {
  const { versionId } = await params;
  const result = await customerQuotePdf(versionId);
  const headers = { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex", "Referrer-Policy": "no-referrer" };
  if (!result.ok) return Response.json({ error: "Quote PDF is unavailable." }, { status: 404, headers });
  return new Response(result.bytes, { headers: { ...headers, "Content-Type": QUOTE_PDF_MIME_TYPE,
    "Content-Disposition": `attachment; filename="quote-version-${versionId}.pdf"`, "Content-Length": String(result.bytes.byteLength) } });
}
