import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizePromotionCommercialSectionsValue,
  parsePromotionCommercialSectionsEditorValue,
  parsePromotionCommercialSectionsEditorValueOrThrow,
  PromotionCommercialSectionsValidationError,
  stringifyPromotionCommercialSectionsEditorValue,
} from "@/lib/promotion-commercial-sections";

test("promotion commercial sections normalize valid objects and trim values", () => {
  const normalized = normalizePromotionCommercialSectionsValue({
    offerFacts: [{ label: " Price ", value: " From $12,900 MXN ", emphasis: true }],
    includedList: [" Hotel ", " ", " Transfers "],
    restrictionsList: [" Subject to availability ", "   "],
    valueHighlights: [{ title: " Family friendly ", text: " Easy planning ", description: "ignored alias" }],
    ctaNote: " Share your dates on WhatsApp. ",
    ignored: true,
  });

  assert.deepEqual(normalized, {
    offerFacts: [{ label: "Price", value: "From $12,900 MXN", emphasis: true }],
    includedList: ["Hotel", "Transfers"],
    restrictionsList: ["Subject to availability"],
    valueHighlights: [{ title: "Family friendly", text: "Easy planning" }],
    ctaNote: "Share your dates on WhatsApp.",
  });
});

test("promotion commercial sections reject invalid roots and collapse empty content to null", () => {
  assert.equal(normalizePromotionCommercialSectionsValue("bad-root"), null);
  assert.equal(normalizePromotionCommercialSectionsValue([]), null);
  assert.equal(normalizePromotionCommercialSectionsValue({ offerFacts: [{ label: "", value: "" }] }), null);
});

test("promotion commercial sections parser reads supported Spanish groups and tolerates English aliases", () => {
  const parsed = parsePromotionCommercialSectionsEditorValue(`
[Datos de oferta]
Precio | Desde $12,900 MXN | destacado
Audiencia | Familias

[Incluye]
- Hotel
- Traslados aeropuerto

[Restrictions]
- Sujeto a disponibilidad

[Valor]
Ideal para familias | Cotización inicial fácil
Revisión humana | Impuestos finales validados

[Nota CTA]
Comparte tus fechas por WhatsApp.

[Unknown]
Ignored section
`);

  assert.deepEqual(parsed, {
    offerFacts: [
      { label: "Precio", value: "Desde $12,900 MXN", emphasis: true },
      { label: "Audiencia", value: "Familias" },
    ],
    includedList: ["Hotel", "Traslados aeropuerto"],
    restrictionsList: ["Sujeto a disponibilidad"],
    valueHighlights: [
      { title: "Ideal para familias", text: "Cotización inicial fácil" },
      { title: "Revisión humana", text: "Impuestos finales validados" },
    ],
    ctaNote: "Comparte tus fechas por WhatsApp.",
  });
});

test("promotion commercial sections invalid non-empty editor input throws a Spanish validation error", () => {
  assert.throws(
    () => parsePromotionCommercialSectionsEditorValueOrThrow("Texto libre sin bloques válidos"),
    (error) => {
      assert.ok(error instanceof PromotionCommercialSectionsValidationError);
      assert.match(String(error.message), /Formato inválido en secciones comerciales/);
      assert.match(String(error.message), /Datos de oferta/);
      return true;
    },
  );
  assert.equal(parsePromotionCommercialSectionsEditorValueOrThrow("   \n  "), null);
});

test("promotion commercial sections stringify emits stable grouped editor text in Spanish", () => {
  const text = stringifyPromotionCommercialSectionsEditorValue({
    offerFacts: [{ label: "Precio", value: "Desde $12,900 MXN", emphasis: true }],
    includedList: ["Hotel"],
    restrictionsList: ["Sujeto a disponibilidad"],
    valueHighlights: [{ title: "Ideal para familias", text: "Cotización inicial fácil" }],
    ctaNote: "Comparte tus fechas por WhatsApp.",
  });

  assert.equal(text, `[Datos de oferta]\nPrecio | Desde $12,900 MXN | destacado\n\n[Incluye]\n- Hotel\n\n[Restricciones]\n- Sujeto a disponibilidad\n\n[Valor]\nIdeal para familias | Cotización inicial fácil\n\n[Nota CTA]\nComparte tus fechas por WhatsApp.`);
});
