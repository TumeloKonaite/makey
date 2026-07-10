import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { formatZAR, formatDate, isAvailableNow } from "@/lib/format";
import type { Listing } from "@/types";

interface Props {
  listing: Listing;
  categoryName?: string;
  compact?: boolean;
}

function Placeholder() {
  return (
    <div
      aria-hidden
      className="w-full h-full grid place-items-center text-muted-foreground/70"
      style={{
        backgroundImage:
          "repeating-linear-gradient(135deg, oklch(0.9 0.03 72) 0 12px, oklch(0.92 0.025 78) 12px 24px)",
      }}
    >
      <svg
        width="42"
        height="42"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
      >
        <path d="M3 11.5 12 4l9 7.5" />
        <path d="M5 10v9h14v-9" />
        <path d="M10 19v-5h4v5" />
      </svg>
    </div>
  );
}

export function ListingCard({ listing, categoryName, compact }: Props) {
  const cover = listing.images.find((i) => i.is_cover)?.url || listing.images[0]?.url || null;

  return (
    <Link
      to="/listings/$id"
      params={{ id: listing.id }}
      className="group block rounded-2xl overflow-hidden bg-card border border-border/70 hover:border-primary/50 hover:shadow-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div
        className={`${compact ? "aspect-[16/10]" : "aspect-[4/3]"} bg-muted overflow-hidden relative`}
      >
        {cover ? (
          <img
            src={cover}
            alt={listing.title}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
          />
        ) : (
          <Placeholder />
        )}
        {listing.is_furnished && (
          <Badge className="absolute top-3 left-3 bg-background/90 text-foreground hover:bg-background border border-border">
            Furnished
          </Badge>
        )}
        {isAvailableNow(listing.available_date) && (
          <Badge className="absolute top-3 right-3 bg-primary text-primary-foreground">
            Available now
          </Badge>
        )}
      </div>
      <div className={`${compact ? "p-3.5" : "p-4"} space-y-2`}>
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-serif text-base sm:text-lg leading-tight text-foreground line-clamp-2">
            {listing.title}
          </h3>
          <div className="text-right shrink-0">
            <div className="text-primary font-semibold">
              {formatZAR(listing.rent_amount, listing.currency)}
            </div>
            <div className="text-[11px] text-muted-foreground -mt-0.5">/ month</div>
          </div>
        </div>
        <div className="text-sm text-muted-foreground">
          {[listing.area, listing.location].filter(Boolean).join(", ") || "Location TBC"}
        </div>
        {!compact && (
          <>
            <div className="flex flex-wrap gap-1.5 pt-2 text-xs">
              {categoryName && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-foreground/80">
                  {categoryName}
                </span>
              )}
              <span className="rounded-full bg-muted px-2 py-0.5 text-foreground/80">
                {listing.is_furnished ? "Furnished" : "Unfurnished"}
              </span>
              {listing.utilities_included && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-foreground/80">
                  Utilities incl.
                </span>
              )}
              {listing.parking_available && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-foreground/80">
                  Parking
                </span>
              )}
            </div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 pt-2 text-xs text-muted-foreground">
              <div>
                <dt className="uppercase tracking-wider text-[10px]">Available</dt>
                <dd className="text-foreground/90">
                  {isAvailableNow(listing.available_date)
                    ? "Now"
                    : listing.available_date
                      ? formatDate(listing.available_date)
                      : "—"}
                </dd>
              </div>
              <div>
                <dt className="uppercase tracking-wider text-[10px]">Deposit</dt>
                <dd className="text-foreground/90">
                  {listing.deposit_amount
                    ? formatZAR(listing.deposit_amount, listing.currency)
                    : "—"}
                </dd>
              </div>
              {listing.agent_fee && Number(listing.agent_fee) > 0 && (
                <div className="col-span-2">
                  <dt className="uppercase tracking-wider text-[10px]">Agent fee</dt>
                  <dd className="text-foreground/90">
                    {formatZAR(listing.agent_fee, listing.currency)}
                  </dd>
                </div>
              )}
            </dl>
            <div className="pt-2 text-sm text-primary font-medium group-hover:underline">
              View room →
            </div>
          </>
        )}
      </div>
    </Link>
  );
}
