import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { searchLocations } from "@/lib/api";
import type { LocationResult } from "@/types";

export function LocationSearch({ onSelect }: { onSelect: (value: LocationResult) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LocationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [controller, setController] = useState<AbortController>();

  useEffect(() => () => controller?.abort(), [controller]);

  async function search() {
    const trimmed = query.trim();
    if (trimmed.length < 3) {
      setError("Enter at least 3 characters.");
      return;
    }
    controller?.abort();
    const nextController = new AbortController();
    setController(nextController);
    setLoading(true);
    setError(undefined);
    try {
      const matches = await searchLocations(trimmed, nextController.signal);
      setResults(matches);
      if (!matches.length) setError("No South African locations found.");
    } catch (caught) {
      if (!nextController.signal.aborted)
        setError(caught instanceof Error ? caught.message : "Location search failed.");
    } finally {
      if (!nextController.signal.aborted) setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Address, suburb or place"
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void search();
            }
          }}
        />
        <Button type="button" variant="outline" onClick={() => void search()} disabled={loading}>
          {loading ? "Searching…" : "Search"}
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {!!results.length && (
        <div className="rounded-lg border divide-y">
          {results.map((result) => (
            <button
              type="button"
              key={`${result.provider}:${result.place_id}`}
              className="block w-full p-3 text-left text-sm hover:bg-muted"
              onClick={() => {
                onSelect(result);
                setResults([]);
                setQuery(result.display_name);
              }}
            >
              {result.display_name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
