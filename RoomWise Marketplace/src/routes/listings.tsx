import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { ListingCard } from "@/components/ListingCard";
import { ListingsMap } from "@/components/map/ListingsMap";
import { QuickFilters, type FilterState } from "@/components/QuickFilters";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { getCategories, getListings } from "@/lib/api";
import type { ListingSearchParams, MapBounds } from "@/types";
import {
  boundsFromSearch,
  boundsMeaningfullyChanged,
  listingQueryKey,
  parseListingsSearch,
  type ListingsUrlState,
} from "@/lib/listing-search";
import type { MapViewport } from "@/components/map/ListingsMap";

export const Route = createFileRoute("/listings")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): ListingsUrlState =>
    parseListingsSearch(search),
  head: () => ({
    meta: [
      { title: "Rooms to rent — Marketplace Rooms" },
      {
        name: "description",
        content: "Browse rooms to rent in South Africa. Filter by city, suburb, rent and more.",
      },
    ],
  }),
  component: ListingsPage,
});

function ListingsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/listings" });
  const catsQ = useQuery({ queryKey: ["categories"], queryFn: getCategories });

  const [q, setQ] = useState(search.q ?? "");
  const [category, setCategory] = useState<string>(search.category || "all");
  const [city, setCity] = useState<string>(search.city || "all");
  const [area, setArea] = useState<string>(search.area || "all");
  const [minRent, setMinRent] = useState(search.minRent?.toString() ?? "");
  const [maxRent, setMaxRent] = useState(search.maxRent?.toString() ?? "");
  const [furnished, setFurnished] = useState<string>(search.furnished ?? "any");
  const [availability, setAvailability] = useState<string>(search.availability ?? "any");
  const [availableBy, setAvailableBy] = useState(search.availableBy ?? "");
  const [agentFee, setAgentFee] = useState<string>(search.agentFee ?? "any");
  const [sort, setSort] = useState<string>(search.sort ?? "newest");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mobileView, setMobileView] = useState<"list" | "map">(search.view ?? "list");
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const [quickFilters, setQuickFilters] = useState<FilterState>({
    category: "",
    priceRange: "",
    noDepositOnly: false,
    waterAndLights: false,
    parking: false,
  });
  const [mapBounds, setMapBounds] = useState<MapBounds | undefined>(() => boundsFromSearch(search));
  const [pendingViewport, setPendingViewport] = useState<MapViewport>();
  const [highlightedListingId, setHighlightedListingId] = useState<string | null>(null);

  const categories = useMemo(() => catsQ.data ?? [], [catsQ.data]);
  const filters = useMemo<ListingSearchParams>(() => {
    let quickMin: number | undefined;
    let quickMax: number | undefined;
    if (quickFilters.priceRange === "under-1500") quickMax = 1499.99;
    if (quickFilters.priceRange === "1500-2500") {
      quickMin = 1500;
      quickMax = 2500;
    }
    if (quickFilters.priceRange === "above-2500") quickMin = 2500.01;
    const enteredMin = minRent ? Number(minRent) : undefined;
    const enteredMax = maxRent ? Number(maxRent) : undefined;
    const categoryId =
      category !== "all"
        ? category
        : categories.find((item) => item.slug === quickFilters.category)?.id;
    return {
      q: q.trim() || undefined,
      categoryId,
      city: city !== "all" ? city : undefined,
      area: area !== "all" ? area : undefined,
      minRent: enteredMin === undefined ? quickMin : Math.max(enteredMin, quickMin ?? enteredMin),
      maxRent: enteredMax === undefined ? quickMax : Math.min(enteredMax, quickMax ?? enteredMax),
      furnished: furnished === "any" ? undefined : furnished === "yes",
      availableBy:
        availability === "now"
          ? new Date().toISOString().slice(0, 10)
          : availability === "by" && availableBy
            ? availableBy
            : undefined,
      agentFee: agentFee === "any" ? undefined : (agentFee as "none" | "has"),
      noDeposit: quickFilters.noDepositOnly || undefined,
      utilitiesIncluded: quickFilters.waterAndLights || undefined,
      parkingAvailable: quickFilters.parking || undefined,
      ...mapBounds,
    };
  }, [
    q,
    category,
    city,
    area,
    minRent,
    maxRent,
    furnished,
    availability,
    availableBy,
    agentFee,
    quickFilters,
    categories,
    mapBounds,
  ]);
  const listingsQ = useQuery({
    queryKey: listingQueryKey(filters),
    queryFn: ({ signal }) => getListings(filters, signal),
    placeholderData: (previous) => previous,
  });
  const listings = useMemo(() => listingsQ.data ?? [], [listingsQ.data]);
  useEffect(() => {
    if (selectedListingId && !listings.some((listing) => listing.id === selectedListingId))
      setSelectedListingId(null);
  }, [listings, selectedListingId]);
  useEffect(() => {
    const timer = window.setTimeout(
      () =>
        void navigate({
          replace: true,
          search: () => ({
            q: q.trim() || undefined,
            category: category === "all" ? undefined : category,
            city: city === "all" ? undefined : city,
            area: area === "all" ? undefined : area,
            minRent: minRent ? Number(minRent) : undefined,
            maxRent: maxRent ? Number(maxRent) : undefined,
            furnished: furnished === "any" ? undefined : (furnished as "yes" | "no"),
            availability: availability === "any" ? undefined : (availability as "now" | "by"),
            availableBy: availability === "by" ? availableBy || undefined : undefined,
            agentFee: agentFee === "any" ? undefined : (agentFee as "none" | "has"),
            sort: sort === "newest" ? undefined : (sort as ListingsUrlState["sort"]),
            view: mobileView === "list" ? undefined : mobileView,
            lat: pendingViewport ? Number(pendingViewport.center[1].toFixed(5)) : search.lat,
            lng: pendingViewport ? Number(pendingViewport.center[0].toFixed(5)) : search.lng,
            zoom: pendingViewport ? Number(pendingViewport.zoom.toFixed(2)) : search.zoom,
            ...mapBounds,
          }),
        }),
      200,
    );
    return () => window.clearTimeout(timer);
  }, [
    q,
    category,
    city,
    area,
    minRent,
    maxRent,
    furnished,
    availability,
    availableBy,
    agentFee,
    sort,
    mobileView,
    mapBounds,
    navigate,
    pendingViewport,
    search.lat,
    search.lng,
    search.zoom,
  ]);
  const searchThisArea = useCallback(() => {
    if (!pendingViewport) return;
    setMapBounds(pendingViewport.bounds);
    window.dispatchEvent(
      new CustomEvent("roomwise:analytics", { detail: { event: "search_this_area" } }),
    );
  }, [pendingViewport]);
  const showSearchArea = Boolean(
    pendingViewport && boundsMeaningfullyChanged(mapBounds, pendingViewport.bounds),
  );
  const catName = (id: string) => categories.find((c) => c.id === id)?.name;

  const cities = useMemo(
    () => Array.from(new Set(listings.map((l) => l.location).filter(Boolean))) as string[],
    [listings],
  );
  const areas = useMemo(
    () =>
      Array.from(
        new Set(
          listings
            .filter((l) => city === "all" || l.location === city)
            .map((l) => l.area)
            .filter(Boolean),
        ),
      ) as string[],
    [listings, city],
  );

  const filtered = useMemo(() => {
    const out = listings.slice();
    switch (sort) {
      case "price-asc":
        out.sort((a, b) => Number(a.rent_amount) - Number(b.rent_amount));
        break;
      case "price-desc":
        out.sort((a, b) => Number(b.rent_amount) - Number(a.rent_amount));
        break;
      case "available":
        out.sort(
          (a, b) =>
            (a.available_date ? Date.parse(a.available_date) : Infinity) -
            (b.available_date ? Date.parse(b.available_date) : Infinity),
        );
        break;
    }
    return out;
  }, [listings, sort]);

  const selectListing = useCallback((id: string) => {
    setSelectedListingId(id);
    if (window.matchMedia("(min-width: 1024px)").matches) {
      document
        .querySelector(`[data-listing-id="${id}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, []);

  function reset() {
    setQ("");
    setCategory("all");
    setCity("all");
    setArea("all");
    setMinRent("");
    setMaxRent("");
    setFurnished("any");
    setAvailability("any");
    setAvailableBy("");
    setAgentFee("any");
    setSort("newest");
    setQuickFilters({
      category: "",
      priceRange: "",
      noDepositOnly: false,
      waterAndLights: false,
      parking: false,
    });
  }

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-10 flex-1 w-full">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="font-serif text-4xl">Rooms to rent</h1>
            <p className="text-muted-foreground mt-1">
              {listingsQ.isFetching && !listingsQ.isLoading
                ? `Updating… ${filtered.length} ${filtered.length === 1 ? "room" : "rooms"} shown`
                : listingsQ.isLoading
                  ? "Loading rooms…"
                  : listingsQ.isError
                    ? "Couldn't load rooms."
                    : `${filtered.length} ${filtered.length === 1 ? "room" : "rooms"} found`}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              className="xl:hidden"
              onClick={() => setFiltersOpen((v) => !v)}
            >
              {filtersOpen ? "Hide filters" : "Filters"}
            </Button>
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Sort</Label>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="price-asc">Rent: low to high</SelectItem>
                <SelectItem value="price-desc">Rent: high to low</SelectItem>
                <SelectItem value="available">Available soonest</SelectItem>
              </SelectContent>
            </Select>
            <div
              className="flex lg:hidden rounded-lg border border-border p-0.5"
              aria-label="Choose results view"
            >
              <Button
                type="button"
                size="sm"
                variant={mobileView === "list" ? "default" : "ghost"}
                onClick={() => setMobileView("list")}
                aria-pressed={mobileView === "list"}
              >
                List
              </Button>
              <Button
                type="button"
                size="sm"
                variant={mobileView === "map" ? "default" : "ghost"}
                onClick={() => setMobileView("map")}
                aria-pressed={mobileView === "map"}
              >
                Map
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[250px_minmax(0,1fr)]">
          <aside
            className={`${filtersOpen ? "block" : "hidden"} xl:block rounded-2xl border border-border bg-card p-5 space-y-4 h-fit xl:sticky xl:top-24`}
          >
            <div>
              <Label>Search</Label>
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Title, area, city…"
              />
            </div>
            <div>
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>City</Label>
              <Select
                value={city}
                onValueChange={(v) => {
                  setCity(v);
                  setArea("all");
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All cities</SelectItem>
                  {cities.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Suburb / area</Label>
              <Select value={area} onValueChange={setArea}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All areas</SelectItem>
                  {areas.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Min rent</Label>
                <Input
                  type="number"
                  value={minRent}
                  onChange={(e) => setMinRent(e.target.value)}
                  placeholder="R"
                />
              </div>
              <div>
                <Label>Max rent</Label>
                <Input
                  type="number"
                  value={maxRent}
                  onChange={(e) => setMaxRent(e.target.value)}
                  placeholder="R"
                />
              </div>
            </div>
            <div>
              <Label>Furnished</Label>
              <Select value={furnished} onValueChange={setFurnished}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="yes">Furnished</SelectItem>
                  <SelectItem value="no">Unfurnished</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Availability</Label>
              <Select value={availability} onValueChange={setAvailability}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any time</SelectItem>
                  <SelectItem value="now">Available now</SelectItem>
                  <SelectItem value="by">Available by date</SelectItem>
                </SelectContent>
              </Select>
              {availability === "by" && (
                <Input
                  type="date"
                  className="mt-2"
                  value={availableBy}
                  onChange={(e) => setAvailableBy(e.target.value)}
                />
              )}
            </div>
            <div>
              <Label>Agent fee</Label>
              <Select value={agentFee} onValueChange={setAgentFee}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="none">No agent fee</SelectItem>
                  <SelectItem value="has">Has agent fee</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" className="w-full" onClick={reset}>
              Reset filters
            </Button>
          </aside>

          <section className="min-w-0">
            <QuickFilters filters={quickFilters} onChange={setQuickFilters} />
            <div className="grid gap-6 lg:grid-cols-[minmax(340px,0.9fr)_minmax(420px,1.1fr)]">
              <div className={mobileView === "list" ? "block" : "hidden lg:block"}>
                {listingsQ.isLoading && (
                  <div className="grid gap-6 sm:grid-cols-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div
                        key={i}
                        className="rounded-2xl border border-border bg-card overflow-hidden"
                      >
                        <div className="aspect-[4/3] bg-muted animate-pulse" />
                        <div className="p-4 space-y-2">
                          <div className="h-4 w-2/3 bg-muted rounded animate-pulse" />
                          <div className="h-3 w-1/2 bg-muted rounded animate-pulse" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {listingsQ.isError && !listingsQ.isLoading && listings.length === 0 && (
                  <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-10 text-center space-y-3">
                    <p className="font-serif text-xl text-foreground">
                      We couldn't load rooms right now.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {(listingsQ.error as Error)?.message || "The rooms service isn't responding."}
                    </p>
                    <Button onClick={() => listingsQ.refetch()}>Retry</Button>
                  </div>
                )}

                {listingsQ.isError && listings.length > 0 && (
                  <div className="mb-4 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm">
                    Results could not be refreshed. Showing the last successful search.
                    <Button variant="link" size="sm" onClick={() => listingsQ.refetch()}>
                      Retry
                    </Button>
                  </div>
                )}

                {!listingsQ.isLoading && !listingsQ.isError && listings.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-border p-10 text-center">
                    <p className="font-serif text-xl">No rooms found yet.</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      New rooms will appear here as owners publish them.
                    </p>
                  </div>
                )}

                {!listingsQ.isLoading && listings.length > 0 && filtered.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-border p-10 text-center">
                    <p className="text-muted-foreground">No rooms match those filters.</p>
                    <Button variant="link" onClick={reset}>
                      Clear filters
                    </Button>
                  </div>
                )}

                {!listingsQ.isLoading && filtered.length > 0 && (
                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">
                    {filtered.map((l) => (
                      <div
                        key={l.id}
                        data-listing-id={l.id}
                        onMouseEnter={() => setHighlightedListingId(l.id)}
                        onMouseLeave={() => setHighlightedListingId(null)}
                        onFocus={() => setHighlightedListingId(l.id)}
                        className={`rounded-2xl transition-shadow ${selectedListingId === l.id ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`}
                      >
                        <ListingCard listing={l} categoryName={catName(l.category_id)} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <aside
                className={`${mobileView === "map" ? "block" : "hidden"} lg:block lg:sticky lg:top-24 lg:h-[calc(100vh-7rem)]`}
              >
                <div className="relative h-full">
                  <ListingsMap
                    listings={filtered}
                    selectedListingId={selectedListingId}
                    highlightedListingId={highlightedListingId}
                    onListingSelect={selectListing}
                    onViewportChange={setPendingViewport}
                    initialCenter={
                      search.lng !== undefined && search.lat !== undefined
                        ? [search.lng, search.lat]
                        : undefined
                    }
                    initialZoom={search.zoom}
                    className="h-[calc(100dvh-10rem)] min-h-[420px] lg:h-full"
                  />
                  {showSearchArea && (
                    <Button
                      type="button"
                      className="absolute left-1/2 top-4 z-10 -translate-x-1/2 shadow-lg"
                      onClick={searchThisArea}
                    >
                      Search this area
                    </Button>
                  )}
                  {mobileView === "map" && selectedListingId && (
                    <div className="absolute bottom-10 left-3 right-3 z-10 rounded-xl border bg-background p-3 shadow-xl lg:hidden">
                      <p className="font-semibold">
                        {filtered.find((item) => item.id === selectedListingId)?.title}
                      </p>
                      <Button variant="link" className="px-0" asChild>
                        <a href={`/listings/${selectedListingId}`}>View listing</a>
                      </Button>
                    </div>
                  )}
                </div>
              </aside>
            </div>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
