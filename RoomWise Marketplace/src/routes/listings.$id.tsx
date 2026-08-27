import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { Badge } from "@/components/ui/badge";
import { getCategories, getListing } from "@/lib/api";
import { formatZAR, formatDate, isAvailableNow } from "@/lib/format";
import { useState } from "react";

export const Route = createFileRoute("/listings/$id")({
  ssr: false,
  component: ListingDetail,
});

function ListingDetail() {
  const { id } = Route.useParams();
  const listingQ = useQuery({ queryKey: ["listing", id], queryFn: () => getListing(id) });
  const catsQ = useQuery({ queryKey: ["categories"], queryFn: getCategories });
  const [active, setActive] = useState(0);

  const listing = listingQ.data;
  const category = catsQ.data?.find((c) => c.id === listing?.category_id);

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full">
        <Link to="/listings" className="text-sm text-primary hover:underline">
          ← Back to listings
        </Link>

        {listingQ.isLoading && <p className="mt-8 text-muted-foreground">Loading room…</p>}
        {listingQ.isError && <p className="mt-8 text-destructive">Couldn't load this listing.</p>}

        {listing && (
          <div className="mt-6">
            <div className="space-y-6">
              <div className="rounded-3xl overflow-hidden bg-muted aspect-[4/3] relative">
                {listing.images.length > 0 ? (
                  <img
                    src={listing.images[active]?.url ?? listing.images[0].url}
                    alt={listing.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    No photos available
                  </div>
                )}
                {isAvailableNow(listing.available_date) && (
                  <Badge className="absolute top-4 left-4 bg-primary text-primary-foreground">
                    Available now
                  </Badge>
                )}
              </div>
              {listing.images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {listing.images.map((img, i) => (
                    <button
                      key={img.id}
                      onClick={() => setActive(i)}
                      className={`h-20 w-24 shrink-0 rounded-lg overflow-hidden border-2 ${
                        i === active ? "border-primary" : "border-transparent"
                      }`}
                    >
                      <img src={img.url} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}

              <div>
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  {category && <Badge variant="secondary">{category.name}</Badge>}
                  {listing.is_furnished && <Badge variant="secondary">Furnished</Badge>}
                  {listing.utilities_included && (
                    <Badge variant="secondary">Utilities included</Badge>
                  )}
                  {listing.parking_available && <Badge variant="secondary">Parking</Badge>}
                </div>
                <h1 className="font-serif text-4xl leading-tight">{listing.title}</h1>
                <p className="text-muted-foreground mt-2">
                  {[listing.area, listing.location].filter(Boolean).join(", ") || "Location TBC"}
                </p>
              </div>

              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 rounded-2xl border border-border bg-card p-5">
                <Stat
                  label="Monthly rent"
                  value={formatZAR(listing.rent_amount, listing.currency)}
                  highlight
                />
                <Stat label="Deposit" value={formatZAR(listing.deposit_amount, listing.currency)} />
                <Stat label="Agent fee" value={formatZAR(listing.agent_fee, listing.currency)} />
                <Stat label="Available" value={formatDate(listing.available_date)} />
                <Stat
                  label="Max occupants"
                  value={listing.max_occupants ? String(listing.max_occupants) : "—"}
                />
                <Stat label="Furnished" value={listing.is_furnished ? "Yes" : "No"} />
                <Stat
                  label="Utilities"
                  value={listing.utilities_included ? "Included" : "Excluded"}
                />
                <Stat label="Parking" value={listing.parking_available ? "Yes" : "No"} />
              </dl>

              {listing.description && (
                <div className="rounded-2xl border border-border bg-card p-6">
                  <h2 className="font-serif text-xl mb-2">About this room</h2>
                  <p className="whitespace-pre-line text-foreground/90 leading-relaxed">
                    {listing.description}
                  </p>
                </div>
              )}
              {listing.owner_name && (
                <p className="text-sm text-muted-foreground">Listed by {listing.owner_name}</p>
              )}
            </div>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</dt>
      <dd className={`mt-1 font-medium ${highlight ? "text-primary text-lg" : ""}`}>{value}</dd>
    </div>
  );
}
