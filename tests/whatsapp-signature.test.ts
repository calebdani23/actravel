import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import { verifyMetaSignature } from "@/lib/leads/whatsapp-inbound";

test("verifyMetaSignature accepts valid sha256 signatures", () => {
  const rawBody = JSON.stringify({ hello: "world" });
  const secret = "meta-secret";
  const digest = createHmac("sha256", secret).update(rawBody).digest("hex");

  assert.equal(verifyMetaSignature(rawBody, `sha256=${digest}`, secret), true);
});

test("verifyMetaSignature rejects missing, malformed, and wrong signatures", () => {
  assert.equal(verifyMetaSignature("{}", null, "secret"), false);
  assert.equal(verifyMetaSignature("{}", "sha256=oops", "secret"), false);
  assert.equal(verifyMetaSignature("{}", `sha256=${"a".repeat(64)}`, "different"), false);
});
