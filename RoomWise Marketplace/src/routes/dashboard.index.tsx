import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { getMyListings, getOwnerEnquiries } from "@/lib/api";

export const Route = createFileRoute("/dashboard/")({
  ssr: false,
  component: DashboardHome,
});

function DashboardHome() {
  const listingsQ = useQuery({ queryKey: ["me", "listings"], queryFn: getMyListings });
  const enquiriesQ = useQuery({ queryKey: ["me", "enquiries"], queryFn: getOwnerEnquiries });

  const listings = listingsQ.data ?? [];
  const enquiries = enquiriesQ.data ?? [];

  const total = listings.length;
  const published = listings.filter((l) => l.status === "published").length;
  const drafts = listings.filter((l) => l.status === "draft").length;
  const archived = listings.filter((l) => l.status === "archived").length;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl">Owner dashboard</h1>
          <p className="text-muted-foreground mt-1">Everything happening on your listings.</p>
        </div>
        <Link to="/dashboard/listings/new">
          <Button>+ New listing</Button>
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total listings" value={total} loading={listingsQ.isLoading} />
        <Stat label="Published" value={published} loading={listingsQ.isLoading} />
        <Stat label="Drafts" value={drafts} loading={listingsQ.isLoading} />
        <Stat label="Enquiries" value={enquiries.length} loading={enquiriesQ.isLoading} />
      </div>

      {archived > 0 && (
        <p className="text-sm text-muted-foreground">
          {archived} archived listing{archived === 1 ? "" : "s"}.
        </p>
      )}

      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-serif text-xl mb-4">Recent enquiries</h2>
        {enquiriesQ.isLoading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : enquiries.length === 0 ? (
          <p className="text-muted-foreground">No enquiries yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {enquiries.slice(0, 5).map((e) => (
              <li key={e.id} className="py-3 flex justify-between items-start gap-4">
                <div>
                  <div className="font-medium">{e.name}</div>
                  <div className="text-sm text-muted-foreground line-clamp-1">{e.message}</div>
                  {e.listing && (
                    <div className="text-xs text-muted-foreground mt-1">For: {e.listing.title}</div>
                  )}
                </div>
                <Link
                  to="/dashboard/enquiries"
                  className="text-sm text-primary hover:underline shrink-0"
                >
                  View
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
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
