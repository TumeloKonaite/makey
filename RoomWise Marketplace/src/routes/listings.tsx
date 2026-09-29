import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
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
import { isAvailableNow } from "@/lib/format";

type SearchState = { category?: string; city?: string };

export const Route = createFileRoute("/listings")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): SearchState => ({
    category: typeof s.category === "string" ? s.category : undefined,
    city: typeof s.city === "string" ? s.city : undefined,
  }),
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
  const listingsQ = useQuery({ queryKey: ["listings"], queryFn: getListings });
  const catsQ = useQuery({ queryKey: ["categories"], queryFn: getCategories });

  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string>(search.category || "all");
  const [city, setCity] = useState<string>(search.city || "all");
  const [area, setArea] = useState<string>("all");
  const [minRent, setMinRent] = useState("");
  const [maxRent, setMaxRent] = useState("");
  const [furnished, setFurnished] = useState<string>("any");
  const [availability, setAvailability] = useState<string>("any");
  const [availableBy, setAvailableBy] = useState("");
  const [agentFee, setAgentFee] = useState<string>("any");
  const [sort, setSort] = useState<string>("newest");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mobileView, setMobileView] = useState<"list" | "map">("list");
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const [quickFilters, setQuickFilters] = useState<FilterState>({
    category: "",
    priceRange: "",
    noDepositOnly: false,
    waterAndLights: false,
    parking: false,
  });

  const listings = useMemo(() => listingsQ.data ?? [], [listingsQ.data]);
  const categories = useMemo(() => catsQ.data ?? [], [catsQ.data]);
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
    let out = listings.slice();
    const qq = q.trim().toLowerCase();
    if (qq) {
      out = out.filter(
        (l) =>
          l.title.toLowerCase().includes(qq) ||
          (l.description || "").toLowerCase().includes(qq) ||
          (l.area || "").toLowerCase().includes(qq) ||
          (l.location || "").toLowerCase().includes(qq),
      );
    }
    if (category !== "all") out = out.filter((l) => l.category_id === category);
    if (city !== "all") out = out.filter((l) => l.location === city);
    if (area !== "all") out = out.filter((l) => l.area === area);
    const minN = Number(minRent);
    const maxN = Number(maxRent);
    if (minRent && Number.isFinite(minN)) out = out.filter((l) => Number(l.rent_amount) >= minN);
    if (maxRent && Number.isFinite(maxN)) out = out.filter((l) => Number(l.rent_amount) <= maxN);
    if (furnished !== "any") {
      const want = furnished === "yes";
      out = out.filter((l) => l.is_furnished === want);
    }
    if (availability === "now") out = out.filter((l) => isAvailableNow(l.available_date));
    if (availability === "by" && availableBy) {
      const t = new Date(availableBy).getTime();
      out = out.filter((l) => l.available_date && new Date(l.available_date).getTime() <= t);
    }
    if (agentFee === "none") out = out.filter((l) => !l.agent_fee || Number(l.agent_fee) === 0);
    if (agentFee === "has") out = out.filter((l) => l.agent_fee && Number(l.agent_fee) > 0);
    if (quickFilters.category) {
      out = out.filter((l) => {
        const listingCategory = categories.find((c) => c.id === l.category_id);
        return (
          l.category_id === quickFilters.category || listingCategory?.slug === quickFilters.category
        );
      });
    }
    if (quickFilters.priceRange) {
      out = out.filter((l) => {
        const rent = Number(l.rent_amount);
        if (quickFilters.priceRange === "under-1500") return rent < 1500;
        if (quickFilters.priceRange === "1500-2500") return rent >= 1500 && rent <= 2500;
        if (quickFilters.priceRange === "above-2500") return rent > 2500;
        return true;
      });
    }
    if (quickFilters.noDepositOnly) {
      out = out.filter((l) => !l.deposit_amount || Number(l.deposit_amount) === 0);
    }
    if (quickFilters.waterAndLights) out = out.filter((l) => l.utilities_included);
    if (quickFilters.parking) out = out.filter((l) => l.parking_available);

    switch (sort) {
      case "price-asc":
        out.sort((a, b) => Number(a.rent_amount) - Number(b.rent_amount));
        break;
      case "price-desc":
        out.sort((a, b) => Number(b.rent_amount) - Number(a.rent_amount));
        break;
      case "available":
        out.sort((a, b) => {
          const da = a.available_date ? new Date(a.available_date).getTime() : Infinity;
          const db = b.available_date ? new Date(b.available_date).getTime() : Infinity;
          return da - db;
        });
        break;
      default:
        break;
    }
    return out;
  }, [
    listings,
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
    quickFilters,
    categories,
  ]);

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
              {listingsQ.isLoading
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

                {listingsQ.isError && !listingsQ.isLoading && (
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

                {!listingsQ.isLoading && !listingsQ.isError && listings.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-border p-10 text-center">
                    <p className="font-serif text-xl">No rooms found yet.</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      New rooms will appear here as owners publish them.
                    </p>
                  </div>
                )}

                {!listingsQ.isLoading &&
                  !listingsQ.isError &&
                  listings.length > 0 &&
                  filtered.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-border p-10 text-center">
                      <p className="text-muted-foreground">No rooms match those filters.</p>
                      <Button variant="link" onClick={reset}>
                        Clear filters
                      </Button>
                    </div>
                  )}

                {!listingsQ.isLoading && !listingsQ.isError && filtered.length > 0 && (
                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">
                    {filtered.map((l) => (
                      <div
                        key={l.id}
                        data-listing-id={l.id}
                        onMouseEnter={() => setSelectedListingId(l.id)}
                        onFocus={() => setSelectedListingId(l.id)}
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
                <ListingsMap
                  listings={filtered}
                  selectedListingId={selectedListingId}
                  onListingSelect={selectListing}
                  className="h-[65vh] min-h-[420px] lg:h-full"
                />
              </aside>
            </div>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
