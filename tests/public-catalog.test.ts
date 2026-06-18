import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { resolveCatalogMediaUrl } from "@/lib/catalog-media";
import { buildLivePublicCatalogContent } from "@/lib/content/public-catalog";
import { buildPublicCatalogStaticParams } from "@/lib/content/public-catalog-utils";
import { buildFallbackCatalogContent, buildPublicCatalogContent, buildPublicCatalogItem, buildPublicHomeContent, getPublicSiteContent, mergeCatalogWithFallback, publishedCatalogRows, translateSlug } from "@/lib/content/public-site";
import { getLocalizedPath, resolveAlternateLocalizedPath } from "@/lib/i18n/public-routes";

function buildQueryResult(data: unknown, error: { message: string; code?: string } | null = null) {
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
  const destination = buildPublicCatalogItem({ id: "cancun", slug_es: "cancun", slug_en: "cancun", name_es: "Cancún", name_en: "Cancun", summary_es: "Resumen", summary_en: "Summary", description_es: "Descripción", description_en: "Description", hero_image_url: "https://example.com/hero.jpg", status: "published" }, "destinations");
  const promotion = buildPublicCatalogItem({ id: "deal-1", slug_es: "oferta", slug_en: "deal", title_es: "Oferta", title_en: "Deal", summary_es: "Resumen", summary_en: "Summary", details_es: "Detalles", details_en: "Details", thumbnail_image_url: "https://example.com/thumb.jpg", status: "published" }, "promotions");
  const storageMedia = buildPublicCatalogItem({ id: "svc-1", slug_es: "servicio", slug_en: "service", name_es: "Servicio", name_en: "Service", summary_es: "Resumen", summary_en: "Summary", description_es: "Descripción", description_en: "Description", hero_image_url: "catalog-media/services/hero.jpg", thumbnail_image_url: "storage://catalog-media/services/thumb.jpg", status: "published" }, "services");

  assert.equal(destination.media?.heroImageUrl, "https://example.com/hero.jpg");
  assert.equal(promotion.media?.thumbnailImageUrl, "https://example.com/thumb.jpg");
  assert.equal(storageMedia.media?.heroImageUrl, "catalog-media/services/hero.jpg");
  assert.equal(storageMedia.media?.thumbnailImageUrl, "catalog-media/services/thumb.jpg");
  assert.equal(promotion.description.es, "Detalles");
  assert.equal(promotion.media?.heroImageUrl, null);
});

test("catalog media urls resolve storage paths and absolute urls", () => {
  assert.equal(resolveCatalogMediaUrl("https://example.com/image.jpg"), "https://example.com/image.jpg");
  assert.match(resolveCatalogMediaUrl("storage://catalog-media/items/hero.jpg", { baseUrl: "https://project.supabase.co" }) ?? "", /https:\/\/project\.supabase\.co\/storage\/v1\/object\/public\/catalog-media\/items\/hero\.jpg/);
  assert.equal(resolveCatalogMediaUrl("catalog-media/items/thumb.jpg", { baseUrl: "https://project.supabase.co" }), "https://project.supabase.co/storage/v1/object/public/catalog-media/items/thumb.jpg");
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

test("fallback catalog exposes static sections when live rows are unavailable", () => {
  const fallback = buildFallbackCatalogContent("es");

  assert.equal(fallback.destinations.length > 0, true);
  assert.equal(fallback.promotions.length > 0, true);
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

test("localized package detail routes prefer live alternate slugs when available", () => {
  const liveAlternateHref = "https://actravel.test/en/packages/family-riviera";

  assert.equal(resolveAlternateLocalizedPath("en", liveAlternateHref), "/en/packages/family-riviera");
  assert.equal(getLocalizedPath("/es/paquetes/riviera-familiar", "en", liveAlternateHref), "/en/packages/family-riviera");
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

  assert.match(pageSource, /import \{ getPublicCatalogContent, getPublicCatalogItem \} from "@\/lib\/content\/public-catalog"/);
  assert.match(pageSource, /const catalog = await getPublicCatalogContent\(locale\);/);
  assert.match(pageSource, /const catalogKind = kind === "deal" \? "promotions" : kind === "package" \? "packages" : kind === "service" \? "services" : "destinations";/);
  assert.match(pageSource, /const item = await getPublicCatalogItem\(locale, catalogKind, slug\);/);
  assert.match(pageSource, /kind === "services" \? <CatalogItemGrid locale=\{locale\} items=\{serviceItems\} section="services" \/> : null/);
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

  assert.match(homeSource, /<CatalogItemGrid locale=\{locale\} items=\{content\.packages\.slice\(0, 3\)\} section="packages" \/>/);
  assert.match(homeSource, /<HomeServicesSection locale=\{locale\} items=\{content\.services\} \/>/);
  assert.match(homeSource, /<HomePromotionsSection locale=\{locale\} items=\{content\.promotions\} \/>/);
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
  assert.match(publicPagesSource, /return <CatalogItemGrid locale=\{locale\} items=\{items\} section="deals" \/>/);
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
