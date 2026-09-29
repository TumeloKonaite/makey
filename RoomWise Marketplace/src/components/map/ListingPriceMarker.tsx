import { formatMapPrice } from "./map-utils";

export function ListingPriceMarker({
  rent,
  selected = false,
}: {
  rent: string | number;
  selected?: boolean;
}) {
  return (
    <span
      className={`block whitespace-nowrap rounded-full border-2 px-2.5 py-1 text-xs font-bold shadow-md transition-transform ${selected ? "scale-110 border-primary bg-primary text-primary-foreground" : "border-background bg-card text-card-foreground"}`}
    >
      {formatMapPrice(rent)}
    </span>
  );
}
