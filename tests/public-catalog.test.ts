import assert from "node:assert/strict";
import test from "node:test";

import { resolveCatalogMediaUrl } from "@/lib/catalog-media";
import { buildPublicCatalogStaticParams } from "@/lib/content/public-catalog-utils";
import { buildPublicCatalogContent, buildPublicCatalogItem, buildPublicHomeContent, publishedCatalogRows } from "@/lib/content/public-site";

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
});

test("catalog media urls resolve storage paths and absolute urls", () => {
  assert.equal(resolveCatalogMediaUrl("https://example.com/image.jpg"), "https://example.com/image.jpg");
  assert.match(resolveCatalogMediaUrl("storage://catalog-media/items/hero.jpg", { baseUrl: "https://project.supabase.co" }) ?? "", /https:\/\/project\.supabase\.co\/storage\/v1\/object\/public\/catalog-media\/items\/hero\.jpg/);
  assert.equal(resolveCatalogMediaUrl("catalog-media/items/thumb.jpg", { baseUrl: "https://project.supabase.co" }), "https://project.supabase.co/storage/v1/object/public/catalog-media/items/thumb.jpg");
});

test("public catalog content returns only published rows and no demo fallback", () => {
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
  assert.deepEqual(fallback.destinations, []);
  assert.deepEqual(fallback.promotions, []);
  assert.deepEqual(fallback.packages, []);
});

test("packages catalog stays live-only and omits static demo entries", () => {
  const liveOnly = buildPublicCatalogContent("es", {
    packages: [
      { id: "pk-live", slug_es: "paquete-vivo", slug_en: "live-package", name_es: "Paquete vivo", name_en: "Live package", summary_es: "Resumen", summary_en: "Summary", description_es: "Descripción", description_en: "Description", status: "published" },
    ],
  });

  assert.deepEqual(liveOnly.packages.map((item) => item.id), ["pk-live"]);

  const empty = buildPublicCatalogContent("es", { packages: [] });
  assert.deepEqual(empty.packages, []);
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
    ],
    services: [
      { id: "s1", slug_es: "live-service", slug_en: "live-service", name_es: "Servicio en vivo", name_en: "Live service", summary_es: "Resumen servicio", summary_en: "Service summary", description_es: "Descripción servicio", description_en: "Service description", is_featured: true, status: "published" },
    ],
    packages: [
      { id: "pk1", slug_es: "live-package", slug_en: "live-package", name_es: "Paquete en vivo", name_en: "Live package", summary_es: "Resumen paquete", summary_en: "Package summary", description_es: "Descripción paquete", description_en: "Package description", is_featured: true, status: "published" },
    ],
    promotions: [
      { id: "p1", slug_es: "live-deal", slug_en: "live-deal", title_es: "Promoción en vivo", title_en: "Live deal", summary_es: "Resumen", summary_en: "Summary", details_es: "Detalles", details_en: "Details", is_featured: true, status: "published" },
    ],
  });

  const home = buildPublicHomeContent("es", live);

  assert.equal(home.destinations[0].id, "d1");
  assert.equal(home.promotions[0].id, "p1");
  assert.equal(home.services[0].id, "s1");
  assert.equal(home.packages[0].id, "pk1");

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
    services: [],
    promotions: [
      { id: "p1", slug_es: "live-deal", slug_en: "live-deal-en", title_es: "Promoción en vivo", title_en: "Live deal", summary_es: "Resumen", summary_en: "Summary", details_es: "Detalles", details_en: "Details", status: "published" },
    ],
  });

  assert.deepEqual(buildPublicCatalogStaticParams(content, "es", "destinations"), [{ locale: "es", slug: "live-dest" }]);
  assert.deepEqual(buildPublicCatalogStaticParams(content, "es", "promotions"), [{ locale: "es", slug: "live-deal" }]);
});
