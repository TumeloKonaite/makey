import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { getCategories, getListings } from "@/lib/api";

export const Route = createFileRoute("/categories")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Room categories — Marketplace Rooms" },
      {
        name: "description",
        content: "Browse rooms by category: single, shared, studio and more.",
      },
    ],
  }),
  component: CategoriesPage,
});

function CategoriesPage() {
  const catsQ = useQuery({ queryKey: ["categories"], queryFn: getCategories });
  const listingsQ = useQuery({ queryKey: ["listings"], queryFn: getListings });

  const countFor = (id: string) =>
    (listingsQ.data ?? []).filter((l) => l.category_id === id).length;

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-12 flex-1 w-full">
        <h1 className="font-serif text-4xl mb-2">Room categories</h1>
        <p className="text-muted-foreground mb-8">
          Pick the type of room that suits how you want to live.
        </p>
        {catsQ.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl border border-border bg-card p-6 h-28 animate-pulse"
              />
            ))}
          </div>
        ) : catsQ.isError ? (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-10 text-center space-y-3">
            <p className="font-serif text-xl">We couldn't load room types right now.</p>
            <p className="text-sm text-muted-foreground">
              {(catsQ.error as Error)?.message || "The categories service isn't responding."}
            </p>
            <Button onClick={() => catsQ.refetch()}>Retry</Button>
          </div>
        ) : (catsQ.data ?? []).length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center">
            <p className="font-serif text-xl">No categories yet.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(catsQ.data ?? []).map((c) => (
              <Link
                key={c.id}
                to="/listings"
                search={{ category: c.id } as never}
                className="rounded-2xl border border-border bg-card p-6 hover:border-primary/50 hover:shadow-sm transition"
              >
                <div className="flex items-center justify-between">
                  <h2 className="font-serif text-xl">{c.name}</h2>
                  <span className="text-xs rounded-full bg-secondary px-2 py-0.5">
                    {countFor(c.id)} rooms
                  </span>
                </div>
                {c.description && (
                  <p className="text-sm text-muted-foreground mt-2">{c.description}</p>
                )}
              </Link>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
