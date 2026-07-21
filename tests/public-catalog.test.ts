import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { normalizeDetailSectionsValue } from "@/lib/catalog-detail-sections";
import { parseCatalogDescriptionBlocks } from "@/lib/catalog-description-blocks";
import { getClientCurrencyPreference, syncClientCurrencyPreference } from "@/lib/currency/preference-client";
import { normalizeCurrencyPreference, parseCurrencyCookie, resolveCurrencyPreference } from "@/lib/currency/preference";
import { shouldSyncQuoteFormCurrency } from "@/lib/quote-form-currency-sync";
import { normalizePromotionCommercialSectionsValue } from "@/lib/promotion-commercial-sections";
import { resolveCatalogMediaUrl } from "@/lib/catalog-media";
import { buildLivePublicCatalogContent, buildPublicCatalogLogDetails } from "@/lib/content/public-catalog";
import { buildPublicCatalogStaticParams } from "@/lib/content/public-catalog-utils";
import { buildFallbackCatalogContent, buildPublicCatalogContent, buildPublicCatalogItem, buildPublicHomeContent, getPublicSiteContent, getRelatedPromotionItems, mergeCatalogWithFallback, priceLabel, publishedCatalogRows, translateSlug } from "@/lib/content/public-site";
import type { CatalogRowLike } from "@/lib/content/public-site";
import { buildDetailAlternatePaths, getLocalizedPath, resolveAlternateLocalizedPath } from "@/lib/i18n/public-routes";
import { buildQuotePageInitialContext } from "@/lib/quote-page-context";

function buildQueryResult(data: CatalogRowLike[] | null, error: { message: string; code?: string; details?: string; hint?: string } | null = null) {
  return { data, error };
}

test("published catalog rows exclude drafts and keep published ordering", () => {
  const rows = publishedCatalogRows([
    { id: "1", status: "draft", is_featured: true, published_at: "2026-01-01", sort_order: 2 },
    { id: "2", status: "published", is_featured: false, published_at: "2026-01-02", sort_order: 10 },
    { id: "3", status: "published", is_featured: true, published_at: "2026-01-03", sort_order: 1 },
  ]);

  assert.deepEqual(rows.map((row) => row.id), ["3", "2"]);
});

test("unpublished catalog rows stay hidden from public content", () => {
  const rows = publishedCatalogRows([
    { id: "1", status: "published", is_featured: false, published_at: "2026-01-01", sort_order: 1 },
    { id: "2", status: "draft", is_featured: false, published_at: null, sort_order: 2 },
    { id: "3", status: "draft", is_featured: false, published_at: "2026-01-03", sort_order: 3 },
  ]);

  assert.deepEqual(rows.map((row) => row.id), ["1"]);
});

test("public catalog items expose hero media fields and fallback text", () => {
  const destination = buildPublicCatalogItem({ id: "cancun", slug_es: "cancun", slug_en: "cancun", name_es: "Cancún", name_en: "Cancun", summary_es: "Resumen", summary_en: "Summary", description_es: "Descripción", description_en: "Description", hero_image_url: "https://example.com/hero.jpg", detail_sections_es: [{ title: "Incluye", items: ["Hoteles"] }], detail_sections_en: [{ title: "Includes", items: ["Hotels"] }], status: "published" }, "destinations");
  const promotion = buildPublicCatalogItem({ id: "deal-1", slug_es: "oferta", slug_en: "deal", title_es: "Oferta", title_en: "Deal", summary_es: "Resumen", summary_en: "Summary", details_es: "Detalles", details_en: "Details", thumbnail_image_url: "https://example.com/thumb.jpg", commercial_sections_es: { offerFacts: [{ label: "Precio", value: "Desde $12,900 MXN" }] }, commercial_sections_en: { offerFacts: [{ label: "Price", value: "From $750 USD" }] }, status: "published" }, "promotions");
  const storageMedia = buildPublicCatalogItem({ id: "svc-1", slug_es: "servicio", slug_en: "service", name_es: "Servicio", name_en: "Service", summary_es: "Resumen", summary_en: "Summary", description_es: "Descripción", description_en: "Description", hero_image_url: "catalog-media/services/hero.jpg", thumbnail_image_url: "storage://catalog-media/services/thumb.jpg", status: "published" }, "services");

  assert.equal(destination.media?.heroImageUrl, "https://example.com/hero.jpg");
  assert.deepEqual(destination.detailSections?.es, [{ title: "Incluye", items: ["Hoteles"] }]);
  assert.equal(promotion.media?.thumbnailImageUrl, "https://example.com/thumb.jpg");
  assert.equal(storageMedia.media?.heroImageUrl, "catalog-media/services/hero.jpg");
  assert.equal(storageMedia.media?.thumbnailImageUrl, "catalog-media/services/thumb.jpg");
  assert.equal(promotion.description.es, "Detalles");
  assert.equal(promotion.media?.heroImageUrl, null);
  assert.deepEqual(promotion.commercialSections?.es, { offerFacts: [{ label: "Precio", value: "Desde $12,900 MXN" }] });
  assert.equal(promotion.detailSections, undefined);
});

test("promotion commercial sections normalization rejects malformed content safely", () => {
  assert.deepEqual(normalizePromotionCommercialSectionsValue({ offerFacts: [{ label: "Precio", value: "Desde" }] }), {
    offerFacts: [{ label: "Precio", value: "Desde" }],
  });
  assert.equal(normalizePromotionCommercialSectionsValue({ offerFacts: "bad" }), null);
});

test("detail section normalization accepts safe arrays and rejects malformed content", () => {
  assert.deepEqual(normalizeDetailSectionsValue([{ title: "How we help", items: ["Airport pickup", "Check-in support"] }]), [{ title: "How we help", items: ["Airport pickup", "Check-in support"] }]);
  assert.equal(normalizeDetailSectionsValue([{ title: "Broken", items: [] }]), null);
  assert.equal(normalizeDetailSectionsValue("bad-json-shape"), null);
});

test("catalog description blocks keep paragraphs and list groups stable", () => {
  assert.deepEqual(parseCatalogDescriptionBlocks(""), []);
  assert.deepEqual(parseCatalogDescriptionBlocks("Primer párrafo.\nSigue la misma idea.\n\n- Punto uno\n- Punto dos\n\nCierre final."), [
    { type: "paragraph", text: "Primer párrafo. Sigue la misma idea." },
    { type: "list", items: ["Punto uno", "Punto dos"] },
    { type: "paragraph", text: "Cierre final." },
  ]);
  assert.deepEqual(parseCatalogDescriptionBlocks("- Uno\n- Dos\nTexto final"), [
    { type: "list", items: ["Uno", "Dos"] },
    { type: "paragraph", text: "Texto final" },
  ]);
});

test("catalog media urls resolve storage paths and absolute urls", () => {
  assert.equal(resolveCatalogMediaUrl("https://example.com/image.jpg"), "https://example.com/image.jpg");
  assert.match(resolveCatalogMediaUrl("storage://catalog-media/items/hero.jpg", { baseUrl: "https://project.supabase.co" }) ?? "", /https:\/\/project\.supabase\.co\/storage\/v1\/object\/public\/catalog-media\/items\/hero\.jpg/);
  assert.equal(resolveCatalogMediaUrl("catalog-media/items/thumb.jpg", { baseUrl: "https://project.supabase.co" }), "https://project.supabase.co/storage/v1/object/public/catalog-media/items/thumb.jpg");
});

test("currency helpers prefer valid cookie values and keep language copy independent", () => {
  assert.equal(parseCurrencyCookie("foo=bar; ac-travel-currency=USD"), "USD");
  assert.equal(parseCurrencyCookie("foo=bar; ac-travel-currency=oops"), undefined);
  assert.equal(normalizeCurrencyPreference("invalid"), "MXN");
  assert.deepEqual(resolveCurrencyPreference("USD", "MXN", "MXN"), {
    currency: "USD",
    cookieCurrency: "USD",
    storageCurrency: "USD",
  });
  assert.deepEqual(resolveCurrencyPreference(undefined, "USD", "MXN"), {
    currency: "USD",
    cookieCurrency: "USD",
    storageCurrency: "USD",
  });
  assert.equal(priceLabel("es", { type: "from", mxn: 12900, usd: 750 }, "USD"), "Desde $750");
  assert.equal(priceLabel("en", { type: "from", mxn: 12900, usd: 750 }, "MXN"), "From MX$12,900");
});

test("client currency sync rewrites divergent valid localStorage to cookie canonical value", () => {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;

  const storage = new Map<string, string>([["ac-travel-currency", "MXN"]]);
  let cookie = "ac-travel-currency=USD";

  const windowMock = {
    localStorage: {
      getItem(key: string) {
        return storage.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        storage.set(key, value);
      },
      removeItem(key: string) {
        storage.delete(key);
      },
    },
    dispatchEvent() {
      return true;
    },
    addEventListener() {},
    removeEventListener() {},
  } as unknown as Window & typeof globalThis;

  const documentMock = {
    get cookie() {
      return cookie;
    },
    set cookie(value: string) {
      cookie = value.split(";")[0] ?? value;
    },
  } as Document;

  Object.assign(globalThis, {
    window: windowMock,
    document: documentMock,
  });

  try {
    assert.equal(getClientCurrencyPreference("MXN"), "USD");

    syncClientCurrencyPreference("MXN");

    assert.equal(storage.get("ac-travel-currency"), "USD");
    assert.equal(cookie, "ac-travel-currency=USD");
  } finally {
    Object.assign(globalThis, {
      window: originalWindow,
      document: originalDocument,
    });
  }
});

test("quote form currency sync updates only when the field is still following global preference", () => {
  assert.equal(shouldSyncQuoteFormCurrency({ currentCurrency: "MXN", nextCurrency: "USD", lastSyncedCurrency: "MXN", isDirty: false }), true);
  assert.equal(shouldSyncQuoteFormCurrency({ currentCurrency: "MXN", nextCurrency: "USD", lastSyncedCurrency: "MXN", isDirty: true }), true);
  assert.equal(shouldSyncQuoteFormCurrency({ currentCurrency: "USD", nextCurrency: "MXN", lastSyncedCurrency: "MXN", isDirty: true }), false);
  assert.equal(shouldSyncQuoteFormCurrency({ currentCurrency: "USD", nextCurrency: "USD", lastSyncedCurrency: "MXN", isDirty: false }), false);
});

test("quote page context lets query currency override cookie fallback", () => {
  assert.deepEqual(buildQuotePageInitialContext({}, "USD"), {
    mainDestination: undefined,
    serviceInterest: undefined,
    sourceChannel: undefined,
    campaignContext: undefined,
    preferredCurrency: "USD",
  });

  assert.deepEqual(buildQuotePageInitialContext({ currency: "mxn", destination: " Cancún " }, "USD"), {
    mainDestination: "Cancún",
    serviceInterest: undefined,
    sourceChannel: undefined,
    campaignContext: undefined,
    preferredCurrency: "MXN",
  });

  assert.deepEqual(buildQuotePageInitialContext({ source: "instagram", utm_source: "paid-social", campaign: "summer-sale" }, "USD"), {
    mainDestination: undefined,
    serviceInterest: undefined,
    sourceChannel: undefined,
    campaignContext: "summer-sale",
    preferredCurrency: "USD",
  });
});

test("public catalog content returns only published rows and keeps live filtering", () => {
  const content = buildPublicCatalogContent("es", {
    destinations: [
      { id: "d1", slug_es: "pub-dest", slug_en: "pub-dest", name_es: "Destino publicado", name_en: "Published destination", summary_es: "Resumen", summary_en: "Summary", description_es: "Descripción", description_en: "Description", status: "published" },
      { id: "d2", slug_es: "draft-dest", slug_en: "draft-dest", name_es: "Borrador", name_en: "Draft", summary_es: "Resumen", summary_en: "Summary", description_es: "Descripción", description_en: "Description", status: "draft" },
    ],
    services: [],
    packages: [
      { id: "pk1", slug_es: "paquete", slug_en: "package", name_es: "Paquete", name_en: "Package", summary_es: "Resumen", summary_en: "Summary", description_es: "Descripción", description_en: "Description", status: "published" },
    ],
    promotions: [
      { id: "p1", slug_es: "pub-deal", slug_en: "pub-deal", title_es: "Oferta publicada", title_en: "Published deal", summary_es: "Resumen", summary_en: "Summary", details_es: "Detalles", details_en: "Details", status: "published" },
    ],
  });

  assert.equal(content.destinations.some((item) => item.id === "d1"), true);
  assert.equal(content.destinations.some((item) => item.id === "d2"), false);
  assert.equal(content.promotions.some((item) => item.id === "p1"), true);
  assert.equal(content.packages.some((item) => item.id === "pk1"), true);
  assert.deepEqual(content.services, []);

  const empty = buildPublicCatalogContent("es", { destinations: [], services: [], promotions: [] });
  assert.deepEqual(empty.destinations, []);
  assert.deepEqual(empty.services, []);
  assert.deepEqual(empty.packages, []);
  assert.deepEqual(empty.promotions, []);

  const fallback = buildPublicCatalogContent("en", null);
  assert.equal(fallback.destinations.length > 0, true);
  assert.equal(fallback.promotions.length > 0, true);
  assert.equal(fallback.packages.length > 0, true);
});

test("related promotions resolve from destination, package, and service links with legacy service fallback", () => {
  const catalog = buildPublicCatalogContent("es", {
    destinations: [
      { id: "dest-1", slug_es: "cancun", slug_en: "cancun", name_es: "Cancún", name_en: "Cancun", status: "published" },
    ],
    services: [
      { id: "svc-1", slug_es: "traslados", slug_en: "transfers", name_es: "Traslados", name_en: "Transfers", status: "published" },
      { id: "svc-2", slug_es: "tours", slug_en: "tours", name_es: "Tours", name_en: "Tours", status: "published" },
    ],
    packages: [
      { id: "pkg-1", slug_es: "escapada", slug_en: "escape", name_es: "Escapada", name_en: "Escape", status: "published" },
    ],
    promotions: [
      { id: "promo-dest", slug_es: "promo-dest", slug_en: "promo-dest", title_es: "Promo destino", title_en: "Destination promo", destination_id: "dest-1", service_ids: ["svc-2"], status: "published" },
      { id: "promo-pkg", slug_es: "promo-pkg", slug_en: "promo-pkg", title_es: "Promo paquete", title_en: "Package promo", package_id: "pkg-1", service_ids: ["svc-2"], status: "published" },
      { id: "promo-svc", slug_es: "promo-svc", slug_en: "promo-svc", title_es: "Promo servicio", title_en: "Service promo", service_id: "svc-1", status: "published" },
      { id: "promo-related", slug_es: "promo-related", slug_en: "promo-related", title_es: "Promo relacionada", title_en: "Related promo", destination_id: "dest-1", service_ids: ["svc-1"], status: "published" },
      { id: "promo-draft", slug_es: "promo-draft", slug_en: "promo-draft", title_es: "Promo borrador", title_en: "Draft promo", destination_id: "dest-1", service_ids: ["svc-1"], status: "draft" },
    ],
  });

  assert.deepEqual(getRelatedPromotionItems(catalog, "destination", catalog.destinations[0]).map((item) => item.id), ["promo-dest", "promo-related"]);
  assert.deepEqual(getRelatedPromotionItems(catalog, "package", catalog.packages[0]).map((item) => item.id), ["promo-pkg"]);
  assert.deepEqual(getRelatedPromotionItems(catalog, "service", catalog.services[0]).map((item) => item.id), ["promo-svc", "promo-related"]);
  assert.deepEqual(getRelatedPromotionItems(catalog, "promotion", catalog.promotions.find((item) => item.id === "promo-svc")!).map((item) => item.id), ["promo-related"]);
});

test("fallback catalog exposes static sections when live rows are unavailable", () => {
  const fallback = buildFallbackCatalogContent("es");

  assert.equal(fallback.destinations.length > 0, true);
  assert.equal(fallback.promotions.length > 0, true);
  assert.ok(fallback.promotions[0]?.commercialSections?.es);
  assert.equal(fallback.services.length > 0, true);
  assert.equal(fallback.packages.length > 0, true);
});

test("mergeCatalogWithFallback keeps live rows and fills empty sections", () => {
  const merged = mergeCatalogWithFallback("es", buildPublicCatalogContent("es", {
    destinations: [
      { id: "d1", slug_es: "pub-dest", slug_en: "pub-dest", name_es: "Destino publicado", name_en: "Published destination", summary_es: "Resumen", summary_en: "Summary", description_es: "Descripción", description_en: "Description", status: "published" },
    ],
    services: [],
    packages: [],
    promotions: [],
  }));

  assert.equal(merged.destinations[0]?.id, "d1");
  assert.equal(merged.services.length > 0, true);
  assert.equal(merged.packages.length > 0, true);
  assert.equal(merged.promotions.length > 0, true);
});

test("packages catalog stays live when published rows exist", () => {
  const liveOnly = buildPublicCatalogContent("es", {
    packages: [
      { id: "pk-live", slug_es: "paquete-vivo", slug_en: "live-package", name_es: "Paquete vivo", name_en: "Live package", summary_es: "Resumen", summary_en: "Summary", description_es: "Descripción", description_en: "Description", status: "published" },
    ],
  });

  assert.deepEqual(liveOnly.packages.map((item) => item.id), ["pk-live"]);
});

test("package listing routes are available in both locales", () => {
  const esPath = "/es/paquetes";
  const enPath = "/en/packages";

  assert.equal(esPath, "/es/paquetes");
  assert.equal(enPath, "/en/packages");
});

test("home content prefers live published catalog items and returns empty on missing catalog", () => {
  const live = buildPublicCatalogContent("es", {
    destinations: [
      { id: "d1", slug_es: "live-dest", slug_en: "live-dest", name_es: "Destino en vivo", name_en: "Live destination", summary_es: "Resumen", summary_en: "Summary", description_es: "Descripción", description_en: "Description", is_featured: true, status: "published" },
      { id: "d2", slug_es: "extra-dest", slug_en: "extra-dest", name_es: "Destino extra", name_en: "Extra destination", summary_es: "Resumen extra", summary_en: "Extra summary", description_es: "Descripción extra", description_en: "Extra description", is_featured: false, status: "published" },
    ],
    services: [
      { id: "s1", slug_es: "live-service", slug_en: "live-service", name_es: "Servicio en vivo", name_en: "Live service", summary_es: "Resumen servicio", summary_en: "Service summary", description_es: "Descripción servicio", description_en: "Service description", is_featured: true, status: "published" },
      { id: "s2", slug_es: "second-service", slug_en: "second-service", name_es: "Servicio secundario", name_en: "Second service", summary_es: "Resumen secundario", summary_en: "Second summary", description_es: "Descripción secundaria", description_en: "Second description", is_featured: false, status: "published" },
    ],
    packages: [
      { id: "pk1", slug_es: "live-package", slug_en: "live-package", name_es: "Paquete en vivo", name_en: "Live package", summary_es: "Resumen paquete", summary_en: "Package summary", description_es: "Descripción paquete", description_en: "Package description", is_featured: true, status: "published" },
      { id: "pk2", slug_es: "backup-package", slug_en: "backup-package", name_es: "Paquete secundario", name_en: "Backup package", summary_es: "Resumen secundario", summary_en: "Backup summary", description_es: "Descripción secundaria", description_en: "Backup description", is_featured: false, status: "published" },
    ],
    promotions: [
      { id: "p1", slug_es: "live-deal", slug_en: "live-deal", title_es: "Promoción en vivo", title_en: "Live deal", summary_es: "Resumen", summary_en: "Summary", details_es: "Detalles", details_en: "Details", is_featured: true, status: "published" },
      { id: "p2", slug_es: "extra-deal", slug_en: "extra-deal", title_es: "Promoción extra", title_en: "Extra deal", summary_es: "Resumen extra", summary_en: "Extra summary", details_es: "Detalles extra", details_en: "Extra details", is_featured: false, status: "published" },
    ],
  });

  const home = buildPublicHomeContent("es", live);

  assert.deepEqual(home.destinations.map((item) => item.id), ["d1"]);
  assert.deepEqual(home.promotions.map((item) => item.id), ["p1", "p2"]);
  assert.deepEqual(home.packages.map((item) => item.id), ["pk1"]);
  assert.deepEqual(home.services.map((item) => item.id), ["s1", "s2"]);

  const fallback = buildPublicHomeContent("es", null);
  assert.deepEqual(fallback.destinations, []);
  assert.deepEqual(fallback.promotions, []);
  assert.deepEqual(fallback.packages, []);
  assert.deepEqual(fallback.services, []);
});

test("catalog static params follow the provided catalog content", () => {
  const content = buildPublicCatalogContent("es", {
    destinations: [
      { id: "d1", slug_es: "live-dest", slug_en: "live-dest-en", name_es: "Destino en vivo", name_en: "Live destination", summary_es: "Resumen", summary_en: "Summary", description_es: "Descripción", description_en: "Description", status: "published" },
    ],
    services: [
      { id: "s1", slug_es: "servicio-vivo", slug_en: "live-service", name_es: "Servicio en vivo", name_en: "Live service", summary_es: "Resumen servicio", summary_en: "Service summary", description_es: "Descripción servicio", description_en: "Service description", status: "published" },
    ],
    promotions: [
      { id: "p1", slug_es: "live-deal", slug_en: "live-deal-en", title_es: "Promoción en vivo", title_en: "Live deal", summary_es: "Resumen", summary_en: "Summary", details_es: "Detalles", details_en: "Details", status: "published" },
    ],
  });

  assert.deepEqual(buildPublicCatalogStaticParams(content, "es", "destinations"), [{ locale: "es", slug: "live-dest" }]);
  assert.deepEqual(buildPublicCatalogStaticParams(content, "es", "services"), [{ locale: "es", slug: "servicio-vivo" }]);
  assert.deepEqual(buildPublicCatalogStaticParams(content, "es", "promotions"), [{ locale: "es", slug: "live-deal" }]);
  assert.deepEqual(buildPublicCatalogStaticParams(content, "es", "packages"), []);
});

test("package static params and slug translation support package detail routes", () => {
  const content = buildPublicCatalogContent("es", {
    destinations: [],
    services: [],
    packages: [
      { id: "pk1", slug_es: "paquete-playa", slug_en: "beach-package", name_es: "Paquete playa", name_en: "Beach package", summary_es: "Resumen", summary_en: "Summary", description_es: "Descripción", description_en: "Description", status: "published" },
    ],
    promotions: [],
  });

  assert.deepEqual(buildPublicCatalogStaticParams(content, "es", "packages"), [{ locale: "es", slug: "paquete-playa" }]);
  assert.equal(translateSlug(getPublicSiteContent("es").routes.packages, "es", "en", "paquete-1"), "package-1");
});

test("localized catalog detail routes prefer trusted live alternate slugs across sections", () => {
  const destinationAlternates = buildDetailAlternatePaths("destination", { es: "riviera-maya", en: "mayan-riviera" });
  const serviceAlternates = buildDetailAlternatePaths("service", { es: "traslado-privado", en: "private-transfer" });
  const packageAlternates = buildDetailAlternatePaths("package", { es: "riviera-familiar", en: "family-riviera" });
  const dealAlternates = buildDetailAlternatePaths("deal", { es: "verano-total", en: "summer-special" });

  assert.deepEqual(destinationAlternates, { es: "/es/destinos/riviera-maya", en: "/en/destinations/mayan-riviera" });
  assert.deepEqual(serviceAlternates, { es: "/es/servicios/traslado-privado", en: "/en/services/private-transfer" });
  assert.deepEqual(packageAlternates, { es: "/es/paquetes/riviera-familiar", en: "/en/packages/family-riviera" });
  assert.deepEqual(dealAlternates, { es: "/es/promociones/verano-total", en: "/en/deals/summer-special" });

  assert.equal(resolveAlternateLocalizedPath("en", packageAlternates.en), "/en/packages/family-riviera");
  assert.equal(getLocalizedPath(packageAlternates.es, "en", packageAlternates.en), "/en/packages/family-riviera");
  assert.equal(getLocalizedPath(packageAlternates.es, "en"), "/en/packages/riviera-familiar");
  assert.equal(getLocalizedPath(destinationAlternates.en, "es", destinationAlternates.es), "/es/destinos/riviera-maya");
  assert.equal(getLocalizedPath(serviceAlternates.es, "en", serviceAlternates.en), "/en/services/private-transfer");
  assert.equal(getLocalizedPath(dealAlternates.en, "es", dealAlternates.es), "/es/promociones/verano-total");
});

test("localized routes no longer depend on document alternates for language switching", () => {
  const switchSource = readFileSync("components/public/language-switch.tsx", "utf8");
  const providerSource = readFileSync("components/public/public-route-provider.tsx", "utf8");
  const detailSource = readFileSync("components/public/public-pages.tsx", "utf8");
  const routesSource = readFileSync("lib/i18n/public-routes.ts", "utf8");

  assert.match(switchSource, /href=\{getLocalizedPath\(pathname, option, alternatePaths\?\.\[option\]\)\}/);
  assert.doesNotMatch(switchSource, /document\.head/);
  assert.doesNotMatch(switchSource, /querySelector\(`link\[rel="alternate"\]\[hreflang=/);
  assert.match(detailSource, /const alternatePaths = buildDetailAlternatePaths\(kind, item\.slug\);/);
  assert.match(detailSource, /<PublicRouteAlternates alternatePaths=\{alternatePaths\} \/>/);
  assert.match(providerSource, /return \(\) => \{\s+setAlternatePaths\(null\);\s+\};/m);
  assert.doesNotMatch(routesSource, /function localizedAlternatePath/);
  assert.doesNotMatch(routesSource, /document\.head/);
});

test("public catalog detail pages render structured description blocks", () => {
  const detailSource = readFileSync("components/public/public-pages.tsx", "utf8");
  const helperSource = readFileSync("lib/catalog-description-blocks.ts", "utf8");

  assert.match(detailSource, /parseCatalogDescriptionBlocks/);
  assert.match(detailSource, /MetaPixelEventTracker eventName="ViewContent"/);
  assert.match(detailSource, /MetaPixelEventTracker eventName="InitiateCheckout"/);
  assert.match(detailSource, /function CatalogDescriptionContent/);
  assert.match(detailSource, /<CatalogDescriptionContent className="mt-5 grid gap-4 text-lg leading-8 text-muted-foreground" text=\{item\.description\[locale\]\} \/>/);
  assert.match(detailSource, /<CatalogDescriptionContent[\s\S]+text=\{kind === "package" \|\| kind === "service" \? item\.summary\[locale\] : item\.description\[locale\]\}/);
  assert.match(helperSource, /type: "paragraph"/);
  assert.match(helperSource, /type: "list"/);
  assert.match(helperSource, /^export function parseCatalogDescriptionBlocks/m);
});

test("catalog fallback is reused end-to-end when live loading fails", () => {
  const liveCatalog = buildLivePublicCatalogContent("es", {
    destinations: buildQueryResult([], { message: "backend unavailable", code: "500" }),
    services: buildQueryResult([], null),
    packages: buildQueryResult([], null),
    promotions: buildQueryResult([], null),
  });
  const catalog = liveCatalog ?? buildFallbackCatalogContent("es");
  const params = buildPublicCatalogStaticParams(catalog, "es", "destinations");
  const item = catalog.destinations.find((entry) => entry.slug.es === "cancun") ?? null;

  assert.equal(catalog.destinations.some((entry) => entry.slug.es === "cancun"), true);
  assert.equal(params.some((entry) => entry.slug === "cancun"), true);
  assert.equal(item?.id, "cancun");
});

test("public catalog query logging stays compact and excludes provider html or secrets", () => {
  const originalError = console.error;
  const calls: unknown[][] = [];
  console.error = (...args: unknown[]) => {
    calls.push(args);
  };

  try {
    const liveCatalog = buildLivePublicCatalogContent("es", {
      destinations: buildQueryResult([], {
        message: "<html><body>522 token=secret https://example.com/catalog?token=secret</body></html>",
        code: "522",
        details: "signedUrl=https://example.com/private?sig=abc123",
        hint: "password=hunter2",
      }),
      services: buildQueryResult([], null),
      packages: buildQueryResult([], null),
      promotions: buildQueryResult([], null),
    });

    const catalog = liveCatalog ?? buildFallbackCatalogContent("es");
    const logged = JSON.stringify(calls);

    assert.equal(liveCatalog, null);
    assert.equal(catalog.destinations.some((entry) => entry.slug.es === "cancun"), true);
    assert.equal(calls.length, 1);
    assert.match(logged, /Respuesta no disponible del servicio de catálogo/);
    assert.match(logged, /"code":"522"/);
    assert.doesNotMatch(logged, /<html|body>|token=secret|hunter2|signedUrl|https:\/\/example\.com\/catalog\?token=secret|abc123/i);
  } finally {
    console.error = originalError;
  }
});

test("public catalog fatal log details keep safe status and generic summary only", () => {
  const details = buildPublicCatalogLogDetails({
    message: "<html>Cloudflare 522</html>",
    stack: "Error: boom\n at secret.ts:1:1",
    status: 522,
    code: "cf_timeout",
    url: "https://example.com/private?token=secret",
  }, {
    summary: "No se pudo cargar el catálogo externo",
  });

  const logged = JSON.stringify(details);

  assert.deepEqual(details, {
    code: "cf_timeout",
    status: 522,
    summary: "No se pudo cargar el catálogo externo",
  });
  assert.doesNotMatch(logged, /<html|Cloudflare 522|secret\.ts|token=secret|https:\/\/example\.com\/private/i);
});

test("successful live empty sections stay empty without demo backfill", () => {
  const catalog = buildLivePublicCatalogContent("es", {
    destinations: buildQueryResult([], null),
    services: buildQueryResult([], null),
    packages: buildQueryResult([], null),
    promotions: buildQueryResult([], null),
  });
  assert.ok(catalog);
  const params = buildPublicCatalogStaticParams(catalog, "es", "destinations");
  const item = catalog?.destinations.find((entry) => entry.slug.es === "cancun") ?? null;

  assert.deepEqual(catalog.destinations, []);
  assert.deepEqual(catalog.promotions, []);
  assert.deepEqual(catalog.services, []);
  assert.deepEqual(catalog.packages, []);
  assert.deepEqual(params, []);
  assert.equal(item, null);
});

test("public pages use the same resolved catalog helpers as SEO and static params", () => {
  const pageSource = readFileSync("components/public/public-pages.tsx", "utf8");
  const quoteFormSource = readFileSync("components/public/quote-form.tsx", "utf8");

  assert.match(pageSource, /import \{ getPublicCatalogContent, getPublicCatalogItem \} from "@\/lib\/content\/public-catalog"/);
  assert.match(quoteFormSource, /form\.register\("attributionSnapshot"\)/);
  assert.match(quoteFormSource, /form\.register\("metaLeadEventId"\)/);
  assert.match(quoteFormSource, /trackMetaPixelEvent\("Lead", \{ eventId: metaLeadEventId/);
  assert.match(pageSource, /const \[catalog, currency\] = await Promise\.all\(\[getPublicCatalogContent\(locale\), getServerCurrencyPreference\(\)\]\);/);
  assert.match(pageSource, /const catalogKind = kind === "deal" \? "promotions" : kind === "package" \? "packages" : kind === "service" \? "services" : "destinations";/);
  assert.match(pageSource, /const \[catalog, item, currency\] = await Promise\.all\(\[getPublicCatalogContent\(locale\), getPublicCatalogItem\(locale, catalogKind, slug\), getServerCurrencyPreference\(\)\]\);/);
  assert.match(pageSource, /const commercialSections = kind === "deal" \? item\.commercialSections\?\.\[locale\] \?\? null : null;/);
  assert.match(pageSource, /const detailSections = item\.detailSections\?\.\[locale\] \?\? null;/);
  assert.match(pageSource, /commercialSections \? \(/);
  assert.match(pageSource, /Detalles de la promoción/);
  assert.match(pageSource, /Promotion details/);
  assert.match(pageSource, /function isPromotionPriceFactLabel\(label: string\)/);
  assert.match(pageSource, /isPromotionPriceFactLabel\(fact\.label\)/);
  assert.match(pageSource, /<FormattedPrice locale=\{locale\} price=\{item\.price\} initialCurrency=\{currency\} \/>/);
  assert.match(pageSource, /valueHighlights/);
  assert.match(pageSource, /detailSections && detailSections\.length \?/);
  assert.match(pageSource, /section\.title \? <h3/);
  assert.match(pageSource, /kind === "services" \? <CatalogItemGrid locale=\{locale\} items=\{serviceItems\} section="services" initialCurrency=\{currency\} \/> : null/);
  assert.match(pageSource, /const relatedPromotions = getRelatedPromotionItems\(catalog, kind === "deal" \? "promotion" : kind, item\);/);
  assert.match(pageSource, /relatedPromotions\.length \? \(/);
  assert.match(pageSource, /section="deals"/);
  assert.match(pageSource, /imageUrl=\{item\.media\?\.thumbnailImageUrl \?\? item\.media\?\.heroImageUrl \?\? undefined\}/);
  assert.match(pageSource, /src=\{item\.media\?\.heroImageUrl \?\? item\.media\?\.thumbnailImageUrl \?\? ""\}/);
  assert.doesNotMatch(pageSource, /getLivePublicCatalogContent/);
});

test("home page and localized route config expose service, package, and promotions sections", () => {
  const homeSource = readFileSync("app/[locale]/page.tsx", "utf8");
  const routesSource = readFileSync("lib/i18n/public-routes.ts", "utf8");
  const servicesRouteSource = readFileSync("app/[locale]/services/[slug]/page.tsx", "utf8");
  const serviciosRouteSource = readFileSync("app/[locale]/servicios/[slug]/page.tsx", "utf8");
  const publicPagesSource = readFileSync("components/public/public-pages.tsx", "utf8");

  assert.match(homeSource, /<CatalogItemGrid locale=\{locale\} items=\{content\.packages\.slice\(0, 3\)\} section="packages" initialCurrency=\{currency\} \/>/);
  assert.match(homeSource, /<HomeServicesSection locale=\{locale\} items=\{content\.services\} initialCurrency=\{currency\} \/>/);
  assert.match(homeSource, /<HomePromotionsSection locale=\{locale\} items=\{content\.promotions\} initialCurrency=\{currency\} \/>/);
  assert.match(routesSource, /servicios: \{ title: "Servicios", description: .* allowsSlug: true \}/);
  assert.match(routesSource, /paquetes: \{ title: "Paquetes", description: .* allowsSlug: true \}/);
  assert.match(routesSource, /services: \{ title: "Services", description: .* allowsSlug: true \}/);
  assert.match(routesSource, /packages: \{ title: "Packages", description: .* allowsSlug: true \}/);
  assert.match(servicesRouteSource, /getPublicCatalogStaticParams\("en", "services"\)/);
  assert.match(serviciosRouteSource, /getPublicCatalogStaticParams\("es", "services"\)/);
  assert.match(servicesRouteSource, /buildDetailMetadata\(locale, "service", slug\)/);
  assert.match(serviciosRouteSource, /buildDetailMetadata\(locale, "service", slug\)/);
  assert.match(publicPagesSource, /export function HomePromotionsSection/);
  assert.match(publicPagesSource, /if \(items\.length <= 3\) \{/);
  assert.match(publicPagesSource, /return <CatalogItemGrid locale=\{locale\} items=\{items\} section="deals" initialCurrency=\{initialCurrency\} \/>/);
  assert.match(publicPagesSource, /section="deals"/);
});

test("shared item card keeps whole-card navigation with simplified branded layout", () => {
  const cardSource = readFileSync("components/public/item-card.tsx", "utf8");
  const ctaSpanMatches = cardSource.match(/>\{cta\}<\/span>/g) ?? [];

  assert.equal(ctaSpanMatches.length, 0);
  assert.equal(cardSource.includes("aria-label={`${cta}: ${title}`}"), true);
  assert.doesNotMatch(cardSource, /<button/);
  assert.match(cardSource, /min-h-\[30rem\] flex-col overflow-hidden rounded-\[2rem\] border border-\[var\(--ac-blue\)\]\/12 bg-white/);
  assert.match(cardSource, /relative aspect-\[4\/5\] overflow-hidden bg-\[linear-gradient\(145deg,var\(--ac-blue-soft\)_0%,#ffffff_52%,#fff1e8_100%\)\]/);
  assert.match(cardSource, /group-hover:scale-\[1\.04\] group-focus-visible:scale-\[1\.04\]/);
  assert.match(cardSource, /rounded-full border border-\[#c94a1f\]\/18 bg-white\/92 px-3 py-1\.5 text-xs font-black text-\[#c94a1f\]/);
  assert.match(cardSource, /rounded-full border border-white\/70 bg-white\/88 text-\[#c94a1f\]/);
  assert.match(cardSource, /bg-\[linear-gradient\(180deg,#ffffff_0%,#f7fcff_100%\)\] px-6 pb-7 pt-6/);
  assert.match(cardSource, /mb-4 h-1\.5 w-16 rounded-full bg-\[#c94a1f\]/);
  assert.doesNotMatch(cardSource, /border-t border-white\/10 pt-4/);
});
