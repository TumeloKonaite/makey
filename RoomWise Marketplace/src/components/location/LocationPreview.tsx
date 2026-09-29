import type { ListingInput } from "@/types";

export function LocationPreview({ value }: { value: Partial<ListingInput> }) {
  if (!value.latitude || !value.longitude) return null;
  const normalized = [value.address_line, value.area, value.city, value.province, value.postal_code]
    .filter(Boolean)
    .join(", ");
  return (
    <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-1">
      <p className="font-medium">{normalized || "Selected position"}</p>
      <p className="text-muted-foreground">
        {value.latitude}, {value.longitude}
      </p>
      <p className="text-xs text-muted-foreground">
        The exact position is saved for the owner workflow; public disclosure can be handled
        separately.
      </p>
    </div>
  );
}
