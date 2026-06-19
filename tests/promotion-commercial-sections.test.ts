import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizePromotionCommercialSectionsValue,
  parsePromotionCommercialSectionsEditorValue,
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

test("promotion commercial sections parser reads all supported groups and ignores malformed lines", () => {
  const parsed = parsePromotionCommercialSectionsEditorValue(`
[Offer facts]
Price | From $12,900 MXN | emphasis
Audience | Families

[Included]
- Hotel stay
- Airport transfers

[Restrictions]
- Subject to availability

[Value highlights]
Family friendly | Easy first quote
Human review | Final taxes validated

[CTA note]
Share your dates on WhatsApp.

[Unknown]
Ignored section
`);

  assert.deepEqual(parsed, {
    offerFacts: [
      { label: "Price", value: "From $12,900 MXN", emphasis: true },
      { label: "Audience", value: "Families" },
    ],
    includedList: ["Hotel stay", "Airport transfers"],
    restrictionsList: ["Subject to availability"],
    valueHighlights: [
      { title: "Family friendly", text: "Easy first quote" },
      { title: "Human review", text: "Final taxes validated" },
    ],
    ctaNote: "Share your dates on WhatsApp.",
  });
});

test("promotion commercial sections stringify emits stable grouped editor text", () => {
  const text = stringifyPromotionCommercialSectionsEditorValue({
    offerFacts: [{ label: "Price", value: "From $12,900 MXN" }],
    includedList: ["Hotel stay"],
    restrictionsList: ["Subject to availability"],
    valueHighlights: [{ title: "Family friendly", text: "Easy first quote" }],
    ctaNote: "Share your dates on WhatsApp.",
  });

  assert.equal(text, `[Offer facts]\nPrice | From $12,900 MXN\n\n[Included]\n- Hotel stay\n\n[Restrictions]\n- Subject to availability\n\n[Value highlights]\nFamily friendly | Easy first quote\n\n[CTA note]\nShare your dates on WhatsApp.`);
});
