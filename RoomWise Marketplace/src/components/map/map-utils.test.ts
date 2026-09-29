import { describe, expect, it } from "vitest";
import type { Listing } from "@/types";
import { formatMapPrice, getMappableListings } from "./map-utils";

function listing(id: string, latitude?: string | null, longitude?: string | null): Listing {
  return {
    id,
    latitude,
    longitude,
    title: id,
    category_id: "rooms",
    price: "0",
    rent_amount: "2500",
    is_furnished: false,
    utilities_included: false,
    parking_available: false,
    currency: "ZAR",
    status: "published",
    images: [],
  };
}

describe("getMappableListings", () => {
  it("keeps valid coordinates and converts them to numbers", () => {
    expect(getMappableListings([listing("valid", "-26.2041", "28.0473")])).toMatchObject([
      { listing: { id: "valid" }, latitude: -26.2041, longitude: 28.0473 },
    ]);
  });

  it("ignores missing, invalid, and out-of-range coordinates", () => {
    const listings = [
      listing("missing"),
      listing("empty", "", ""),
      listing("invalid", "south", "east"),
      listing("latitude", "91", "28"),
      listing("longitude", "-26", "181"),
    ];
    expect(getMappableListings(listings)).toEqual([]);
  });
});

describe("formatMapPrice", () => {
  it.each([
    [2500, "R2.5k"],
    [3000, "R3k"],
    [950, "R950"],
    ["3250", "R3.3k"],
    ["not-a-number", "Rent TBC"],
  ])("formats %s as %s", (rent, expected) => {
    expect(formatMapPrice(rent)).toBe(expected);
  });
});
