import * as maplibregl from "maplibre-gl";
import { LngLatBounds } from "maplibre-gl";
import { useEffect, useMemo, useRef } from "react";
import type { Listing, MapBounds } from "@/types";
import { MAP_STYLE_URL } from "@/lib/env";
import { formatMapPrice, getMappableListings } from "./map-utils";

const SOURCE = "roomwise-listings";
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
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: styleUrl,
      center:
        initialCenter ?? (mappable[0] ? [mappable[0].longitude, mappable[0].latitude] : [24, -29]),
      zoom: initialZoom ?? (mappable[0] ? 11 : 5),
      attributionControl: false,
    });
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
    map.on("load", () => {
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
          "text-size": 12,
          "text-padding": 8,
          "text-allow-overlap": true,
        },
        paint: pricePaint(selectedListingId, highlightedListingId),
      });
      map.on("click", "listing-clusters", async (event) => {
        const feature = map.queryRenderedFeatures(event.point, { layers: ["listing-clusters"] })[0];
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
    });
    mapRef.current = map;
    return () => {
      mapRef.current = null;
      map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styleUrl]);
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
        className="absolute inset-0"
        role="application"
        aria-label={`Interactive map showing ${mappable.length} approximate room locations`}
      />
      <p className="sr-only">
        Map pins show approximate areas. Use the accessible listing results to browse every room.
      </p>
    </div>
  );
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
