import assert from "node:assert/strict";
import test from "node:test";

import { resetPublicRateLimitFallbackForTests, setPublicRateLimitStoreForTests } from "@/lib/security/public-rate-limit";

const validQuotePayload = {
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
  website: "",
};

test("quote route returns 429 before persistence when limiter denies request", async () => {
  process.env.PUBLIC_RATE_LIMIT_QUOTE_REQUEST_MAX = "1";
  setPublicRateLimitStoreForTests({ increment: async () => 2 });
  const quoteRoute = await import("@/app/api/quote-request/route");

  const response = await quoteRoute.POST(new Request("https://example.com/api/quote-request", { method: "POST", body: JSON.stringify(validQuotePayload) }));
  const body = await response.json();
  assert.equal(response.status, 429);
  assert.equal(body.ok, false);
  assert.match(response.headers.get("retry-after") ?? "", /^\d+$/);
  resetPublicRateLimitFallbackForTests();
});

test("quote route rejects filled honeypot before limiter or persistence", async () => {
  let limiterCalls = 0;
  setPublicRateLimitStoreForTests({ increment: async () => { limiterCalls += 1; return 1; } });
  const quoteRoute = await import("@/app/api/quote-request/route");

  const response = await quoteRoute.POST(new Request("https://example.com/api/quote-request", { method: "POST", body: JSON.stringify({ ...validQuotePayload, website: "https://bot.example" }) }));
  assert.equal(response.status, 400);
  assert.equal(limiterCalls, 0);
  resetPublicRateLimitFallbackForTests();
});

test("whatsapp route still redirects while skipping tracking when limiter denies logging", async () => {
  process.env.PUBLIC_RATE_LIMIT_WHATSAPP_CLICK_MAX = "1";
  setPublicRateLimitStoreForTests({ increment: async () => 2 });
  const whatsappRoute = await import("@/app/api/whatsapp-click/route");

  const response = await whatsappRoute.GET(new Request("https://example.com/api/whatsapp-click?message=Hola&pagePath=/"));
  assert.equal(response.status, 302);
  assert.match(response.headers.get("location") ?? "", /^https:\/\/wa\.me\//);
  resetPublicRateLimitFallbackForTests();
});
