import assert from "node:assert/strict";
import test from "node:test";

import { buildAbandonmentSnapshot, buildDraftSnapshot, frictionFieldNames, mergeRecoveredDraft, QUOTE_FORM_RECOVERY_TTL_MS, quoteFormStorageKey, readStoredRecovery, safeStorageRemoveItem, safeStorageSetItem } from "@/lib/quote-form-recovery";
import type { QuoteRequestInput } from "@/lib/validations/quote-request";

const defaults: QuoteRequestInput = {
  locale: "es",
  preferredCurrency: "MXN",
  holderName: "",
  email: "",
  whatsapp: "",
  origin: "",
  mainDestination: "Cancún",
  departureDate: "2026-06-10",
  returnDate: "2026-06-15",
  adults: 2,
  children: 0,
  serviceInterest: "Hoteles",
  approximateBudget: 15000,
  sourceChannel: "Sitio web",
  contactConsent: false,
  notes: "",
  campaignContext: undefined,
  website: "",
};

test("quote form recovery keys stay locale-scoped", () => {
  assert.equal(quoteFormStorageKey("es", "draft"), "ac-travel:quote-form:es:draft");
  assert.equal(quoteFormStorageKey("en", "abandonment"), "ac-travel:quote-form:en:abandonment");
});

test("quote form recovery snapshots preserve useful draft and friction context", () => {
  const draft = buildDraftSnapshot(defaults);
  const abandonment = buildAbandonmentSnapshot(defaults, { email: { message: "required", type: "required" } }, { holderName: true, email: true, mainDestination: true });

  assert.equal(typeof draft.savedAt, "string");
  assert.deepEqual(frictionFieldNames({ email: { message: "required", type: "required" } }), ["email"]);
  assert.deepEqual(abandonment.dirtyFields, ["email", "holderName", "mainDestination"]);
  assert.deepEqual(abandonment.frictionFields, ["email"]);
});

test("quote form recovery merges stored draft without breaking guarded defaults", () => {
  const merged = mergeRecoveredDraft(defaults, {
    holderName: "María",
    preferredCurrency: "USD",
    adults: 4,
    website: "bot",
  });

  assert.equal(merged.holderName, "María");
  assert.equal(merged.preferredCurrency, "USD");
  assert.equal(merged.adults, 4);
  assert.equal(merged.website, "");
  assert.equal(merged.locale, "es");
});

test("quote form recovery keeps current entry context over stale draft values and blanks", () => {
  const merged = mergeRecoveredDraft({
    ...defaults,
    mainDestination: "Los Cabos",
    serviceInterest: "Tours",
    sourceChannel: "Newsletter",
    preferredCurrency: "USD",
    campaignContext: "summer-promo",
  }, {
    mainDestination: "   ",
    serviceInterest: "Hoteles",
    sourceChannel: "Website",
    preferredCurrency: "MXN",
    campaignContext: "old-campaign",
    notes: "  hola  ",
  }, { preferDefaultFields: ["mainDestination", "serviceInterest", "sourceChannel", "preferredCurrency", "campaignContext"] });

  assert.equal(merged.mainDestination, "Los Cabos");
  assert.equal(merged.serviceInterest, "Tours");
  assert.equal(merged.sourceChannel, "Newsletter");
  assert.equal(merged.preferredCurrency, "USD");
  assert.equal(merged.campaignContext, "summer-promo");
  assert.equal(merged.notes, "hola");
});

test("quote form recovery storage helpers tolerate failures and expire stale snapshots", () => {
  const removed: string[] = [];
  const storage = {
    values: new Map<string, string>(),
    getItem(key: string) {
      return this.values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      this.values.set(key, value);
    },
    removeItem(key: string) {
      removed.push(key);
      this.values.delete(key);
    },
  };

  assert.equal(safeStorageSetItem(storage, "draft", JSON.stringify({ savedAt: "2026-06-09T00:00:00.000Z", holderName: "Ada" })), true);
  assert.deepEqual(readStoredRecovery(storage, "draft", QUOTE_FORM_RECOVERY_TTL_MS.draft, Date.parse("2026-06-10T00:00:00.000Z")), { savedAt: "2026-06-09T00:00:00.000Z", holderName: "Ada" });

  storage.setItem("expired", JSON.stringify({ savedAt: "2026-05-01T00:00:00.000Z", holderName: "Old" }));
  assert.equal(readStoredRecovery(storage, "expired", QUOTE_FORM_RECOVERY_TTL_MS.abandonment, Date.parse("2026-06-10T00:00:00.000Z")), null);
  assert.deepEqual(removed, ["expired"]);

  const brokenStorage = {
    getItem() {
      throw new Error("denied");
    },
    setItem() {
      throw new Error("denied");
    },
    removeItem() {
      throw new Error("denied");
    },
  };

  assert.equal(safeStorageSetItem(brokenStorage, "x", "1"), false);
  assert.equal(safeStorageRemoveItem(brokenStorage, "x"), false);
  assert.equal(readStoredRecovery(brokenStorage, "x", QUOTE_FORM_RECOVERY_TTL_MS.draft), null);
});
