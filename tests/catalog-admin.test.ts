import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { resolveCatalogWriteState } from "@/lib/admin/catalog";
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
      uploads: [{ path: "destinations/hero.jpg" }],
      helper_only: true,
    }),
    {
      name_es: "Cancún",
      slug_es: "cancun",
      hero_image_url: "storage://catalog-media/destinations/hero.jpg",
    },
  );

  assert.deepEqual(
    sanitizeCatalogMutationPayload("services", {
      name_es: "Traslado",
      slug_es: "traslado",
      sort_order: 2,
      uploads: [{ path: "services/thumb.jpg" }],
    }),
    {
      name_es: "Traslado",
      slug_es: "traslado",
      sort_order: 2,
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
      uploads: [{ path: "promotions/thumb.jpg" }],
    }),
    {
      title_es: "Promo",
      slug_es: "promo",
      destination_id: "dest-1",
    },
  );
});

test("catalog admin UI exposes real media upload and explicit state actions", () => {
  const page = readFileSync("app/admin/(protected)/catalog/[resource]/page.tsx", "utf8");
  const actions = readFileSync("app/admin/(protected)/catalog/actions.ts", "utf8");

  assert.match(page, /name=\{`\$\{name\}_file`\}/);
  assert.match(page, /name=\{`\$\{name\}_clear`\}/);
  assert.match(page, /CATALOG_MEDIA_ACCEPT/);
  assert.match(page, /Mover a borrador/);
  assert.match(page, /Archivar/);
  assert.match(page, /searchParams/);
  assert.match(page, /feedbackMessage/);
  assert.match(actions, /uploadCatalogMediaFile/);
  assert.match(actions, /normalizeCatalogMediaValue/);
  assert.match(actions, /allowLegacyRelativePath: true/);
  assert.match(actions, /sanitizeCatalogMutationPayload/);
  assert.match(actions, /media\.fields/);
  assert.match(actions, /cleanupReplacedCatalogMedia/);
  assert.match(actions, /assertCatalogMutation/);
  assert.match(actions, /buildCatalogAdminRedirectTarget/);
  assert.match(actions, /deleted media cleanup failed/);
});
