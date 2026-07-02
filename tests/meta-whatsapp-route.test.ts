import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import { setWhatsappInboundDependenciesForTests } from "@/lib/leads/whatsapp-inbound-service";

function signature(secret: string, body: string) {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

test("meta whatsapp route verifies GET challenge and rejects invalid signatures", async () => {
  process.env.META_WHATSAPP_VERIFY_TOKEN = "verify-token";
  process.env.META_APP_SECRET = "app-secret";
  process.env.META_WHATSAPP_PHONE_NUMBER_ID = "phone-123";
  const route = await import("@/app/api/meta/whatsapp/route");

  const verified = await route.GET(new Request("https://example.com/api/meta/whatsapp?hub.mode=subscribe&hub.verify_token=verify-token&hub.challenge=123"));
  assert.equal(verified.status, 200);
  assert.equal(await verified.text(), "123");

  const denied = await route.POST(new Request("https://example.com/api/meta/whatsapp", { method: "POST", body: "{}" }));
  assert.equal(denied.status, 401);
});

test("meta whatsapp route accepts signed payloads", async () => {
  process.env.META_APP_SECRET = "app-secret";
  process.env.META_WHATSAPP_PHONE_NUMBER_ID = "phone-123";
  const rawBody = JSON.stringify({ object: "whatsapp_business_account", entry: [] });
  setWhatsappInboundDependenciesForTests({ createSupabaseClient: () => ({ from: () => ({}) }) as never });
  const route = await import("@/app/api/meta/whatsapp/route");

  const response = await route.POST(new Request("https://example.com/api/meta/whatsapp", {
    method: "POST",
    headers: { "x-hub-signature-256": signature("app-secret", rawBody) },
    body: rawBody,
  }));

  assert.equal(response.status, 200);
});

test.after(() => setWhatsappInboundDependenciesForTests(null));
