import { describe, expect, it } from "vitest";
import {
  boundsFromSearch,
  boundsMeaningfullyChanged,
  listingQueryKey,
  parseListingsSearch,
} from "./listing-search";
const bounds = { south: -26.25, west: 27.95, north: -26.1, east: 28.15 };
describe("listing search state", () => {
  it("changes its query key with filters", () => {
    expect(listingQueryKey({ q: "room", ...bounds })).not.toEqual(
      listingQueryKey({ q: "other", ...bounds }),
    );
  });
  it("round-trips meaningful URL state and discards invalid values", () => {
    const state = parseListingsSearch({
      q: "room",
      view: "map",
      minRent: "1500",
      lat: "-26.2",
      lng: "28.1",
      zoom: "12",
      south: "-26.25",
      west: "27.95",
      north: "-26.1",
      east: "28.15",
      furnished: "maybe",
    });
    expect(state).toMatchObject({
      q: "room",
      view: "map",
      minRent: 1500,
      lat: -26.2,
      lng: 28.1,
      zoom: 12,
    });
    expect(state.furnished).toBeUndefined();
    expect(boundsFromSearch(state)).toEqual(bounds);
  });
  it("requires all four bounds", () => {
    expect(boundsFromSearch(parseListingsSearch({ south: -26, west: 28 }))).toBeUndefined();
  });
  it("only prompts for meaningful viewport movement", () => {
    expect(boundsMeaningfullyChanged(bounds, { ...bounds, west: 27.949 })).toBe(false);
    expect(boundsMeaningfullyChanged(bounds, { ...bounds, west: 27.8 })).toBe(true);
  });
});
