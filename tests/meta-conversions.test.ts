import assert from "node:assert/strict";
import test from "node:test";

import { buildMetaLeadEventPayload, isMetaConversionsEnabled, sendMetaLeadEvent } from "@/lib/analytics/meta-conversions";
import type { QuoteRequestInput } from "@/lib/validations/quote-request";

const input: QuoteRequestInput = {
  locale: "en",
  preferredCurrency: "USD",
  holderName: "Ada Lovelace",
  email: "ada@example.com",
  whatsapp: "+1 555 100 2000",
  origin: "Cancun",
  mainDestination: "Riviera Maya",
  departureDate: "2026-07-01",
  returnDate: "2026-07-07",
  adults: 2,
  children: 1,
  serviceInterest: "Family package",
  approximateBudget: 3500,
  sourceChannel: "website_quote",
  contactConsent: true,
  notes: "Need vegan options",
  attributionSnapshot: JSON.stringify({
    capturedAt: "2026-07-18T12:00:00.000Z",
    landingPath: "/en/deals/summer-special",
    landingUrl: "https://www.actravel.com/en/deals/summer-special?utm_campaign=summer",
    utmCampaign: "summer",
    fbp: "fb.1.123.456",
    fbc: "fb.1.123.click",
  }),
  metaLeadEventId: "quote_test_event_12345",
};

test("meta conversions payload includes dedup id, attribution, and hashed identifiers", () => {
  const payload = buildMetaLeadEventPayload(input, {
    createdAt: "2026-07-18T12:00:00.000Z",
    eventId: input.metaLeadEventId,
    eventSourceUrl: "https://www.actravel.com/en/quote",
    leadId: "lead-123",
    requestIp: "203.0.113.10",
    userAgent: "Mozilla/5.0",
  });

  const event = payload.data[0];
  assert.equal(event.event_name, "Lead");
  assert.equal(event.event_id, "quote_test_event_12345");
  assert.equal(event.event_source_url, "https://www.actravel.com/en/quote");
  assert.equal(event.user_data.client_ip_address, "203.0.113.10");
  assert.equal(event.user_data.client_user_agent, "Mozilla/5.0");
  assert.equal(event.user_data.fbp, undefined);
  assert.equal(event.user_data.fbc, undefined);
  assert.equal(event.custom_data.client_utm_campaign, "summer");
  assert.match(event.user_data.em ?? "", /^[a-f0-9]{64}$/);
  assert.match(event.user_data.ph ?? "", /^[a-f0-9]{64}$/);
  assert.match(event.user_data.external_id ?? "", /^[a-f0-9]{64}$/);
});

test("meta conversions safely skip when env gating is missing", async () => {
  delete process.env.NEXT_PUBLIC_META_PIXEL_ID;
  delete process.env.META_CONVERSIONS_API_ACCESS_TOKEN;
  assert.equal(isMetaConversionsEnabled(), false);

  const summary = await sendMetaLeadEvent(input, {
    createdAt: "2026-07-18T12:00:00.000Z",
    eventId: input.metaLeadEventId,
    leadId: "lead-123",
  });

  assert.equal(summary.status, "skipped");
});

test("meta conversions post to Graph API when env is configured", async () => {
  process.env.NEXT_PUBLIC_META_PIXEL_ID = "1929420407723543";
  process.env.META_CONVERSIONS_API_ACCESS_TOKEN = "meta-token";
  process.env.META_CONVERSIONS_TEST_EVENT_CODE = "TEST123";

  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; body: string }> = [];

  globalThis.fetch = (async (requestUrl, init) => {
    calls.push({ url: String(requestUrl), body: String(init?.body ?? "") });
    return new Response(JSON.stringify({ events_received: 1 }), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;

  try {
    const summary = await sendMetaLeadEvent(input, {
      createdAt: "2026-07-18T12:00:00.000Z",
      eventId: input.metaLeadEventId,
      leadId: "lead-123",
      requestIp: "203.0.113.10",
      userAgent: "Mozilla/5.0",
    });

    assert.equal(summary.status, "sent");
    assert.match(calls[0]?.url ?? "", /graph\.facebook\.com\/v23\.0\/1929420407723543\/events/);
    assert.match(calls[0]?.url ?? "", /test_event_code=TEST123/);
    assert.match(calls[0]?.body ?? "", /quote_test_event_12345/);
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.META_CONVERSIONS_TEST_EVENT_CODE;
  }
});
