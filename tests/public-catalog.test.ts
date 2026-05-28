import assert from "node:assert/strict";
import test from "node:test";

import { buildPublicCatalogItem, publishedCatalogRows } from "@/lib/content/public-site";

test("published catalog rows exclude drafts and keep published ordering", () => {
  const rows = publishedCatalogRows([
    { id: "1", status: "draft", is_featured: true, published_at: "2026-01-01", sort_order: 2 },
    { id: "2", status: "published", is_featured: false, published_at: "2026-01-02", sort_order: 10 },
    { id: "3", status: "published", is_featured: true, published_at: "2026-01-03", sort_order: 1 },
  ]);

  assert.deepEqual(rows.map((row) => row.id), ["3", "2"]);
});

test("public catalog items expose hero media fields and fallback text", () => {
  const destination = buildPublicCatalogItem({ id: "cancun", slug_es: "cancun", slug_en: "cancun", name_es: "Cancún", name_en: "Cancun", summary_es: "Resumen", summary_en: "Summary", description_es: "Descripción", description_en: "Description", hero_image_url: "https://example.com/hero.jpg", status: "published" }, "destinations");
  const promotion = buildPublicCatalogItem({ id: "deal-1", slug_es: "oferta", slug_en: "deal", title_es: "Oferta", title_en: "Deal", summary_es: "Resumen", summary_en: "Summary", details_es: "Detalles", details_en: "Details", thumbnail_image_url: "https://example.com/thumb.jpg", status: "published" }, "promotions");

  assert.equal(destination.media?.heroImageUrl, "https://example.com/hero.jpg");
  assert.equal(promotion.media?.thumbnailImageUrl, "https://example.com/thumb.jpg");
  assert.equal(promotion.description.es, "Detalles");
});
