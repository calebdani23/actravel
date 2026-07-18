import assert from "node:assert/strict";
import test from "node:test";

import { buildMetaAttribution, buildMetaFbc, parseMetaAttributionSnapshot, readCookieValue, sanitizeMetaAttribution } from "@/lib/analytics/meta-attribution";

test("meta attribution captures first-touch UTM and fb cookies", () => {
  const now = new Date("2026-07-18T12:00:00.000Z");
  const attribution = buildMetaAttribution({
    pathname: "/es/destinos/riviera-maya",
    href: "https://www.actravel.com/es/destinos/riviera-maya?utm_source=instagram&utm_campaign=summer&fbclid=fb-click-1",
    referrer: "https://m.facebook.com/",
    searchParams: new URLSearchParams("utm_source=instagram&utm_campaign=summer&fbclid=fb-click-1"),
    cookie: "_fbp=fb.1.123.456; theme=dark",
    now,
  });

  assert.deepEqual(attribution, {
    capturedAt: "2026-07-18T12:00:00.000Z",
    landingPath: "/es/destinos/riviera-maya",
    landingUrl: "https://www.actravel.com/es/destinos/riviera-maya?utm_source=instagram&utm_campaign=summer&fbclid=fb-click-1",
    referrer: "https://m.facebook.com/",
    utmSource: "instagram",
    utmCampaign: "summer",
    fbclid: "fb-click-1",
    fbp: "fb.1.123.456",
    fbc: "fb.1.1784376000000.fb-click-1",
  });
});

test("meta attribution preserves first touch while backfilling missing fb cookies later", () => {
  const existing = sanitizeMetaAttribution({
    capturedAt: "2026-07-18T12:00:00.000Z",
    landingPath: "/es/promociones/verano-total",
    landingUrl: "https://www.actravel.com/es/promociones/verano-total?utm_source=instagram",
    utmSource: "instagram",
  });

  const attribution = buildMetaAttribution({
    pathname: "/es/cotizar",
    href: "https://www.actravel.com/es/cotizar",
    referrer: "https://www.actravel.com/es/promociones/verano-total",
    searchParams: new URLSearchParams(),
    cookie: "_fbp=fb.1.200.300; _fbc=fb.1.200.abc",
    existing,
  });

  assert.equal(attribution?.landingPath, "/es/promociones/verano-total");
  assert.equal(attribution?.utmSource, "instagram");
  assert.equal(attribution?.fbp, "fb.1.200.300");
  assert.equal(attribution?.fbc, "fb.1.200.abc");
});

test("meta attribution helpers sanitize snapshots safely", () => {
  assert.equal(readCookieValue("foo=bar; _fbp=fb.1.1.2", "_fbp"), "fb.1.1.2");
  assert.equal(buildMetaFbc("click-1", new Date("2026-07-18T12:00:00.000Z")), "fb.1.1784376000000.click-1");
  assert.equal(parseMetaAttributionSnapshot("{broken"), undefined);
  assert.deepEqual(parseMetaAttributionSnapshot(JSON.stringify({
    capturedAt: "2026-07-18T12:00:00.000Z",
    landingPath: "/en/quote",
    landingUrl: "https://www.actravel.com/en/quote",
    utmMedium: "paid_social",
  })), {
    capturedAt: "2026-07-18T12:00:00.000Z",
    landingPath: "/en/quote",
    landingUrl: "https://www.actravel.com/en/quote",
    utmMedium: "paid_social",
  });
});
