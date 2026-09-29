import type { Listing } from "@/types";

export interface MappableListing {
  listing: Listing;
  longitude: number;
  latitude: number;
}

export function getMappableListings(listings: Listing[]): MappableListing[] {
  return listings.flatMap((listing) => {
    const latitude = Number(listing.latitude);
    const longitude = Number(listing.longitude);
    if (
      listing.latitude == null ||
      listing.longitude == null ||
      listing.latitude === "" ||
      listing.longitude === "" ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    )
      return [];
    return [{ listing, latitude, longitude }];
  });
}

export function formatMapPrice(value: string | number): string {
  const rent = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(rent)) return "Rent TBC";
  if (Math.abs(rent) >= 1000) {
    const compact = rent / 1000;
    return `R${compact.toFixed(Number.isInteger(compact) ? 0 : 1)}k`;
  }
  return `R${Math.round(rent)}`;
}
