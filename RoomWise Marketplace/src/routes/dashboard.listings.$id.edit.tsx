import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { OwnerListingForm } from "@/components/OwnerListingForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ApiError,
  getCategories,
  getMyListing,
  updateListing,
  uploadListingImage,
} from "@/lib/api";
import type { ListingInput } from "@/types";

export const Route = createFileRoute("/dashboard/listings/$id/edit")({
  ssr: false,
  component: EditListing,
});

function EditListing() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const catsQ = useQuery({ queryKey: ["categories"], queryFn: getCategories });
  const listingQ = useQuery({
    queryKey: ["me", "listing", id],
    queryFn: () => getMyListing(id),
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [isCover, setIsCover] = useState(false);
  const [uploadOrder, setUploadOrder] = useState<number>(0);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function onSubmit(input: ListingInput) {
    setErrors({});
    setSubmitting(true);
    setSaved(false);
    try {
      await updateListing(id, input);
      await qc.invalidateQueries({ queryKey: ["me", "listing", id] });
      await qc.invalidateQueries({ queryKey: ["me", "listings"] });
      setSaved(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(Object.keys(err.fieldErrors).length ? err.fieldErrors : { form: err.message });
      } else {
        setErrors({ form: (err as Error).message });
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function onUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      await uploadListingImage(id, file, uploadOrder, isCover);
      setFile(null);
      setIsCover(false);
      setUploadOrder(uploadOrder + 1);
      await qc.invalidateQueries({ queryKey: ["me", "listing", id] });
    } catch (err) {
      setUploadError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  const listing = listingQ.data;

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h1 className="font-serif text-3xl">Edit listing</h1>
        <Link to="/dashboard/listings" className="text-sm text-primary hover:underline">
          ← All listings
        </Link>
      </div>

      {listingQ.isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : !listing ? (
        <p className="text-destructive">Listing not found.</p>
      ) : (
        <>
          {saved && <p className="text-sm text-primary bg-primary/10 rounded p-2">Saved.</p>}
          <OwnerListingForm
            categories={catsQ.data ?? []}
            initial={listing}
            submitLabel="Save changes"
            onSubmit={onSubmit}
            errors={errors}
            submitting={submitting}
          />

          <section className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <div>
              <h2 className="font-serif text-xl">Photos</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Upload JPEG, PNG or WebP images. Photos can't currently be re-ordered or removed
                after upload, so upload thoughtfully.
              </p>
            </div>

            {listing.images.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[...listing.images]
                  .sort((a, b) => a.display_order - b.display_order)
                  .map((img) => (
                    <div
                      key={img.id}
                      className="relative aspect-square rounded-lg overflow-hidden bg-muted border border-border"
                    >
                      <img src={img.url} alt="" className="w-full h-full object-cover" />
                      {img.is_cover && (
                        <span className="absolute top-1 left-1 text-[10px] uppercase tracking-widest bg-primary text-primary-foreground rounded px-1.5 py-0.5">
                          Cover
                        </span>
                      )}
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No photos uploaded yet.</p>
            )}

            <form
              onSubmit={onUpload}
              className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto] items-end pt-2"
            >
              <div>
                <Label>Image file</Label>
                <Input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <div>
                <Label>Order</Label>
                <Input
                  type="number"
                  className="w-24"
                  value={uploadOrder}
                  onChange={(e) => setUploadOrder(Number(e.target.value))}
                />
              </div>
              <label className="flex items-center gap-2 text-sm pb-2">
                <Checkbox checked={isCover} onCheckedChange={(v) => setIsCover(!!v)} />
                Cover photo
              </label>
              <Button type="submit" disabled={!file || uploading}>
                {uploading ? "Uploading…" : "Upload"}
              </Button>
            </form>
            {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}
          </section>
        </>
      )}
    </div>
  );
}
