import type { ListingSearchParams, MapBounds } from "@/types";

export interface ListingsUrlState {
  q?: string;
  category?: string;
  city?: string;
  area?: string;
  minRent?: number;
  maxRent?: number;
  furnished?: "yes" | "no";
  availability?: "now" | "by";
  availableBy?: string;
  agentFee?: "none" | "has";
  sort?: "newest" | "price-asc" | "price-desc" | "available";
  view?: "list" | "map";
  lat?: number;
  lng?: number;
  zoom?: number;
  south?: number;
  west?: number;
  north?: number;
  east?: number;
}
const text = (value: unknown) => (typeof value === "string" && value.trim() ? value : undefined);
const number = (value: unknown, min: number, max: number) => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : undefined;
};
const choice = <T extends string>(value: unknown, choices: readonly T[]) =>
  typeof value === "string" && choices.includes(value as T) ? (value as T) : undefined;

export function parseListingsSearch(search: Record<string, unknown>): ListingsUrlState {
  const parsed: ListingsUrlState = {
    q: text(search.q),
    category: text(search.category),
    city: text(search.city),
    area: text(search.area),
    minRent: number(search.minRent, 0, 1_000_000),
    maxRent: number(search.maxRent, 0, 1_000_000),
    furnished: choice(search.furnished, ["yes", "no"]),
    availability: choice(search.availability, ["now", "by"]),
    availableBy: text(search.availableBy),
    agentFee: choice(search.agentFee, ["none", "has"]),
    sort: choice(search.sort, ["newest", "price-asc", "price-desc", "available"]),
    view: choice(search.view, ["list", "map"]),
    lat: number(search.lat, -90, 90),
    lng: number(search.lng, -180, 180),
    zoom: number(search.zoom, 0, 24),
    south: number(search.south, -90, 90),
    west: number(search.west, -180, 180),
    north: number(search.north, -90, 90),
    east: number(search.east, -180, 180),
  };
  if ([parsed.south, parsed.west, parsed.north, parsed.east].some((v) => v === undefined)) {
    delete parsed.south;
    delete parsed.west;
    delete parsed.north;
    delete parsed.east;
  }
  return Object.fromEntries(Object.entries(parsed).filter(([, value]) => value !== undefined));
}
export function boundsFromSearch(search: ListingsUrlState): MapBounds | undefined {
  if (
    search.south === undefined ||
    search.west === undefined ||
    search.north === undefined ||
    search.east === undefined
  )
    return undefined;
  return { south: search.south, west: search.west, north: search.north, east: search.east };
}
export function listingQueryKey(filters: ListingSearchParams) {
  return ["listings", filters] as const;
}
export function boundsMeaningfullyChanged(a?: MapBounds, b?: MapBounds, tolerance = 0.04) {
  if (!a || !b) return Boolean(a || b);
  const width = Math.max(Math.abs(a.east - a.west), 0.001);
  const height = Math.max(Math.abs(a.north - a.south), 0.001);
  return (
    Math.abs(a.west - b.west) / width > tolerance ||
    Math.abs(a.east - b.east) / width > tolerance ||
    Math.abs(a.south - b.south) / height > tolerance ||
    Math.abs(a.north - b.north) / height > tolerance
  );
}
