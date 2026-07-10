import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getOwnerEnquiries } from "@/lib/api";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/dashboard/enquiries")({
  ssr: false,
  component: EnquiriesInbox,
});

function EnquiriesInbox() {
  const q = useQuery({ queryKey: ["me", "enquiries"], queryFn: getOwnerEnquiries });
  const items = q.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl">Enquiries</h1>
        <p className="text-muted-foreground mt-1">Messages from people interested in your rooms.</p>
      </div>
      {q.isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : q.isError ? (
        <p className="text-destructive">Couldn't load enquiries.</p>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
          No enquiries yet.
        </div>
      ) : (
        <div className="grid gap-4">
          {items.map((e) => (
            <div key={e.id} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-serif text-lg">{e.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {[e.email, e.phone].filter(Boolean).join(" · ") || "No contact details"}
                  </div>
                  {e.listing && (
                    <div className="text-xs text-muted-foreground mt-1">
                      For: <span className="text-foreground">{e.listing.title}</span>
                      {e.listing.category_name ? ` · ${e.listing.category_name}` : ""}
                    </div>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">{formatDate(e.created_at)}</div>
              </div>
              <p className="mt-3 whitespace-pre-line text-foreground/90">{e.message}</p>
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                {e.desired_move_in_date && (
                  <span>Move-in: {formatDate(e.desired_move_in_date)}</span>
                )}
                {e.occupant_count && <span>Occupants: {e.occupant_count}</span>}
                {e.is_viewing_requested && (
                  <span className="text-primary">
                    Viewing requested
                    {e.preferred_viewing_date ? ` — ${formatDate(e.preferred_viewing_date)}` : ""}
                    {e.preferred_viewing_time ? ` @ ${e.preferred_viewing_time.slice(0, 5)}` : ""}
                  </span>
                )}
              </div>
              {e.viewing_notes && (
                <p className="mt-2 text-sm text-muted-foreground italic">"{e.viewing_notes}"</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
