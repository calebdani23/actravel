import assert from "node:assert/strict";
import test from "node:test";

import { appendAdminSearchParams, buildAdminSearchQueryString } from "@/lib/admin/navigation";

test("admin navigation preserves current CRM query params without malformed separators", () => {
  assert.equal(
    buildAdminSearchQueryString({
      q: "cancun",
      status: "qualified",
      from: "2026-07-01",
      to: "2026-07-31",
      empty: "",
      missing: undefined,
    }),
    "?q=cancun&status=qualified&from=2026-07-01&to=2026-07-31",
  );

  assert.equal(
    appendAdminSearchParams("/admin/leads/lead-123", {
      q: "viaje familiar",
      advisor: "ada",
      channel: ["whatsapp", "website_quote"],
    }),
    "/admin/leads/lead-123?q=viaje+familiar&advisor=ada&channel=whatsapp&channel=website_quote",
  );
});

test("admin navigation leaves CRM links clean when there are no active params", () => {
  assert.equal(buildAdminSearchQueryString({}), "");
  assert.equal(appendAdminSearchParams("/admin/leads", {}), "/admin/leads");
});
