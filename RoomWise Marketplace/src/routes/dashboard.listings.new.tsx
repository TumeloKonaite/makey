import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AdminListingForm } from "@/components/OwnerListingForm";
import { ApiError, createListing, getCategories } from "@/lib/api";
import type { ListingInput } from "@/types";

export const Route = createFileRoute("/dashboard/listings/new")({
  ssr: false,
  component: NewListing,
});

function NewListing() {
  const router = useRouter();
  const catsQ = useQuery({ queryKey: ["categories"], queryFn: getCategories });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(input: ListingInput) {
    setErrors({});
    setSubmitting(true);
    try {
      const created = await createListing(input);
      router.navigate({ to: "/dashboard/listings/$id/edit", params: { id: created.id } });
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

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-3xl">New listing</h1>
      {catsQ.isLoading ? (
        <p className="text-muted-foreground">Loading categories…</p>
      ) : (
        <AdminListingForm
          categories={catsQ.data ?? []}
          submitLabel="Create listing"
          onSubmit={onSubmit}
          errors={errors}
          submitting={submitting}
        />
      )}
    </div>
  );
}
