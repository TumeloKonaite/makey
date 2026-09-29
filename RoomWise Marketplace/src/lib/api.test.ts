import { describe, expect, it } from "vitest";
import { buildListingSearchParams } from "./api";

describe("buildListingSearchParams", () => {
  it("omits absent values and maps typed names to backend query names", () => {
    const query = buildListingSearchParams({
      q: "  braamfontein ",
      minRent: 2000,
      maxRent: 5000,
      furnished: false,
      categoryId: "category-id",
      availableBy: "2026-10-01",
      agentFee: "none",
      south: -26.25,
      west: 27.95,
      north: -26.1,
      east: 28.15,
    });
    expect(query.toString()).toBe(
      "q=braamfontein&category_id=category-id&min_rent=2000&max_rent=5000&furnished=false&available_by=2026-10-01&agent_fee=none&south=-26.25&west=27.95&north=-26.1&east=28.15",
    );
    expect(query.has("city")).toBe(false);
  });
});
