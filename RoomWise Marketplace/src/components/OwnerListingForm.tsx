import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Category, Listing, ListingInput, ListingStatus } from "@/types";

interface Props {
  categories: Category[];
  initial?: Partial<Listing>;
  submitLabel: string;
  onSubmit: (input: ListingInput) => Promise<void>;
  errors?: Record<string, string>;
  submitting?: boolean;
}

export function OwnerListingForm({
  categories,
  initial,
  submitLabel,
  onSubmit,
  errors = {},
  submitting,
}: Props) {
  const [f, setF] = useState<ListingInput>({
    category_id: initial?.category_id || (categories[0]?.id ?? ""),
    title: initial?.title || "",
    slug: null,
    description: initial?.description || "",
    price: initial?.rent_amount || initial?.price || "0",
    rent_amount: initial?.rent_amount || initial?.price || "0",
    deposit_amount: initial?.deposit_amount ?? "",
    agent_fee: initial?.agent_fee ?? "",
    available_date: initial?.available_date ?? "",
    is_furnished: initial?.is_furnished ?? false,
    utilities_included: initial?.utilities_included ?? false,
    parking_available: initial?.parking_available ?? false,
    max_occupants: initial?.max_occupants ?? 1,
    area: initial?.area ?? "",
    currency: initial?.currency || "ZAR",
    location: initial?.location ?? "",
    status: (initial?.status as ListingStatus) || "draft",
  });

  const set = <K extends keyof ListingInput>(k: K, v: ListingInput[K]) =>
    setF((prev) => ({ ...prev, [k]: v }));

  async function handle(e: React.FormEvent) {
    e.preventDefault();
    // ensure price mirrors rent_amount
    const rent = String(f.rent_amount || "0");
    const payload: ListingInput = {
      ...f,
      rent_amount: rent,
      price: rent,
      deposit_amount: f.deposit_amount || null,
      agent_fee: f.agent_fee || null,
      available_date: f.available_date || null,
      area: f.area || null,
      location: f.location || null,
      description: f.description || null,
      max_occupants: f.max_occupants ? Number(f.max_occupants) : null,
    };
    await onSubmit(payload);
  }

  return (
    <form onSubmit={handle} className="space-y-6">
      {errors.form && (
        <p className="text-sm text-destructive bg-destructive/10 rounded p-3">{errors.form}</p>
      )}

      <Section title="Basics">
        <Field label="Room title" required error={errors.title}>
          <Input
            value={f.title}
            onChange={(e) => set("title", e.target.value)}
            required
            placeholder="Sunny single room in Observatory"
          />
        </Field>
        <Field label="Category" required error={errors.category_id}>
          <Select value={f.category_id} onValueChange={(v) => set("category_id", v)}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Description" error={errors.description}>
            <Textarea
              rows={5}
              value={f.description || ""}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Describe the room, the household, the neighbourhood…"
            />
          </Field>
        </div>
      </Section>

      <Section title="Pricing">
        <Field label="Monthly rent (ZAR)" required error={errors.rent_amount || errors.price}>
          <Input
            type="number"
            step="0.01"
            value={f.rent_amount}
            onChange={(e) => set("rent_amount", e.target.value)}
            required
          />
        </Field>
        <Field label="Deposit" error={errors.deposit_amount}>
          <Input
            type="number"
            step="0.01"
            value={f.deposit_amount || ""}
            onChange={(e) => set("deposit_amount", e.target.value)}
          />
        </Field>
        <Field label="Agent fee" error={errors.agent_fee}>
          <Input
            type="number"
            step="0.01"
            value={f.agent_fee || ""}
            onChange={(e) => set("agent_fee", e.target.value)}
          />
        </Field>
        <Field label="Currency" error={errors.currency}>
          <Input value={f.currency} onChange={(e) => set("currency", e.target.value)} />
        </Field>
      </Section>

      <Section title="Location & availability">
        <Field label="City" error={errors.location}>
          <Input
            value={f.location || ""}
            onChange={(e) => set("location", e.target.value)}
            placeholder="Cape Town"
          />
        </Field>
        <Field label="Suburb / area" error={errors.area}>
          <Input
            value={f.area || ""}
            onChange={(e) => set("area", e.target.value)}
            placeholder="Observatory"
          />
        </Field>
        <Field label="Available from" error={errors.available_date}>
          <Input
            type="date"
            value={f.available_date || ""}
            onChange={(e) => set("available_date", e.target.value)}
          />
        </Field>
        <Field label="Max occupants" error={errors.max_occupants}>
          <Input
            type="number"
            min={1}
            value={f.max_occupants ?? ""}
            onChange={(e) => set("max_occupants", e.target.value ? Number(e.target.value) : null)}
          />
        </Field>
      </Section>

      <Section title="Amenities">
        <div className="sm:col-span-2 flex flex-wrap gap-6">
          <Toggle
            label="Furnished"
            checked={f.is_furnished}
            onChange={(v) => set("is_furnished", v)}
          />
          <Toggle
            label="Utilities included"
            checked={f.utilities_included}
            onChange={(v) => set("utilities_included", v)}
          />
          <Toggle
            label="Parking available"
            checked={f.parking_available}
            onChange={(v) => set("parking_available", v)}
          />
        </div>
      </Section>

      <Section title="Status">
        <Field label="Listing status" error={errors.status}>
          <Select value={f.status} onValueChange={(v) => set("status", v as ListingStatus)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </Section>

      <div className="pt-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
      <h3 className="font-serif text-lg">{title}</h3>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer text-sm">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(!!v)} />
      {label}
    </label>
  );
}
