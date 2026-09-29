import type { ListingSearchParams, MapBounds } from "@/types";

export const VIEWPORT_DEBOUNCE_MS = 400;

export function listingQueryKey(filters: ListingSearchParams, bounds?: MapBounds) {
  return ["listings", filters, bounds] as const;
}

export function scheduleViewportSearch(
  callback: (bounds: MapBounds) => void,
  bounds: MapBounds | undefined,
  delay = VIEWPORT_DEBOUNCE_MS,
) {
  const timer = globalThis.setTimeout(() => {
    if (bounds) callback(bounds);
  }, delay);
  return () => globalThis.clearTimeout(timer);
}
