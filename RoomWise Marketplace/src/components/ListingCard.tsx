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
      className="w-full h-full grid place-items-center text-muted-foreground/60 bg-muted/40"
    >
      <svg
        width="38"
        height="38"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M3 11.5 12 4l9 7.5" />
        <path d="M5 10v9h14v-9" />
        <path d="M10 19v-5h4v5" />
      </svg>
    </div>
  );
}

export function ListingCard({ listing, categoryName, compact }: Props) {
  const cover = listing.images?.find((i) => i.is_cover)?.url || listing.images?.[0]?.url || null;
  const locationLabel =
    [listing.area, listing.location].filter(Boolean).join(", ") || "Location TBC";
  const formattedRent = formatZAR(listing.rent_amount, listing.currency);

  const rawPhone = listing.contact_phone || "";
  const cleanPhone = rawPhone.replace(/\D/g, "").replace(/^0/, "27");
  const whatsappMessage = encodeURIComponent(
    `Hi! I saw your room listing "${listing.title}" in ${locationLabel} (${formattedRent}/pm) on RoomWise. Is it still available for viewing?`,
  );
  const whatsappUrl = cleanPhone ? `https://wa.me/${cleanPhone}?text=${whatsappMessage}` : null;

  return (
    <div className="group rounded-2xl overflow-hidden bg-card border border-border/80 hover:border-primary/60 hover:shadow-lg transition-all duration-200 flex flex-col justify-between">
      <div>
        <Link
          to="/listings/$id"
          params={{ id: listing.id }}
          className="block aspect-[16/10] bg-muted overflow-hidden relative"
        >
          {cover ? (
            <img
              src={cover}
              alt={listing.title}
              loading="lazy"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <Placeholder />
          )}

          <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5 max-w-[80%]">
            {isAvailableNow(listing.available_date) ? (
              <Badge className="bg-emerald-600 text-white border-none shadow-sm text-xs font-medium">
                Available now
              </Badge>
            ) : listing.available_date ? (
              <Badge
                variant="secondary"
                className="bg-background/90 text-foreground backdrop-blur-sm text-xs"
              >
                From {formatDate(listing.available_date)}
              </Badge>
            ) : null}

            {listing.deposit_amount && Number(listing.deposit_amount) > 0 ? (
              <Badge
                variant="outline"
                className="bg-background/90 text-foreground backdrop-blur-sm text-[11px]"
              >
                Dep: {formatZAR(listing.deposit_amount, listing.currency)}
              </Badge>
            ) : (
              <Badge className="bg-amber-600 text-white border-none shadow-sm text-[11px]">
                No Deposit
              </Badge>
            )}
          </div>

          {listing.is_verified && (
            <Badge className="absolute top-2.5 right-2.5 bg-blue-600 text-white border-none text-[10px] tracking-wide uppercase">
              Verified
            </Badge>
          )}
        </Link>

        <div className="p-3.5 sm:p-4 space-y-2.5">
          <div className="flex items-baseline justify-between gap-2">
            <div>
              <span className="text-xl font-bold text-foreground tracking-tight">
                {formattedRent}
              </span>
              <span className="text-xs text-muted-foreground ml-1">/ month</span>
            </div>
            {categoryName && (
              <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                {categoryName}
              </span>
            )}
          </div>

          <Link to="/listings/$id" params={{ id: listing.id }} className="block">
            <h3 className="font-semibold text-base leading-snug text-foreground hover:text-primary transition-colors line-clamp-1">
              {listing.title}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 line-clamp-1">
              📍 {locationLabel}
            </p>
          </Link>

          {!compact && (
            <div className="flex flex-wrap gap-1.5 pt-1 text-[11px] text-muted-foreground">
              <span className="rounded-md border border-border bg-muted/40 px-2 py-0.5">
                {listing.is_furnished ? "Furnished" : "Unfurnished"}
              </span>
              {listing.utilities_included && (
                <span className="rounded-md border border-border bg-muted/40 px-2 py-0.5">
                  Water & Lights incl.
                </span>
              )}
              {listing.parking_available && (
                <span className="rounded-md border border-border bg-muted/40 px-2 py-0.5">
                  Secure Parking
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="p-3.5 sm:p-4 pt-0 mt-auto border-t border-border/50 space-y-2">
        <div className="flex gap-2 pt-2.5">
          {whatsappUrl ? (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white py-2 px-3 text-xs font-semibold shadow-sm transition-colors"
            >
              <span>WhatsApp</span>
            </a>
          ) : null}

          <Link
            to="/listings/$id"
            params={{ id: listing.id }}
            className="flex-1 inline-flex items-center justify-center rounded-xl border border-input bg-background hover:bg-accent hover:text-accent-foreground py-2 px-3 text-xs font-medium transition-colors"
          >
            Details
          </Link>
        </div>

        <p className="text-[10px] text-center text-muted-foreground/80">
          Never pay a viewing fee before inspecting the room.
        </p>
      </div>
    </div>
  );
}
