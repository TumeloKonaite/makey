import { Link } from "@tanstack/react-router";
import { formatZAR } from "@/lib/format";
import type { Listing } from "@/types";

export function ListingMapPopup({ listing }: { listing: Listing }) {
  const cover = listing.images?.find((image) => image.is_cover)?.url ?? listing.images?.[0]?.url;
  const location = [listing.area, listing.city || listing.location].filter(Boolean).join(", ");
  return (
    <article className="w-56 overflow-hidden rounded-lg bg-background text-foreground">
      {cover && <img src={cover} alt="" className="h-24 w-full object-cover" />}
      <div className="space-y-1.5 p-3">
        <p className="font-semibold leading-tight">{listing.title}</p>
        <p className="text-sm font-bold text-primary">
          {formatZAR(listing.rent_amount, listing.currency)} / month
        </p>
        {location && <p className="text-xs text-muted-foreground">{location}</p>}
        <Link
          to="/listings/$id"
          params={{ id: listing.id }}
          className="inline-block pt-1 text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:underline"
        >
          View listing
        </Link>
      </div>
    </article>
  );
}
