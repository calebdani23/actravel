import assert from "node:assert/strict";
import test from "node:test";
import { actorSession, psql, sqlLiteral, withPostgresContainer } from "./helpers/postgres-runtime";
import { portalActors as actors, portalId, portalPdfHash, portalRpc, preparePortalQuotesDatabase, registerPortalQuote } from "./helpers/customer-quotes-runtime";

test("customer quote read/PDF/terms boundaries preserve canonical staff contracts", {
  skip: process.env.RUN_CUSTOMER_QUOTES_DB_TESTS !== "1", timeout: 360_000,
}, async t => withPostgresContainer(async () => {
  preparePortalQuotesDatabase();
  const own = registerPortalQuote(), foreign = registerPortalQuote(portalId(22), "portal_quote_b");
  const ready = registerPortalQuote(portalId(21), "private_ready", false);
  await t.test("only own published versions are projected, never notes or draft-ready fields", () => {
    const page = portalRpc(actors.alice, "public.read_customer_quotes(null,null,20)");
    assert.equal(page.ok, true);
    assert.deepEqual(page.items.map((row: { quoteId: string }) => row.quoteId), [own.quoteId]);
    const detail = portalRpc(actors.alice, `public.read_customer_quote('${own.quoteId}',null,null)`);
    assert.equal(detail.ok, true);
    assert.equal(detail.version.versionId, own.versionId);
    assert.equal(detail.version.canAccept, false, "no approved terms yet");
    assert.equal(detail.terms, null);
    assert.equal(JSON.stringify(detail).includes("PRIVATE"), false);
    assert.equal(portalRpc(actors.alice, `public.read_customer_quote('${foreign.quoteId}',null,null)`).ok, false);
    assert.equal(portalRpc(actors.alice, `public.read_customer_quote('${ready.quoteId}',null,null)`).ok, false);
    assert.equal(portalRpc(actors.admin, "public.read_customer_quotes(null,null,20)").ok, false);
    assert.equal(psql("quote_base", `${actorSession(actors.alice)} select count(*) from public.quotes;`).split("\n").at(-1), "0");
  });
  await t.test("approved terms are immutable and publication is Admin-only", () => {
    const body = "TEST ONLY — synthetic approval terms, not production legal copy.";
    assert.equal(portalRpc(actors.advisor, `public.publish_portal_quote_terms('test-v1',${sqlLiteral(body)})`).ok, false);
    const first = portalRpc(actors.admin, `public.publish_portal_quote_terms('test-v1',${sqlLiteral(body)})`);
    assert.equal(first.ok, true);
    assert.deepEqual(portalRpc(actors.admin, `public.publish_portal_quote_terms('test-v1',${sqlLiteral(body)})`), first);
    assert.throws(() => psql("quote_base", `update public.portal_quote_terms set body='changed' where id='${first.termsId}';`), /IMMUTABLE/);
    const detail = portalRpc(actors.alice, `public.read_customer_quote('${own.quoteId}',null,null)`);
    assert.equal(detail.terms.body, body);
    assert.equal(detail.version.canAccept, true);
    assert.equal(portalRpc(actors.admin, `public.publish_portal_quote_terms('test-v1','different')`).ok, false);
  });
  await t.test("PDF lookup is authorized by exact version, with no direct storage/table access", () => {
    const metadata = portalRpc(actors.alice, `public.read_customer_quote_pdf('${own.versionId}')`);
    assert.equal(metadata.ok, true);
    assert.equal(metadata.pdf.sha256, portalPdfHash);
    assert.equal(metadata.pdf.path, own.path);
    assert.equal(portalRpc(actors.alice, `public.read_customer_quote_pdf('${foreign.versionId}')`).ok, false);
    assert.equal(portalRpc(actors.alice, `public.read_customer_quote_pdf('${ready.versionId}')`).ok, false);
    assert.equal(psql("quote_base", `${actorSession(actors.alice)} select count(*) from public.documents;`).split("\n").at(-1), "0");
    assert.equal(psql("quote_base", `${actorSession(actors.alice)} select count(*) from storage.objects where bucket_id='quote-pdfs';`).split("\n").at(-1), "0");
    psql("quote_base", `update public.contacts set blocked_at=now() where id='${portalId(11)}';`);
    assert.equal(portalRpc(actors.alice, `public.read_customer_quote_pdf('${own.versionId}')`).ok, false);
    psql("quote_base", `update public.contacts set blocked_at=null where id='${portalId(11)}';`);
  });
}));
