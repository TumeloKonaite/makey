import * as maplibregl from "maplibre-gl";
import { LngLatBounds } from "maplibre-gl";
import mapLibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Listing, MapBounds } from "@/types";
import { MAP_STYLE_URL } from "@/lib/env";
import { reportLovableError } from "@/lib/lovable-error-reporting";
import { formatMapPrice, getMappableListings } from "./map-utils";
import {
  classifyMapError,
  normalizeMapStyle,
  sanitizeMapErrorMessage,
  type MapRuntimeDiagnostic,
} from "./map-runtime";

maplibregl.setWorkerUrl(mapLibreWorkerUrl);

const SOURCE = "roomwise-listings";
const STYLE_LOAD_TIMEOUT_MS = 15_000;
const BOOTSTRAP_STYLE: maplibregl.StyleSpecification = { version: 8, sources: {}, layers: [] };
type MapStatus = "loading" | "ready" | "error";
export interface MapViewport {
  center: [number, number];
  zoom: number;
  bounds: MapBounds;
}
interface Props {
  listings: Listing[];
  selectedListingId?: string | null;
  highlightedListingId?: string | null;
  onListingSelect?: (id: string) => void;
  onViewportChange?: (viewport: MapViewport) => void;
  initialCenter?: [number, number];
  initialZoom?: number;
  className?: string;
  styleUrl?: string;
}

export function ListingsMap({
  listings,
  selectedListingId,
  highlightedListingId,
  onListingSelect,
  onViewportChange,
  initialCenter,
  initialZoom,
  className = "",
  styleUrl = MAP_STYLE_URL,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const initialFit = useRef(false);
  const [status, setStatus] = useState<MapStatus>("loading");
  const [retryKey, setRetryKey] = useState(0);
  const handlers = useRef({ onListingSelect, onViewportChange });
  handlers.current = { onListingSelect, onViewportChange };
  const mappable = useMemo(() => getMappableListings(listings), [listings]);
  const geojson = useMemo<{
    type: "FeatureCollection";
    features: Array<{
      type: "Feature";
      geometry: { type: "Point"; coordinates: number[] };
      properties: { id: string; price: string; title: string };
    }>;
  }>(
    () => ({
      type: "FeatureCollection",
      features: mappable.map(({ listing, longitude, latitude }) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [longitude, latitude] },
        properties: {
          id: listing.id,
          price: formatMapPrice(listing.rent_amount),
          title: listing.title,
        },
      })),
    }),
    [mappable],
  );

  useEffect(() => {
    if (!containerRef.current) return;
    let removed = false;
    let didLoad = false;
    const webglAvailable = hasWebGLSupport();
    const fail = (diagnostic: MapRuntimeDiagnostic, error?: unknown) => {
      if (removed) return;
      reportMapFailure(diagnostic, error);
      setStatus("error");
    };

    setStatus("loading");
    initialFit.current = false;
    if (!webglAvailable) {
      fail({
        stage: "preflight",
        message: "WebGL is unavailable in this browser.",
        resourceType: "webgl",
        mapLoaded: false,
        styleLoaded: false,
        webglAvailable,
      });
      return;
    }

    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: BOOTSTRAP_STYLE,
        center:
          initialCenter ??
          (mappable[0] ? [mappable[0].longitude, mappable[0].latitude] : [24, -29]),
        zoom: initialZoom ?? (mappable[0] ? 11 : 5),
        attributionControl: false,
      });
    } catch (error) {
      fail(createDiagnostic("constructor", error, undefined, webglAvailable), error);
      return;
    }
    const onError = (event: maplibregl.ErrorEvent) => {
      const diagnostic = createDiagnostic("runtime", event.error, map, webglAvailable);
      if (diagnostic.resourceType === "worker" || diagnostic.resourceType === "webgl") {
        fail(diagnostic, event.error);
        return;
      }
      reportMapFailure(diagnostic, event.error);
      // MapLibre emits this event for individual tile, glyph, sprite, and other
      // recoverable resource failures. Keep waiting for the style's load event;
      // the style timeout handles failures that actually prevent rendering.
    };
    map.on("error", onError);
    const styleTimer = window.setTimeout(() => {
      if (!didLoad) {
        fail({
          stage: "style-timeout",
          message: "The map style did not finish loading.",
          resourceType: "style",
          mapLoaded: map.loaded(),
          styleLoaded: Boolean(map.isStyleLoaded()),
          webglAvailable,
        });
      }
    }, STYLE_LOAD_TIMEOUT_MS);
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(
      new maplibregl.AttributionControl({
        compact: true,
        customAttribution:
          '<a href="https://www.openstreetmap.org/copyright" target="_blank">© OpenStreetMap contributors</a>',
      }),
      "bottom-right",
    );
    const report = () => {
      const b = map.getBounds();
      handlers.current.onViewportChange?.({
        center: [map.getCenter().lng, map.getCenter().lat],
        zoom: map.getZoom(),
        bounds: { south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() },
      });
    };
    map.on("moveend", report);
    const initializeStyle = () => {
      // `style.load` fires as soon as the style is ready for custom sources and
      // layers. Waiting for `load` also waits for every initial tile, which can
      // leave the loading scrim covering an otherwise usable map on slow links.
      if (didLoad) return;
      didLoad = true;
      window.clearTimeout(styleTimer);
      try {
        map.addSource(SOURCE, {
          type: "geojson",
          data: geojson,
          cluster: true,
          clusterMaxZoom: 13,
          clusterRadius: 54,
        });
        map.addLayer({
          id: "listing-clusters",
          type: "circle",
          source: SOURCE,
          filter: ["has", "point_count"],
          paint: {
            "circle-color": "#173f35",
            "circle-radius": ["step", ["get", "point_count"], 20, 10, 25, 40, 32],
            "circle-stroke-color": "#fff",
            "circle-stroke-width": 3,
          },
        });
        map.addLayer({
          id: "listing-cluster-count",
          type: "symbol",
          source: SOURCE,
          filter: ["has", "point_count"],
          layout: {
            "text-field": ["concat", ["get", "point_count_abbreviated"], " rooms"],
            "text-font": ["Noto Sans Regular"],
            "text-size": 12,
          },
          paint: { "text-color": "#fff" },
        });
        map.addLayer({
          id: "listing-prices",
          type: "symbol",
          source: SOURCE,
          filter: ["!", ["has", "point_count"]],
          layout: {
            "text-field": ["get", "price"],
            "text-font": ["Noto Sans Regular"],
            "text-size": 12,
            "text-padding": 8,
            "text-allow-overlap": true,
          },
          paint: pricePaint(selectedListingId, highlightedListingId),
        });
        map.on("click", "listing-clusters", async (event) => {
          const feature = map.queryRenderedFeatures(event.point, {
            layers: ["listing-clusters"],
          })[0];
          const clusterId = feature?.properties?.cluster_id;
          if (clusterId == null) return;
          const zoom = await (
            map.getSource(SOURCE) as maplibregl.GeoJSONSource
          ).getClusterExpansionZoom(clusterId);
          map.easeTo({
            center: (feature.geometry as { coordinates: [number, number] }).coordinates,
            zoom,
          });
          window.dispatchEvent(
            new CustomEvent("roomwise:analytics", { detail: { event: "cluster_expanded" } }),
          );
        });
        map.on("click", "listing-prices", (event) => {
          const id = event.features?.[0]?.properties?.id;
          if (id) {
            handlers.current.onListingSelect?.(id);
            window.dispatchEvent(
              new CustomEvent("roomwise:analytics", {
                detail: { event: "marker_selected", listingId: id },
              }),
            );
          }
        });
        for (const layer of ["listing-clusters", "listing-prices"]) {
          map.on("mouseenter", layer, () => {
            map.getCanvas().style.cursor = "pointer";
          });
          map.on("mouseleave", layer, () => {
            map.getCanvas().style.cursor = "";
          });
        }
        report();
        setStatus("ready");
      } catch (error) {
        fail(createDiagnostic("layer-setup", error, map, webglAvailable), error);
      }
    };
    map.once("load", () => {
      map.on("style.load", initializeStyle);
      // Retain `load` as a fallback for styles/runtimes that do not emit the
      // MapLibre-specific `style.load` event.
      map.on("load", initializeStyle);
      map.setStyle(styleUrl, {
        transformStyle: (_previousStyle, nextStyle) => normalizeMapStyle(nextStyle),
      });
    });
    mapRef.current = map;
    return () => {
      removed = true;
      window.clearTimeout(styleTimer);
      mapRef.current = null;
      map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styleUrl, retryKey]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const update = () =>
      (map.getSource(SOURCE) as maplibregl.GeoJSONSource | undefined)?.setData(geojson);
    if (map.isStyleLoaded()) update();
    else map.once("load", update);
  }, [geojson]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getLayer("listing-prices")) return;
    const paint = pricePaint(selectedListingId, highlightedListingId);
    map.setLayoutProperty("listing-prices", "text-field", [
      "case",
      ["==", ["get", "id"], selectedListingId ?? ""],
      ["concat", "Selected · ", ["get", "price"]],
      ["get", "price"],
    ]);
    map.setPaintProperty("listing-prices", "text-color", paint["text-color"]);
    map.setPaintProperty("listing-prices", "text-halo-color", paint["text-halo-color"]);
  }, [selectedListingId, highlightedListingId]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || initialFit.current || initialCenter || !mappable.length) return;
    const fit = () => {
      const bounds = new LngLatBounds();
      mappable.forEach(({ longitude, latitude }) => bounds.extend([longitude, latitude]));
      map.fitBounds(bounds, { padding: 52, maxZoom: 14, duration: 0 });
      initialFit.current = true;
    };
    if (map.loaded()) fit();
    else map.once("load", fit);
  }, [mappable, initialCenter]);
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-border bg-muted ${className}`}
    >
      <div
        ref={containerRef}
        className={`absolute inset-0 ${status === "error" ? "invisible" : ""}`}
        role="application"
        aria-label={`Interactive map showing ${mappable.length} approximate room locations`}
        aria-hidden={status === "error"}
      />
      {status === "loading" && (
        <div
          className="pointer-events-none absolute inset-x-0 top-4 flex justify-center"
          role="status"
        >
          <p className="rounded-full border border-border bg-background/90 px-3 py-1.5 text-sm text-muted-foreground shadow-sm backdrop-blur-sm">
            Loading map…
          </p>
        </div>
      )}
      {status === "error" && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-muted p-6 text-center"
          role="alert"
        >
          <div className="max-w-sm">
            <p className="font-serif text-xl text-foreground">Map temporarily unavailable</p>
            <p className="mt-2 text-sm text-muted-foreground">
              You can still browse every room in the listing results.
            </p>
            <button
              type="button"
              className="mt-4 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => setRetryKey((value) => value + 1)}
            >
              Retry map
            </button>
          </div>
        </div>
      )}
      <p className="sr-only">
        Map pins show approximate areas. Use the accessible listing results to browse every room.
      </p>
    </div>
  );
}

function hasWebGLSupport(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return sanitizeMapErrorMessage(error.message);
  if (error && typeof error === "object" && "message" in error) {
    return sanitizeMapErrorMessage(String((error as { message: unknown }).message));
  }
  return "Unknown MapLibre error";
}

function createDiagnostic(
  stage: MapRuntimeDiagnostic["stage"],
  error: unknown,
  map: maplibregl.Map | undefined,
  webglAvailable: boolean,
): MapRuntimeDiagnostic {
  const message = errorMessage(error);
  return {
    stage,
    message,
    resourceType: classifyMapError(message),
    mapLoaded: map?.loaded() ?? false,
    styleLoaded: map?.isStyleLoaded() ?? false,
    webglAvailable,
  };
}

function reportMapFailure(diagnostic: MapRuntimeDiagnostic, error?: unknown) {
  const safeError = new Error(diagnostic.message, {
    cause: error instanceof Error ? error.name : undefined,
  });
  console.error("MapLibre runtime error", diagnostic, safeError);
  reportLovableError(safeError, { component: "ListingsMap", ...diagnostic });
}

function pricePaint(
  selected?: string | null,
  highlighted?: string | null,
): NonNullable<maplibregl.SymbolLayerSpecification["paint"]> {
  return {
    "text-color": ["case", ["==", ["get", "id"], selected ?? ""], "#fff", "#17211e"],
    "text-halo-color": [
      "case",
      ["==", ["get", "id"], selected ?? ""],
      "#173f35",
      ["==", ["get", "id"], highlighted ?? ""],
      "#d9a441",
      "#fff",
    ],
    "text-halo-width": 8,
  };
}
