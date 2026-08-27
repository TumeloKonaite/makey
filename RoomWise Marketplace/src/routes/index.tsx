import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { ListingCard } from "@/components/ListingCard";
import { Button } from "@/components/ui/button";
import { getCategories, getListings } from "@/lib/api";
import { API_BASE_URL } from "@/lib/env";
import type { Listing } from "@/types";

const CITIES = ["Cape Town", "Johannesburg", "Durban", "Pretoria"] as const;

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Marketplace Rooms — Rooms to rent across South Africa" },
      {
        name: "description",
        content:
          "Find rooms to rent in Cape Town, Johannesburg, Durban and Pretoria. Compare rent, deposits, furnishing and move-in dates.",
      },
      {
        property: "og:title",
        content: "Marketplace Rooms — Rooms to rent across South Africa",
      },
      {
        property: "og:description",
        content: "Browse real rooms across South Africa and compare rental details in one place.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  const listingsQ = useQuery({ queryKey: ["listings"], queryFn: getListings });
  const catsQ = useQuery({ queryKey: ["categories"], queryFn: getCategories });

  const categories = catsQ.data ?? [];
  const catName = (id: string) => categories.find((c) => c.id === id)?.name;
  const listings = listingsQ.data ?? [];
  const featured = listings.slice(0, 6);
  const heroCards = listings.slice(0, 2);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />

      {/* Hero */}
      <section className="relative">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-20 grid gap-10 lg:grid-cols-[1.05fr_1fr] items-center">
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-primary">
              <span className="h-px w-8 bg-primary" /> Rooms across South Africa
            </span>
            <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl leading-[1.05] text-foreground">
              Find your next room with the details that matter.
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-xl">
              Browse real rooms across South Africa. Compare rent, deposits, furnishing, utilities
              and move-in dates.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link to="/listings">
                <Button size="lg">Browse rooms</Button>
              </Link>
              <Link to="/categories">
                <Button size="lg" variant="outline">
                  Explore categories
                </Button>
              </Link>
            </div>
          </div>

          <HeroPreview cards={heroCards} loading={listingsQ.isLoading} catName={catName} />
        </div>
      </section>

      {/* Latest rooms */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16 w-full">
        <div className="flex items-end justify-between gap-4 mb-6">
          <h2 className="font-serif text-2xl sm:text-3xl">Latest rooms</h2>
          <Link to="/listings" className="text-sm text-primary hover:underline shrink-0">
            View all →
          </Link>
        </div>

        {listingsQ.isLoading ? (
          <SkeletonGrid />
        ) : listingsQ.isError ? (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-6 text-sm">
            <p className="text-destructive">Couldn't load listings from the API.</p>
            <p className="text-muted-foreground mt-1">
              Check that <code className="text-xs">{API_BASE_URL}</code> is reachable.
            </p>
          </div>
        ) : featured.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
            <p className="font-serif text-xl">No rooms published yet.</p>
            <p className="text-sm text-muted-foreground mt-2">
              Check back soon, or browse categories to see what's coming.
            </p>
            <Link to="/categories" className="inline-block mt-4 text-primary hover:underline">
              Explore categories →
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((l) => (
              <ListingCard key={l.id} listing={l} categoryName={catName(l.category_id)} />
            ))}
          </div>
        )}
      </section>

      {/* Room types */}
      {categories.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12 w-full">
          <div className="flex items-end justify-between gap-4 mb-6">
            <h2 className="font-serif text-2xl sm:text-3xl">Browse by room type</h2>
            <Link to="/categories" className="text-sm text-primary hover:underline shrink-0">
              See all →
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 sm:grid sm:grid-cols-2 md:grid-cols-4 sm:gap-4 sm:overflow-visible sm:mx-0 sm:px-0">
            {categories.slice(0, 8).map((c) => (
              <Link
                key={c.id}
                to="/listings"
                search={{ category: c.id } as never}
                className="shrink-0 w-56 sm:w-auto rounded-2xl border border-border bg-card p-5 hover:border-primary/50 hover:shadow-sm transition"
              >
                <div className="font-serif text-lg text-foreground">{c.name}</div>
                {c.description && (
                  <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2">
                    {c.description}
                  </p>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Cities */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12 w-full">
        <div className="mb-6">
          <h2 className="font-serif text-2xl sm:text-3xl">Browse by city</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Popular rental markets across South Africa.
          </p>
        </div>
        <div className="grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-4">
          {CITIES.map((city, i) => {
            const count = listings.filter((l) => l.location === city).length;
            return (
              <Link
                key={city}
                to="/listings"
                search={{ city } as never}
                className="group relative overflow-hidden rounded-2xl border border-border bg-card aspect-[4/3] p-5 flex flex-col justify-end hover:border-primary/50 transition"
                style={{
                  backgroundImage: `radial-gradient(circle at ${20 + i * 20}% ${30 + i * 15}%, oklch(0.85 0.05 ${60 + i * 8}) 0%, transparent 60%), repeating-linear-gradient(${45 + i * 30}deg, oklch(0.93 0.02 78) 0 14px, oklch(0.95 0.015 82) 14px 28px)`,
                }}
              >
                <div className="font-serif text-xl text-foreground">{city}</div>
                <div className="text-xs text-muted-foreground">
                  {count > 0 ? `${count} ${count === 1 ? "room" : "rooms"}` : "Browse rooms"}
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

function HeroPreview({
  cards,
  loading,
  catName,
}: {
  cards: Listing[];
  loading: boolean;
  catName: (id: string) => string | undefined;
}) {
  if (loading) {
    return (
      <div className="grid gap-4 grid-cols-2">
        <div className="aspect-[3/4] rounded-3xl bg-card border border-border animate-pulse" />
        <div className="aspect-[3/4] rounded-3xl bg-card border border-border animate-pulse mt-8" />
      </div>
    );
  }
  if (cards.length === 0) {
    return (
      <div className="grid gap-4 grid-cols-2">
        <div
          className="aspect-[3/4] rounded-3xl border border-border"
          style={{
            backgroundImage:
              "repeating-linear-gradient(135deg, oklch(0.9 0.03 72) 0 14px, oklch(0.93 0.02 78) 14px 28px)",
          }}
        />
        <div
          className="aspect-[3/4] rounded-3xl border border-border mt-8"
          style={{
            backgroundImage:
              "radial-gradient(circle at 30% 30%, oklch(0.82 0.06 55) 0%, transparent 60%), repeating-linear-gradient(45deg, oklch(0.93 0.02 78) 0 14px, oklch(0.95 0.015 82) 14px 28px)",
          }}
        />
      </div>
    );
  }
  return (
    <div className="grid gap-4 grid-cols-2">
      <div>
        <ListingCard listing={cards[0]} categoryName={catName(cards[0].category_id)} compact />
      </div>
      {cards[1] && (
        <div className="mt-8">
          <ListingCard listing={cards[1]} categoryName={catName(cards[1].category_id)} compact />
        </div>
      )}
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="aspect-[4/3] bg-muted animate-pulse" />
          <div className="p-4 space-y-2">
            <div className="h-4 w-3/4 bg-muted rounded animate-pulse" />
            <div className="h-3 w-1/2 bg-muted rounded animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}
