import assert from "node:assert/strict";
import test from "node:test";

import { appendAdminSearchParams, buildAdminSearchQueryString } from "@/lib/admin/navigation";
import { getVisibleAdminNavItems, isAdminRouteAllowed } from "@/components/admin/admin-nav";

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

test("Manager navigation is limited to the safe landing and account", () => {
  assert.deepEqual(getVisibleAdminNavItems(["manager"] as const).map((item) => item.href), ["/admin/dashboard", "/admin/account"]);
  assert.deepEqual(getVisibleAdminNavItems(["manager", "asesor"] as const).map((item) => item.href), ["/admin/dashboard", "/admin/logs", "/admin/leads", "/admin/quotes", "/admin/account"]);
  assert.equal(isAdminRouteAllowed(["manager"], "/admin/dashboard"), true);
  assert.equal(isAdminRouteAllowed(["manager"], "/admin/account"), true);
  assert.equal(isAdminRouteAllowed(["manager"], "/admin/staff"), false);
  assert.equal(isAdminRouteAllowed(["manager"], "/admin/leads/123"), false);
  assert.equal(isAdminRouteAllowed(["admin"], "/admin/staff"), true);
});

test("combined Manager and advisor retains advisor route access without Manager fallback", () => {
  assert.deepEqual(getVisibleAdminNavItems(["manager", "asesor"] as const).map((item) => item.href), [
    "/admin/dashboard",
    "/admin/logs",
    "/admin/leads",
    "/admin/quotes",
    "/admin/account",
  ]);
  assert.equal(isAdminRouteAllowed(["manager", "asesor"], "/admin/leads/123"), true);
  assert.equal(isAdminRouteAllowed(["manager", "asesor"], "/admin/staff"), true);
});

test("non-manager dashboard errors remain errors, while account is an allowed no-read route", () => {
  assert.equal(isAdminRouteAllowed(["manager"], "/admin/account"), true);
  assert.equal(isAdminRouteAllowed(["manager"], "/admin/quotes"), false);
});
