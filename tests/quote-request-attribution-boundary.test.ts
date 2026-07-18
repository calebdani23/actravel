import assert from "node:assert/strict";
import test from "node:test";

import { PUBLIC_QUOTE_CANONICAL_SOURCE, buildAdvisoryMarketingContext, buildTrustedQuoteAttribution } from "@/lib/leads/quote-request-service";
import type { QuoteRequestInput } from "@/lib/validations/quote-request";

const input: QuoteRequestInput = {
  locale: "es",
  preferredCurrency: "MXN",
  holderName: "Ada Lovelace",
  email: "ada@example.com",
  whatsapp: "+52 998 845 3455",
  origin: "Cancún",
  mainDestination: "Riviera Maya",
  departureDate: "2026-07-01",
  returnDate: "2026-07-07",
  adults: 2,
  children: 0,
  serviceInterest: "Paquete familiar",
  approximateBudget: 50000,
  sourceChannel: "Instagram DM",
  campaignContext: "summer-sale",
  attributionSnapshot: JSON.stringify({
    capturedAt: "2026-07-18T12:00:00.000Z",
    landingPath: "/es/promociones/verano-total",
    landingUrl: "https://evil.example/landing?utm_campaign=summer-sale",
    referrer: "https://evil.example/",
    utmSource: "instagram",
    fbp: "fb.1.fake",
    fbc: "fb.1.fake.click",
  }),
  metaLeadEventId: "quote_test_boundary_123",
  contactConsent: true,
  notes: "Please call first",
  website: "",
};

test("quote attribution keeps canonical source separate from advisory client marketing context", () => {
  process.env.NEXT_PUBLIC_SITE_URL = "https://www.actravel.com";

  assert.deepEqual(buildTrustedQuoteAttribution(input, { requestReferrer: "https://www.google.com/travel" }), {
    canonicalSource: PUBLIC_QUOTE_CANONICAL_SOURCE,
    quotePagePath: "/es/cotizar",
    quotePageUrl: "https://www.actravel.com/es/cotizar",
    requestReferrer: "https://www.google.com/travel",
  });

  assert.deepEqual(buildAdvisoryMarketingContext(input), {
    sourceChannel: "Instagram DM",
    campaignContext: "summer-sale",
    clientAttribution: {
      capturedAt: "2026-07-18T12:00:00.000Z",
      landingPath: "/es/promociones/verano-total",
      landingUrl: "https://evil.example/landing?utm_campaign=summer-sale",
      referrer: "https://evil.example/",
      utmSource: "instagram",
      fbp: "fb.1.fake",
      fbc: "fb.1.fake.click",
    },
  });
});
