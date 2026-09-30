// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mapMock = vi.hoisted(() => ({
  shouldThrow: false,
  instances: [] as Array<{
    emit: (name: string, event?: unknown) => void;
    removed: boolean;
  }>,
}));

vi.mock("maplibre-gl", () => {
  class MockMap {
    handlers = new globalThis.Map<string, Array<(event?: unknown) => void>>();
    removed = false;
    constructor() {
      if (mapMock.shouldThrow) throw new Error("Map constructor failed");
      mapMock.instances.push(this);
    }
    on(name: string, layerOrHandler: string | ((event?: unknown) => void), handler?: () => void) {
      const callback = typeof layerOrHandler === "function" ? layerOrHandler : handler;
      if (callback) this.handlers.set(name, [...(this.handlers.get(name) ?? []), callback]);
      return this;
    }
    once() {
      return this;
    }
    emit(name: string, event: unknown = {}) {
      this.handlers.get(name)?.forEach((handler) => handler(event));
    }
    addControl() {}
    addSource() {}
    addLayer() {}
    getSource() {}
    getLayer() {}
    loaded() {
      return false;
    }
    isStyleLoaded() {
      return false;
    }
    getBounds() {
      return { getSouth: () => -34, getWest: () => 18, getNorth: () => -33, getEast: () => 19 };
    }
    getCenter() {
      return { lng: 18.5, lat: -33.5 };
    }
    getZoom() {
      return 10;
    }
    getCanvas() {
      return { style: {} };
    }
    remove() {
      this.removed = true;
    }
  }
  return {
    Map: MockMap,
    NavigationControl: class {},
    AttributionControl: class {},
    LngLatBounds: class {
      extend() {}
    },
  };
});

vi.mock("@/lib/lovable-error-reporting", () => ({ reportLovableError: vi.fn() }));

import { ListingsMap } from "./ListingsMap";
import { classifyMapError, sanitizeMapErrorMessage } from "./map-runtime";

describe("ListingsMap failures", () => {
  afterEach(cleanup);

  beforeEach(() => {
    mapMock.shouldThrow = false;
    mapMock.instances.length = 0;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => ({}) as never);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("shows an accessible fallback when initialization throws and retries", async () => {
    mapMock.shouldThrow = true;
    render(<ListingsMap listings={[]} className="h-96" />);

    expect((await screen.findByRole("alert")).textContent).toContain("Map temporarily unavailable");
    expect(screen.getByText(/still browse every room/i)).toBeTruthy();

    mapMock.shouldThrow = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry map" }));

    await waitFor(() => expect(mapMock.instances).toHaveLength(1));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("Loading map");
  });

  it("keeps loading after a recoverable MapLibre resource error", async () => {
    render(
      <div>
        <a href="/listings/example">Example room</a>
        <ListingsMap listings={[]} className="h-96" />
      </div>,
    );
    await waitFor(() => expect(mapMock.instances).toHaveLength(1));

    mapMock.instances[0].emit("error", { error: new Error("Could not load one vector tile") });

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("Loading map");

    mapMock.instances[0].emit("load");

    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
    expect(screen.queryByRole("alert")).toBeNull();
    expect(
      screen.getByRole<HTMLAnchorElement>("link", { name: "Example room" }).getAttribute("href"),
    ).toBe("/listings/example");
  });

  it.each([
    ["Failed to initialize WebGL", "webgl"],
    ["Worker was blocked while loading blob:", "worker"],
    ["Could not load sprite image", "sprite"],
    ["Glyph font request failed", "glyph"],
    ["vector tile source request failed", "tile"],
    ["style could not be loaded", "style"],
  ])("classifies %s as %s", (message, expected) => {
    expect(classifyMapError(message)).toBe(expected);
  });

  it("removes query strings and blob identifiers from diagnostics", () => {
    expect(
      sanitizeMapErrorMessage(
        "failed https://maps.example/tiles/1.pbf?token=secret and blob:https://app.example/private-id",
      ),
    ).toBe("failed https://maps.example/tiles/1.pbf and blob:[redacted]");
  });
});
