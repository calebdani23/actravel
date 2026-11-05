import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { QuoteActions, QuoteEvidence, QuoteFeedback, settleQuoteForm, focusQuoteFeedback, submitQuoteAction, quoteConsentIsCurrent, type QuoteActionState } from "../components/customer/quote-actions";
import { CustomerWorkItem, workCommand, type WorkRequestIds } from "../components/admin/quotes/customer-work-actions";
import type { CustomerQuoteDetail } from "../lib/customer/quotes";
import type { QuoteWorkItem } from "../lib/admin/customer-quote-work";

const id = "d0000000-0000-4000-8000-000000000001";
const other = "d0000000-0000-4000-8000-000000000002";
const idle: QuoteActionState = { status: "idle", message: "", sequence: 0, operation: null, nextRequestId: null };
const action = async () => idle;
const version = { versionId: id, versionNumber: 2, status: "sent", current: true, canAccept: true, canRequestChanges: true,
  title: "Proposal", summary: null, currency: "MXN", totalAmount: 100, depositAmount: 20, validUntil: null, pdf: null } as const;
const detail: CustomerQuoteDetail = { ok: true, quote: { quoteId: id, number: "TEST", lockVersion: 1 }, version,
  history: [version], nextBeforeVersion: null, terms: { termsId: id, revision: "TEST-ONLY", body: "Synthetic fixture terms", sha256: "a".repeat(64) },
  acceptance: null, requests: [] };

test("customer controls require explicit consent and hide unavailable/previous-version actions", () => {
  const html = renderToStaticMarkup(<QuoteActions action={action} viewKey="view-1" canAccept canRequestChanges requestIds={{ accept: id, change: other }} />);
  assert.match(html, /type="checkbox"[^>]*name="consent"/);
  assert.match(html, /disabled=""[^>]*value="accept"[^]*Accept proposal/);
  assert.match(html, /name="body"/);
  assert.match(html, /value="change"[^]*Request changes/);
  assert.match(html, new RegExp(`name="acceptRequestId"[^>]*value="${id}"`));
  assert.match(html, new RegExp(`name="changeRequestId"[^>]*value="${other}"`));
  assert.doesNotMatch(html, /maxLength=/);
  const unavailable = renderToStaticMarkup(<QuoteActions action={action} viewKey="view-1" canAccept={false} canRequestChanges={false} requestIds={{ accept: id, change: other }} />);
  assert.doesNotMatch(unavailable, /<form|<button|type="checkbox"/);
  assert.match(unavailable, /unavailable for this version/);
});

test("consent cannot carry across a changed viewed lock, terms or PDF snapshot", () => {
  const viewed = "3:terms-1:terms-hash:pdf-hash";
  assert.equal(quoteConsentIsCurrent(true, viewed, viewed), true);
  assert.equal(quoteConsentIsCurrent(false, viewed, viewed), false);
  assert.equal(quoteConsentIsCurrent(true, null, viewed), false);
  for (const changed of ["4:terms-1:terms-hash:pdf-hash", "3:terms-2:new-hash:pdf-hash", "3:terms-1:terms-hash:new-pdf"]) {
    assert.equal(quoteConsentIsCurrent(true, viewed, changed), false);
  }
});

test("customer evidence distinguishes immutable receipts, accepted terms, staff acceptance and request history", () => {
  const accepted = { ...detail, acceptance: { acceptanceId: id, acceptedAt: "2026-11-05T12:00:00.000000Z", documentSha256: "b".repeat(64) },
    requests: [{ requestId: other, versionId: id, body: "<script>not markup</script>", createdAt: "2026-11-05T12:00:00.000000Z", status: "pending" as const }] };
  const html = renderToStaticMarkup(<QuoteEvidence detail={accepted} />);
  for (const text of ["Verified customer acceptance", "Accepted terms", "TEST-ONLY", "Synthetic fixture terms", "Receipt", "PDF SHA-256", "Recent change requests", "Version 2", "pending"]) assert.ok(html.includes(text), text);
  assert.match(html, /&lt;script&gt;not markup&lt;\/script&gt;/);
  const staff = renderToStaticMarkup(<QuoteEvidence detail={{ ...detail, version: { ...version, status: "accepted" } }} />);
  assert.match(staff, /Accepted by staff/);
  assert.match(staff, /No verified customer acceptance receipt/);
  assert.doesNotMatch(staff, /Accepted terms/);
  const missing = renderToStaticMarkup(<QuoteEvidence detail={{ ...detail, terms: null }} />);
  assert.match(missing, /until approved terms are published/);
});

test("failed inputs persist; only successful change requests clear the textarea", () => {
  const form = { body: "Keep my request", consent: true };
  assert.deepEqual(settleQuoteForm(form, { ...idle, status: "failure", operation: "change" }), form);
  assert.deepEqual(settleQuoteForm(form, { ...idle, status: "success", operation: "change" }), { body: "", consent: true });
  assert.deepEqual(settleQuoteForm(form, { ...idle, status: "success", operation: "accept" }), { body: form.body, consent: false });
  const source = readFileSync("components/customer/quote-actions.tsx", "utf8");
  assert.match(source, /useState\(requestIds\)/);
  assert.match(source, /state\.nextRequestId \?\? ids\.change/);
  assert.match(source, /<fieldset disabled=\{pending\}/);
  assert.match(source, /value=\{form\.body\}/);
});

test("identical errors have distinct live feedback and each moves focus", () => {
  let count = 0;
  const ref = { current: { focus: () => { count += 1; } } };
  for (const sequence of [1, 2]) {
    const state = { ...idle, status: "failure" as const, sequence, message: "Please retry." };
    focusQuoteFeedback(state.status, ref);
    const html = renderToStaticMarkup(<QuoteFeedback state={state} />);
    assert.match(html, /role="alert"/); assert.match(html, /aria-live="assertive"/); assert.match(html, /tabindex="-1"/);
  }
  assert.equal(count, 2);
  assert.match(readFileSync("components/customer/quote-actions.tsx", "utf8"), /\[state\.status, state\.sequence\]/);
});

test("transport failures preserve retry identity and become repeatable safe feedback", async () => {
  const previous = { ...idle, nextRequestId: other };
  const failure = async () => { throw new Error("PRIVATE TRANSPORT DETAILS"); };
  const first = await submitQuoteAction(failure, previous, new FormData());
  assert.deepEqual(first, { ...previous, status: "failure", sequence: 1,
    message: "We could not confirm this submission. Retry with the same details." });
  const second = await submitQuoteAction(failure, first, new FormData());
  assert.deepEqual(second, { ...first, sequence: 2 });
  assert.deepEqual(settleQuoteForm({ body: "Keep this request", consent: true }, second), { body: "Keep this request", consent: true });
});

const ids: WorkRequestIds = { start: id, complete: other, cancel: { no_longer_needed: id, duplicate: other, source_invalidated: id, other } };
const work: QuoteWorkItem = { eventId: id, quoteId: id, number: "TEST", versionNumber: 2, versionStatus: "accepted",
  kind: "acceptance_handoff", body: null, source: "customer", acceptanceId: id, dueAt: "2026-11-06T12:00:00.000000Z",
  taskId: id, taskStatus: "pending", canManage: true, canClaim: false };
test("staff controls use capabilities, closed reasons, original deadlines and honest handoff labels", () => {
  const html = renderToStaticMarkup(<CustomerWorkItem item={work} action={action} requestIds={ids} />);
  for (const text of ["Verified customer acceptance", "Prepare handoff", "Start", "Complete", "Cancel", "no_longer_needed", "source_invalidated", work.dueAt]) assert.ok(html.includes(text), text);
  assert.doesNotMatch(html, /TripReady|Opportunity Won/);
  const ops = renderToStaticMarkup(<CustomerWorkItem item={{ ...work, canManage: false }} action={action} requestIds={ids} />);
  assert.doesNotMatch(ops, /<form/);
  const intake = renderToStaticMarkup(<CustomerWorkItem item={{ ...work, taskId: null, taskStatus: null, canManage: false, canClaim: true, source: "staff", acceptanceId: null }} action={action} requestIds={ids} />);
  assert.match(intake, /Staff-recorded acceptance/); assert.match(intake, /Admin intake/); assert.match(intake, /Claim intake/);
  const terminal = renderToStaticMarkup(<CustomerWorkItem item={{ ...work, taskStatus: "completed" }} action={action} requestIds={ids} />);
  assert.doesNotMatch(terminal, /<form/);
  assert.equal(workCommand(ids, "completed", "other"), `completed:${other}`);
  assert.notEqual(workCommand(ids, "canceled", "duplicate"), workCommand(ids, "canceled", "no_longer_needed"));
});

test("server page wiring binds viewed quote facts and guards staff reads before rendering", () => {
  const customer = readFileSync("app/mis-viajes/cotizaciones/[id]/page.tsx", "utf8");
  assert.match(customer, /customerQuoteAction\.bind\(null, \{ quoteId: quote\.quoteId, versionId: version\.versionId, expectedLock: quote\.lockVersion/);
  assert.match(customer, /termsId: terms\?\.termsId/);
  assert.match(customer, /documentHash: version\.pdf\?\.sha256/);
  assert.ok(customer.includes('viewKey={`${quote.lockVersion}:${terms?.termsId}:${terms?.sha256}:${version.pdf?.sha256}`}'));
  assert.match(customer, /canAccept=\{version\.current && version\.canAccept && !!terms && !!version\.pdf && !result\.acceptance\}/);
  assert.match(customer, /Previous version \(read-only\)/);
  assert.match(customer, /Download proposal PDF/);
  assert.match(customer, /Published version history/);
  const staff = readFileSync("app/admin/(protected)/customer-quote-work/page.tsx", "utf8");
  assert.ok(staff.indexOf("await requireAdminRoute") < staff.indexOf("await readCustomerQuoteWork"));
  assert.match(staff, /requireAdminRoute\("\/admin\/customer-quote-work", \["admin", "asesor", "operaciones"\]\)/);
  assert.match(readFileSync("app/admin/(protected)/customer-quote-work/actions.ts", "utf8"), /Assignment refreshed\./);
});
