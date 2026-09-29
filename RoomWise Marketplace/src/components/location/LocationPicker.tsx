import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ListingInput } from "@/types";

export function LocationPicker({
  value,
  onChange,
}: {
  value: Partial<ListingInput>;
  onChange: (patch: Partial<ListingInput>) => void;
}) {
  if (!value.latitude || !value.longitude) return null;
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1">
        <Label>Latitude</Label>
        <Input
          type="number"
          step="0.000001"
          min={-90}
          max={90}
          value={value.latitude}
          onChange={(event) => onChange({ latitude: event.target.value })}
        />
      </div>
      <div className="space-y-1">
        <Label>Longitude</Label>
        <Input
          type="number"
          step="0.000001"
          min={-180}
          max={180}
          value={value.longitude}
          onChange={(event) => onChange({ longitude: event.target.value })}
        />
      </div>
      <p className="col-span-2 text-xs text-muted-foreground">
        Fine-tune the saved position if the search result is not exact.
      </p>
    </div>
  );
}
