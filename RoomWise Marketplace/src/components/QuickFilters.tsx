export interface FilterState {
  category: string;
  priceRange: string;
  noDepositOnly: boolean;
  waterAndLights: boolean;
  parking: boolean;
}

interface QuickFiltersProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
}

export function QuickFilters({ filters, onChange }: QuickFiltersProps) {
  const categories = [
    { label: "All Rooms", value: "" },
    { label: "Single Room", value: "single-room" },
    { label: "Bachelor / Cottage", value: "cottage" },
    { label: "Garage Conversion", value: "garage" },
  ];

  const priceBands = [
    { label: "All Prices", value: "" },
    { label: "Under R1,500", value: "under-1500" },
    { label: "R1,500 – R2,500", value: "1500-2500" },
    { label: "R2,500+", value: "above-2500" },
  ];

  return (
    <div className="space-y-3 py-2 overflow-x-auto no-scrollbar">
      <div className="flex items-center gap-2 flex-nowrap sm:flex-wrap">
        {categories.map((cat) => {
          const isSelected = filters.category === cat.value;
          return (
            <button
              key={cat.value}
              type="button"
              onClick={() => onChange({ ...filters, category: cat.value })}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                isSelected
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2 flex-nowrap sm:flex-wrap">
        {priceBands.map((band) => {
          const isSelected = filters.priceRange === band.value;
          return (
            <button
              key={band.value}
              type="button"
              onClick={() => onChange({ ...filters, priceRange: band.value })}
              className={`rounded-xl border px-3 py-1 text-xs whitespace-nowrap transition-colors ${
                isSelected
                  ? "border-primary bg-primary/10 text-primary font-medium"
                  : "border-border bg-background text-muted-foreground hover:bg-muted"
              }`}
            >
              {band.label}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => onChange({ ...filters, noDepositOnly: !filters.noDepositOnly })}
          className={`rounded-xl border px-3 py-1 text-xs whitespace-nowrap transition-colors ${
            filters.noDepositOnly
              ? "border-amber-600 bg-amber-500/10 text-amber-700 dark:text-amber-400 font-medium"
              : "border-border bg-background text-muted-foreground hover:bg-muted"
          }`}
        >
          ⚡ No Deposit
        </button>

        <button
          type="button"
          onClick={() => onChange({ ...filters, waterAndLights: !filters.waterAndLights })}
          className={`rounded-xl border px-3 py-1 text-xs whitespace-nowrap transition-colors ${
            filters.waterAndLights
              ? "border-blue-600 bg-blue-500/10 text-blue-700 dark:text-blue-400 font-medium"
              : "border-border bg-background text-muted-foreground hover:bg-muted"
          }`}
        >
          💡 Water & Lights Included
        </button>

        <button
          type="button"
          onClick={() => onChange({ ...filters, parking: !filters.parking })}
          className={`rounded-xl border px-3 py-1 text-xs whitespace-nowrap transition-colors ${
            filters.parking
              ? "border-emerald-600 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-medium"
              : "border-border bg-background text-muted-foreground hover:bg-muted"
          }`}
        >
          🚗 Secure Parking
        </button>
      </div>
    </div>
  );
}
