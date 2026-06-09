import assert from "node:assert/strict";
import test from "node:test";

import { absoluteUrl, getSiteUrl } from "@/lib/seo/public-seo";

function withSiteUrlEnv(value: string | undefined, run: () => void) {
  const previous = process.env.NEXT_PUBLIC_SITE_URL;

  if (value === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = value;

  try {
    run();
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = previous;
  }
}

test("site URL uses configured public origin when valid", () => {
  withSiteUrlEnv("https://actravel.example", () => {
    assert.equal(getSiteUrl().toString(), "https://actravel.example/");
    assert.equal(absoluteUrl("/es"), "https://actravel.example/es");
  });
});

test("site URL treats blank env values as missing", () => {
  withSiteUrlEnv("   ", () => {
    assert.equal(getSiteUrl().toString(), "http://localhost:3000/");
    assert.equal(absoluteUrl("/en"), "http://localhost:3000/en");
  });
});

test("site URL falls back safely when env value is malformed", () => {
  withSiteUrlEnv("not a valid url", () => {
    assert.equal(getSiteUrl().toString(), "http://localhost:3000/");
    assert.equal(absoluteUrl("/sitemap.xml"), "http://localhost:3000/sitemap.xml");
  });
});

test("site URL falls back when env protocol is unsafe", () => {
  withSiteUrlEnv("javascript:alert(1)", () => {
    assert.equal(getSiteUrl().toString(), "http://localhost:3000/");
  });
});
