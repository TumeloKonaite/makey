import test from "node:test";
import assert from "node:assert/strict";

import {
  buildListingPayload,
  getListingStatusMeta,
  renderPrimaryNav,
  resolveRouteAccess,
} from "./app.js";

test("dashboard routes redirect unauthenticated users to login", () => {
  const result = resolveRouteAccess("/dashboard/listings", false);

  assert.equal(result.type, "redirect");
  assert.equal(result.to, "/login?next=%2Fdashboard%2Flistings");
});

test("dashboard routes render for authenticated owners", () => {
  const result = resolveRouteAccess("/dashboard/listings/new", true);

  assert.equal(result.type, "render");
  assert.equal(result.route.name, "dashboard-new-listing");
});

test("listing payload maps room form values to the existing listing API shape", () => {
  const payload = buildListingPayload({
    category_id: "room-type-1",
    title: "Sunny room near UCT",
    description: "Large room with Wi-Fi included.",
    rent_amount: "5800.00",
    deposit_amount: "5800.00",
    agent_fee: "0.00",
    available_date: "2026-07-20",
    is_furnished: "true",
    utilities_included: "true",
    parking_available: "false",
    max_occupants: "1",
    area: "Rondebosch",
    currency: "ZAR",
    location: "Cape Town",
    status: "published",
  });

  assert.deepEqual(payload, {
    category_id: "room-type-1",
    title: "Sunny room near UCT",
    description: "Large room with Wi-Fi included.",
    price: "5800.00",
    rent_amount: "5800.00",
    deposit_amount: "5800.00",
    agent_fee: "0.00",
    available_date: "2026-07-20",
    is_furnished: true,
    utilities_included: true,
    parking_available: false,
    max_occupants: 1,
    area: "Rondebosch",
    currency: "ZAR",
    location: "Cape Town",
    status: "published",
  });
});

test("owner navigation uses rental terminology", () => {
  const nav = renderPrimaryNav({ token: "token-value" });

  assert.match(nav, /Owner dashboard/);
  assert.doesNotMatch(nav, /Provider dashboard/);
});

test("listing status labels match owner dashboard wording", () => {
  assert.deepEqual(getListingStatusMeta("draft"), {
    label: "Draft",
    tone: "draft",
  });
  assert.deepEqual(getListingStatusMeta("published"), {
    label: "Published",
    tone: "published",
  });
  assert.deepEqual(getListingStatusMeta("unpublished"), {
    label: "Unpublished",
    tone: "unpublished",
  });
});
