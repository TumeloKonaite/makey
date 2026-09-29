import { createRoot, type Root } from "react-dom/client";
import * as maplibregl from "maplibre-gl";
import { LngLatBounds, type Marker } from "maplibre-gl";
import { useEffect, useMemo, useRef } from "react";
import type { Listing, MapBounds } from "@/types";
import { MAP_STYLE_URL } from "@/lib/env";
import { ListingMapPopup } from "./ListingMapPopup";
import { ListingPriceMarker } from "./ListingPriceMarker";
import { getMappableListings } from "./map-utils";

interface Props {
  listings: Listing[];
  selectedListingId?: string | null;
  onListingSelect?: (id: string) => void;
  onBoundsChange?: (bounds: MapBounds) => void;
  className?: string;
  styleUrl?: string;
}
interface RenderedMarker {
  id: string;
  rent: string | number;
  marker: Marker;
  markerRoot: Root;
  popupRoot: Root;
}

export function ListingsMap({
  listings,
  selectedListingId,
  onListingSelect,
  onBoundsChange,
  className = "",
  styleUrl = MAP_STYLE_URL,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<RenderedMarker[]>([]);
  const initialViewportSetRef = useRef(false);
  const mappable = useMemo(() => getMappableListings(listings), [listings]);

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: styleUrl,
      center: mappable[0] ? [mappable[0].longitude, mappable[0].latitude] : [24, -29],
      zoom: mappable[0] ? 11 : 5,
      attributionControl: false,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(
      new maplibregl.AttributionControl({
        compact: true,
        customAttribution:
          '<a href="https://www.openstreetmap.org/copyright" target="_blank">© OpenStreetMap contributors</a>',
      }),
    );
    mapRef.current = map;
    const reportBounds = () => {
      const bounds = map.getBounds();
      onBoundsChange?.({
        south: bounds.getSouth(),
        west: bounds.getWest(),
        north: bounds.getNorth(),
        east: bounds.getEast(),
      });
    };
    map.on("moveend", reportBounds);
    return () => {
      map.off("moveend", reportBounds);
      mapRef.current = null;
      initialViewportSetRef.current = false;
      map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styleUrl, onBoundsChange]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const rendered of markersRef.current) {
      rendered.marker.remove();
      rendered.markerRoot.unmount();
      rendered.popupRoot.unmount();
    }
    markersRef.current = mappable.map(({ listing, longitude, latitude }) => {
      const markerNode = document.createElement("button");
      markerNode.type = "button";
      markerNode.setAttribute(
        "aria-label",
        `Show ${listing.title}, ${listing.rent_amount} rand per month`,
      );
      markerNode.className =
        "rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";
      const markerRoot = createRoot(markerNode);
      markerRoot.render(<ListingPriceMarker rent={listing.rent_amount} selected={false} />);
      const popupNode = document.createElement("div");
      const popupRoot = createRoot(popupNode);
      popupRoot.render(<ListingMapPopup listing={listing} />);
      const popup = new maplibregl.Popup({ offset: 18, maxWidth: "240px" }).setDOMContent(
        popupNode,
      );
      const marker = new maplibregl.Marker({ element: markerNode, anchor: "bottom" })
        .setLngLat([longitude, latitude])
        .setPopup(popup)
        .addTo(map);
      const select = () => onListingSelect?.(listing.id);
      markerNode.addEventListener("click", select);
      markerNode.addEventListener("focus", select);
      return { id: listing.id, rent: listing.rent_amount, marker, markerRoot, popupRoot };
    });
    if (!initialViewportSetRef.current && mappable.length === 1) {
      map.easeTo({ center: [mappable[0].longitude, mappable[0].latitude], zoom: 13 });
      initialViewportSetRef.current = true;
    } else if (!initialViewportSetRef.current && mappable.length > 1) {
      const bounds = new LngLatBounds();
      mappable.forEach(({ longitude, latitude }) => bounds.extend([longitude, latitude]));
      map.fitBounds(bounds, { padding: 52, maxZoom: 14, duration: 0 });
      initialViewportSetRef.current = true;
    }
    return () => {
      for (const rendered of markersRef.current) {
        rendered.marker.remove();
        rendered.markerRoot.unmount();
        rendered.popupRoot.unmount();
      }
      markersRef.current = [];
    };
  }, [mappable, onListingSelect]);

  useEffect(() => {
    for (const rendered of markersRef.current) {
      rendered.markerRoot.render(
        <ListingPriceMarker rent={rendered.rent} selected={rendered.id === selectedListingId} />,
      );
    }
  }, [selectedListingId]);

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-border bg-muted ${className}`}
    >
      <div
        ref={containerRef}
        className="absolute inset-0"
        aria-label={`Map showing ${mappable.length} room locations`}
      />
    </div>
  );
}
