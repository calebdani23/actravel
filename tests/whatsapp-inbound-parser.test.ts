import assert from "node:assert/strict";
import test from "node:test";

import { extractInboundMessages, matchesInboundTrigger, normalizeInboundTriggerText } from "@/lib/leads/whatsapp-inbound";

const payload = {
  object: "whatsapp_business_account",
  entry: [{
    id: "entry-1",
    changes: [{
      field: "messages",
      value: {
        metadata: { phone_number_id: "phone-123" },
        contacts: [{ wa_id: "5219988453455", profile: { name: "Ada Lovelace" } }],
        messages: [{
          id: "wamid-1",
          from: "5219988453455",
          type: "text",
          text: { body: "¡Hola! Quiero más información." },
          referral: { source_type: "facebook", headline: "Promo verano", ctwa_clid: "clid-1" },
        }],
      },
    }],
  }],
};

test("trigger normalization is accent and punctuation tolerant", () => {
  assert.equal(normalizeInboundTriggerText(" ¡Hola!   Quiero más información. "), "hola quiero mas informacion");
  assert.equal(matchesInboundTrigger("!Hola! Quiero mas informacion."), true);
  assert.equal(matchesInboundTrigger("Hola, quiero más información"), true);
});

test("extractInboundMessages pulls text, sender, profile and referral metadata", () => {
  const extracted = extractInboundMessages(payload, "phone-123", "2026-07-02T00:00:00.000Z");
  assert.equal(extracted.length, 1);
  assert.equal(extracted[0]?.metaMessageId, "wamid-1");
  assert.equal(extracted[0]?.profileName, "Ada Lovelace");
  assert.equal(extracted[0]?.fromPhone, "529988453455");
  assert.equal(extracted[0]?.messageText, "¡Hola! Quiero más información.");
  assert.equal(extracted[0]?.referral.headline, "Promo verano");
});

test("extractInboundMessages ignores wrong phone numbers", () => {
  assert.equal(extractInboundMessages(payload, "other-phone").length, 0);
});
