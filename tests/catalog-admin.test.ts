import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { parseDetailSectionsEditorValue, stringifyDetailSectionsEditorValue } from "@/lib/catalog-detail-sections";
import { parsePromotionCommercialSectionsEditorValue, parsePromotionCommercialSectionsEditorValueOrThrow, stringifyPromotionCommercialSectionsEditorValue } from "@/lib/promotion-commercial-sections";
import { resolveCatalogWriteState, resolvePromotionServiceIds } from "@/lib/admin/catalog";
import { assertCatalogMutation, CatalogAdminActionError, buildCatalogAdminRedirectTarget, catalogActionSuccessMessage, sanitizeCatalogMutationPayload } from "@/lib/admin/catalog-actions";
import { buildCatalogMediaStoragePath, normalizeCatalogMediaValue, parseCatalogMediaStorageRef, validateCatalogMediaUploadFile } from "@/lib/catalog-media";

test("catalog status workflow preserves published items on save and keeps explicit transitions", () => {
  const current = { status: "published" as const, published_at: "2026-06-01T10:00:00.000Z" };
  const now = new Date("2026-06-09T12:00:00.000Z");

  assert.deepEqual(resolveCatalogWriteState(current, "save", now), current);
  assert.deepEqual(resolveCatalogWriteState(current, "draft", now), { status: "draft", published_at: null });
  assert.deepEqual(resolveCatalogWriteState(current, "archive", now), { status: "archived", published_at: current.published_at });
  assert.deepEqual(resolveCatalogWriteState(current, "publish", now), { status: "published", published_at: now.toISOString() });
  assert.deepEqual(resolveCatalogWriteState(null, "save", now), { status: "draft", published_at: null });
});

test("catalog media validation accepts absolute urls and normalized catalog-media refs", () => {
  assert.equal(normalizeCatalogMediaValue(" https://example.com/hero.jpg "), "https://example.com/hero.jpg");
  assert.equal(normalizeCatalogMediaValue("catalog-media/destinations/hero.jpg"), "storage://catalog-media/destinations/hero.jpg");
  assert.equal(normalizeCatalogMediaValue("destinations/legacy/hero.jpg", { allowLegacyRelativePath: true }), "storage://catalog-media/destinations/legacy/hero.jpg");
  assert.deepEqual(parseCatalogMediaStorageRef("storage://catalog-media/services/thumb.webp"), {
    bucket: "catalog-media",
    path: "services/thumb.webp",
    normalized: "storage://catalog-media/services/thumb.webp",
  });
  assert.throws(() => normalizeCatalogMediaValue("storage://documents/private.pdf"), /debe usar catalog-media/);
  assert.throws(() => normalizeCatalogMediaValue("nota-relativa.jpg"), /Media inválida/);
});

test("catalog media uploads validate image files and use normalized storage paths", () => {
  const file = new File(["img"], "Portada Cancún.JPG", { type: "image/jpeg" });
  assert.equal(validateCatalogMediaUploadFile(file).extension, "jpg");
  assert.equal(
    buildCatalogMediaStoragePath(file, { resource: "destinations", slot: "hero", slug: "Cancún Verano" }, new Date("2026-06-09T00:00:00Z"), "uuid-hero"),
    "destinations/hero/2026/06/uuid-hero-cancun-verano.jpg",
  );
  assert.throws(() => validateCatalogMediaUploadFile(new File(["bad"], "script.svg", { type: "image/svg+xml" })), /Tipo de imagen no permitido/);
});

test("catalog admin mutation guards confirm existing-item save/publish writes", () => {
  const saved = assertCatalogMutation(
    { data: { id: "dest-1", slug_es: "cancun", slug_en: "cancun" }, error: null },
    { resource: "destinations", action: "save", id: "dest-1" },
  );

  assert.equal(saved.id, "dest-1");
  assert.equal(catalogActionSuccessMessage("destinations", "save", true), "Destinos: cambios guardados.");
  assert.equal(catalogActionSuccessMessage("destinations", "publish", true), "Destinos: publicación actualizada correctamente.");
  assert.equal(
    buildCatalogAdminRedirectTarget("destinations", { status: "success", message: "ok", focusId: "dest-1" }),
    "/admin/catalog/destinations?status=success&message=ok&focus=dest-1",
  );
});

test("catalog admin mutation guards detect zero-row controlled failures", () => {
  assert.throws(
    () => assertCatalogMutation({ data: null, error: null }, { resource: "destinations", action: "publish", id: "missing-row" }),
    (error) => {
      assert.ok(error instanceof CatalogAdminActionError);
      assert.match(String(error.message), /No se pudo publicar el destino/);
      assert.match(String(error.message), /No se encontró el destino a editar/);
      return true;
    },
  );
});

test("catalog payload sanitizer strips helper-only fields for every resource", () => {
  assert.deepEqual(
    sanitizeCatalogMutationPayload("destinations", {
      name_es: "Cancún",
      slug_es: "cancun",
      hero_image_url: "storage://catalog-media/destinations/hero.jpg",
      detail_sections_es: [{ title: "Incluye", items: ["Hoteles"] }],
      uploads: [{ path: "destinations/hero.jpg" }],
      helper_only: true,
    }),
    {
      name_es: "Cancún",
      slug_es: "cancun",
      hero_image_url: "storage://catalog-media/destinations/hero.jpg",
      detail_sections_es: [{ title: "Incluye", items: ["Hoteles"] }],
    },
  );

  assert.deepEqual(
    sanitizeCatalogMutationPayload("services", {
      name_es: "Traslado",
      slug_es: "traslado",
      sort_order: 2,
      detail_sections_en: [{ title: "How we help", items: ["Airport pickup"] }],
      uploads: [{ path: "services/thumb.jpg" }],
    }),
    {
      name_es: "Traslado",
      slug_es: "traslado",
      sort_order: 2,
      detail_sections_en: [{ title: "How we help", items: ["Airport pickup"] }],
    },
  );

  assert.deepEqual(
    sanitizeCatalogMutationPayload("packages", {
      name_es: "Paquete",
      slug_es: "paquete",
      price_from_mxn: 12345,
      uploads: [{ path: "packages/hero.jpg" }],
    }),
    {
      name_es: "Paquete",
      slug_es: "paquete",
      price_from_mxn: 12345,
    },
  );

  assert.deepEqual(
    sanitizeCatalogMutationPayload("promotions", {
      title_es: "Promo",
      slug_es: "promo",
      destination_id: "dest-1",
      package_id: "pkg-1",
      commercial_sections_es: { offerFacts: [{ label: "Price", value: "From $12,900 MXN" }] },
      uploads: [{ path: "promotions/thumb.jpg" }],
    }),
    {
      title_es: "Promo",
      slug_es: "promo",
      destination_id: "dest-1",
      package_id: "pkg-1",
      commercial_sections_es: { offerFacts: [{ label: "Price", value: "From $12,900 MXN" }] },
    },
  );
});

test("promotion service ids merge legacy and join-table links without duplicates", () => {
  assert.deepEqual(resolvePromotionServiceIds({ service_id: "svc-1" }), ["svc-1"]);
  assert.deepEqual(resolvePromotionServiceIds({ service_id: "svc-1", promotion_services: [{ service_id: "svc-2" }, { service_id: "svc-1" }, { service_id: null }] }), ["svc-1", "svc-2"]);
  assert.deepEqual(resolvePromotionServiceIds({ promotion_services: [{ service_id: "svc-3" }, { service_id: "svc-3" }] }), ["svc-3"]);
});

test("detail sections editor parser keeps structured bullets and drops invalid rows", () => {
  const parsed = parseDetailSectionsEditorValue("[Qué resolvemos]\n- Hoteles\n- Tours\n\n[Cómo te ayudamos]\n- WhatsApp\nTexto libre\n- Seguimiento");

  assert.deepEqual(parsed, [
    { title: "Qué resolvemos", items: ["Hoteles", "Tours"] },
    { title: "Cómo te ayudamos", items: ["WhatsApp", "Seguimiento"] },
  ]);
  assert.equal(stringifyDetailSectionsEditorValue(parsed), "[Qué resolvemos]\n- Hoteles\n- Tours\n\n[Cómo te ayudamos]\n- WhatsApp\n- Seguimiento");
  assert.equal(parseDetailSectionsEditorValue("Texto libre sin bullets"), null);
});

test("promotion commercial editor parser keeps grouped structured sections", () => {
  const parsed = parsePromotionCommercialSectionsEditorValue("[Offer facts]\nPrice | From $12,900 MXN | emphasis\n\n[Included]\n- Hotel\n\n[Restrictions]\n- Subject to availability\n\n[Value highlights]\nFamily friendly | Easy planning\n\n[CTA note]\nShare your dates on WhatsApp.");

  assert.deepEqual(parsed, {
    offerFacts: [{ label: "Price", value: "From $12,900 MXN", emphasis: true }],
    includedList: ["Hotel"],
    restrictionsList: ["Subject to availability"],
    valueHighlights: [{ title: "Family friendly", text: "Easy planning" }],
    ctaNote: "Share your dates on WhatsApp.",
  });
  assert.equal(
    stringifyPromotionCommercialSectionsEditorValue(parsed),
    "[Datos de oferta]\nPrice | From $12,900 MXN | destacado\n\n[Incluye]\n- Hotel\n\n[Restricciones]\n- Subject to availability\n\n[Valor]\nFamily friendly | Easy planning\n\n[Nota CTA]\nShare your dates on WhatsApp.",
  );
});

test("promotion commercial editor strict parser rejects malformed non-empty text", () => {
  assert.throws(() => parsePromotionCommercialSectionsEditorValueOrThrow("texto libre"), /Formato inválido en secciones comerciales/);
  assert.equal(parsePromotionCommercialSectionsEditorValueOrThrow(""), null);
});

test("catalog admin UI exposes real media upload and explicit state actions", () => {
  const page = readFileSync("app/admin/(protected)/catalog/[resource]/page.tsx", "utf8");
  const actions = readFileSync("app/admin/(protected)/catalog/actions.ts", "utf8");
  const catalog = readFileSync("lib/admin/catalog.ts", "utf8");
  const detailSections = readFileSync("lib/catalog-detail-sections.ts", "utf8");
  const databaseTypes = readFileSync("lib/supabase/database.types.ts", "utf8");

  assert.match(page, /name=\{`\$\{name\}_file`\}/);
  assert.match(page, /name=\{`\$\{name\}_clear`\}/);
  assert.match(page, /CATALOG_MEDIA_ACCEPT/);
  assert.match(page, /Mover a borrador/);
  assert.match(page, /Archivar/);
  assert.match(page, /name="package_id"/);
  assert.match(page, /name="service_ids"/);
  assert.match(page, /multiple/);
  assert.match(page, /detail_sections_es_input/);
  assert.match(page, /detail_sections_en_input/);
  assert.match(page, /commercial_sections_es_input/);
  assert.match(page, /commercial_sections_en_input/);
  assert.match(page, /Secciones comerciales de promoción/);
  assert.match(page, /\[Datos de oferta\], \[Incluye\], \[Restricciones\], \[Valor\] y \[Nota CTA\]/);
  assert.match(page, /Formato: \[Título de sección\] y bullets con -/);
  assert.match(page, /searchParams/);
  assert.match(page, /feedbackMessage/);
  assert.match(databaseTypes, /detail_sections_es/);
  assert.match(databaseTypes, /detail_sections_en/);
  assert.match(databaseTypes, /commercial_sections_es/);
  assert.match(databaseTypes, /commercial_sections_en/);
  assert.match(catalog, /from\("promotions"\)\s*\.select\("\*, destinations\(id, name_es\)"\)/);
  assert.doesNotMatch(catalog, /select\("\*, destinations\(id, name_es\), services\(id, name_es\)"\)/);
  assert.match(catalog, /from\("promotion_services"\)\.select\("promotion_id, service_id, services\(id, name_es\)"\)/);
  assert.match(catalog, /\.in\("promotion_id", promotionIds\)/);
  assert.match(actions, /uploadCatalogMediaFile/);
  assert.match(actions, /normalizeCatalogMediaValue/);
  assert.match(actions, /parseDetailSectionsEditorValue/);
  assert.match(actions, /parsePromotionCommercialSectionsEditorValueOrThrow/);
  assert.match(actions, /detail_sections_es: parseDetailSectionsField\(formData, "detail_sections_es_input"\)/);
  assert.match(actions, /detail_sections_en: parseDetailSectionsField\(formData, "detail_sections_en_input"\)/);
  assert.match(actions, /commercial_sections_es: parsePromotionCommercialSectionsField\(formData, "commercial_sections_es_input"\)/);
  assert.match(actions, /commercial_sections_en: parsePromotionCommercialSectionsField\(formData, "commercial_sections_en_input"\)/);
  assert.match(actions, /allowLegacyRelativePath: true/);
  assert.match(actions, /sanitizeCatalogMutationPayload/);
  assert.match(actions, /media\.fields/);
  assert.match(actions, /syncPromotionServiceRelations/);
  assert.match(actions, /package_id: text\(formData, "package_id"\)/);
  assert.match(actions, /service_id: serviceIds\[0\] \?\? null/);
  assert.match(actions, /revalidatePromotionRelations/);
  assert.match(actions, /cleanupReplacedCatalogMedia/);
  assert.match(actions, /assertCatalogMutation/);
  assert.match(actions, /buildCatalogAdminRedirectTarget/);
  assert.match(actions, /deleted media cleanup failed/);
  assert.match(detailSections, /export type DetailSection = \{ title: string; items: string\[] \}/);
  assert.match(detailSections, /export function parseDetailSectionsEditorValue/);
});
