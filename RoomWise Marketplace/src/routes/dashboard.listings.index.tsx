import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { deleteListing, getCategories, getMyListings, updateListing } from "@/lib/api";
import { formatZAR } from "@/lib/format";
import type { ListingStatus } from "@/types";

export const Route = createFileRoute("/dashboard/listings/")({
  ssr: false,
  component: MyListings,
});

function MyListings() {
  const qc = useQueryClient();
  const listingsQ = useQuery({ queryKey: ["me", "listings"], queryFn: getMyListings });
  const catsQ = useQuery({ queryKey: ["categories"], queryFn: getCategories });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const catName = (id: string) => catsQ.data?.find((c) => c.id === id)?.name;

  async function setStatus(id: string, status: ListingStatus) {
    setBusyId(id);
    setError(null);
    try {
      await updateListing(id, { status });
      await qc.invalidateQueries({ queryKey: ["me", "listings"] });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }
  async function remove(id: string) {
    if (!confirm("Delete this listing? This can't be undone.")) return;
    setBusyId(id);
    setError(null);
    try {
      await deleteListing(id);
      await qc.invalidateQueries({ queryKey: ["me", "listings"] });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  const listings = listingsQ.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <h1 className="font-serif text-3xl">My listings</h1>
        <Link to="/dashboard/listings/new">
          <Button>+ New listing</Button>
        </Link>
      </div>
      {error && <p className="text-sm text-destructive bg-destructive/10 rounded p-2">{error}</p>}

      {listingsQ.isLoading ? (
        <p className="text-muted-foreground">Loading your listings…</p>
      ) : listings.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="text-muted-foreground mb-3">You haven't listed any rooms yet.</p>
          <Link to="/dashboard/listings/new">
            <Button>Create your first listing</Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {listings.map((l) => {
            const cover = l.images.find((i) => i.is_cover)?.url || l.images[0]?.url;
            return (
              <div
                key={l.id}
                className="rounded-2xl border border-border bg-card p-4 flex flex-col md:flex-row gap-4"
              >
                <div className="w-full md:w-48 aspect-[4/3] rounded-lg overflow-hidden bg-muted shrink-0">
                  {cover ? (
                    <img src={cover} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                      No image
                    </div>
                  )}
                </div>
                <div className="flex-1 flex flex-col">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <StatusBadge status={l.status} />
                        {catName(l.category_id) && (
                          <span className="text-xs text-muted-foreground">
                            {catName(l.category_id)}
                          </span>
                        )}
                      </div>
                      <h3 className="font-serif text-lg">{l.title}</h3>
                      <div className="text-sm text-muted-foreground">
                        {[l.area, l.location].filter(Boolean).join(", ") || "—"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-primary font-semibold">
                        {formatZAR(l.rent_amount, l.currency)}
                      </div>
                      <div className="text-xs text-muted-foreground">/ month</div>
                    </div>
                  </div>
                  <div className="mt-auto flex flex-wrap gap-2 pt-4">
                    <Link to="/dashboard/listings/$id/edit" params={{ id: l.id }}>
                      <Button size="sm" variant="outline">
                        Edit
                      </Button>
                    </Link>
                    {l.status !== "published" && (
                      <Button
                        size="sm"
                        onClick={() => setStatus(l.id, "published")}
                        disabled={busyId === l.id}
                      >
                        Publish
                      </Button>
                    )}
                    {l.status !== "archived" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setStatus(l.id, "archived")}
                        disabled={busyId === l.id}
                      >
                        Archive
                      </Button>
                    )}
                    {l.status === "archived" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setStatus(l.id, "draft")}
                        disabled={busyId === l.id}
                      >
                        Restore to draft
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => remove(l.id)}
                      disabled={busyId === l.id}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: ListingStatus }) {
  const map: Record<ListingStatus, string> = {
    published: "bg-primary text-primary-foreground",
    draft: "bg-secondary text-secondary-foreground",
    archived: "bg-muted text-muted-foreground",
  };
  return <Badge className={map[status]}>{status}</Badge>;
}
