import { afterEach, describe, expect, it, vi } from "vitest";
import { listingQueryKey, scheduleViewportSearch, VIEWPORT_DEBOUNCE_MS } from "./listing-search";

const bounds = { south: -26.25, west: 27.95, north: -26.1, east: 28.15 };
afterEach(() => vi.useRealTimers());

describe("listing search state", () => {
  it("changes its query key with filters and map bounds", () => {
    expect(listingQueryKey({ q: "room" }, bounds)).toEqual(["listings", { q: "room" }, bounds]);
    expect(listingQueryKey({ q: "other" }, bounds)).not.toEqual(
      listingQueryKey({ q: "room" }, bounds),
    );
  });

  it("debounces viewport requests and allows stale schedules to be cancelled", () => {
    vi.useFakeTimers();
    const callback = vi.fn();
    const cancel = scheduleViewportSearch(callback, bounds);
    vi.advanceTimersByTime(VIEWPORT_DEBOUNCE_MS - 1);
    expect(callback).not.toHaveBeenCalled();
    cancel();
    vi.advanceTimersByTime(1);
    expect(callback).not.toHaveBeenCalled();
    scheduleViewportSearch(callback, bounds);
    vi.advanceTimersByTime(VIEWPORT_DEBOUNCE_MS);
    expect(callback).toHaveBeenCalledWith(bounds);
  });
});
