import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { getMyListings } from "@/lib/api";

export const Route = createFileRoute("/dashboard/")({
  ssr: false,
  component: DashboardHome,
});

function DashboardHome() {
  const listingsQ = useQuery({ queryKey: ["me", "listings"], queryFn: getMyListings });

  const listings = listingsQ.data ?? [];

  const total = listings.length;
  const published = listings.filter((l) => l.status === "published").length;
  const drafts = listings.filter((l) => l.status === "draft").length;
  const archived = listings.filter((l) => l.status === "archived").length;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl">Admin dashboard</h1>
          <p className="text-muted-foreground mt-1">Everything happening on your listings.</p>
        </div>
        <Link to="/dashboard/listings/new">
          <Button>+ New listing</Button>
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Total listings" value={total} loading={listingsQ.isLoading} />
        <Stat label="Published" value={published} loading={listingsQ.isLoading} />
        <Stat label="Drafts" value={drafts} loading={listingsQ.isLoading} />
      </div>

      {archived > 0 && (
        <p className="text-sm text-muted-foreground">
          {archived} archived listing{archived === 1 ? "" : "s"}.
        </p>
      )}
    </div>
  );
}

function Stat({ label, value, loading }: { label: string; value: number; loading?: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-2 font-serif text-3xl text-primary">{loading ? "…" : value}</div>
    </div>
  );
}
