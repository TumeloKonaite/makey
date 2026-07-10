import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ApiError, createEnquiry } from "@/lib/api";
import type { EnquiryInput } from "@/types";

interface Props {
  listingId: string;
  listingTitle: string;
}

export function EnquiryForm({ listingId, listingTitle }: Props) {
  const [form, setForm] = useState<EnquiryInput>({
    name: "",
    email: "",
    phone: "",
    message: `Hi, I'm interested in "${listingTitle}". Is it still available?`,
    is_viewing_requested: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const set = <K extends keyof EnquiryInput>(k: K, v: EnquiryInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    const localErrors: Record<string, string> = {};
    if (!form.name.trim()) localErrors.name = "Your name is required";
    if (!form.message.trim()) localErrors.message = "Please add a short message";
    if (!form.email && !form.phone) {
      localErrors.email = "Provide an email or a phone number";
      localErrors.phone = "Provide an email or a phone number";
    }
    if (Object.keys(localErrors).length) {
      setErrors(localErrors);
      return;
    }

    const payload: EnquiryInput = {
      name: form.name.trim(),
      message: form.message.trim(),
    };
    if (form.email) payload.email = form.email.trim();
    if (form.phone) payload.phone = form.phone.trim();
    if (form.desired_move_in_date) payload.desired_move_in_date = form.desired_move_in_date;
    if (form.occupant_count) payload.occupant_count = Number(form.occupant_count);
    if (form.is_viewing_requested) {
      payload.is_viewing_requested = true;
      if (form.preferred_viewing_date) payload.preferred_viewing_date = form.preferred_viewing_date;
      if (form.preferred_viewing_time)
        payload.preferred_viewing_time =
          form.preferred_viewing_time.length === 5
            ? `${form.preferred_viewing_time}:00`
            : form.preferred_viewing_time;
      if (form.viewing_notes) payload.viewing_notes = form.viewing_notes;
    }

    setSubmitting(true);
    try {
      await createEnquiry(listingId, payload);
      setSuccess(true);
      setForm({
        name: "",
        email: "",
        phone: "",
        message: `Hi, I'm interested in "${listingTitle}". Is it still available?`,
        is_viewing_requested: false,
      });
    } catch (err) {
      if (err instanceof ApiError) {
        if (Object.keys(err.fieldErrors).length) {
          setErrors(err.fieldErrors);
        } else {
          setErrors({ form: err.message });
        }
      } else {
        setErrors({ form: (err as Error).message });
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="rounded-2xl border border-primary/40 bg-primary/5 p-6 text-center space-y-3">
        <h3 className="font-serif text-xl">Enquiry sent</h3>
        <p className="text-sm text-muted-foreground">
          Thanks — the owner has been notified and will be in touch shortly.
        </p>
        <Button variant="outline" onClick={() => setSuccess(false)}>
          Send another enquiry
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-border bg-card p-6">
      <div>
        <h3 className="font-serif text-xl">Enquire about this room</h3>
        <p className="text-sm text-muted-foreground mt-1">
          The owner receives your message directly.
        </p>
      </div>

      {errors.form && (
        <p className="text-sm text-destructive bg-destructive/10 rounded p-2">{errors.form}</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name" required error={errors.name}>
          <Input
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            required
            autoComplete="name"
          />
        </Field>
        <Field label="Move-in date" error={errors.desired_move_in_date}>
          <Input
            type="date"
            value={form.desired_move_in_date || ""}
            onChange={(e) => set("desired_move_in_date", e.target.value)}
          />
        </Field>
        <Field label="Email" error={errors.email}>
          <Input
            type="email"
            value={form.email || ""}
            onChange={(e) => set("email", e.target.value)}
            autoComplete="email"
          />
        </Field>
        <Field label="Phone" error={errors.phone}>
          <Input
            type="tel"
            value={form.phone || ""}
            onChange={(e) => set("phone", e.target.value)}
            autoComplete="tel"
            placeholder="+27..."
          />
        </Field>
        <Field label="Number of occupants" error={errors.occupant_count}>
          <Input
            type="number"
            min={1}
            value={form.occupant_count ?? ""}
            onChange={(e) =>
              set("occupant_count", e.target.value ? Number(e.target.value) : undefined)
            }
          />
        </Field>
      </div>

      <Field label="Message" required error={errors.message}>
        <Textarea
          rows={4}
          value={form.message}
          onChange={(e) => set("message", e.target.value)}
          required
        />
      </Field>

      <div className="flex items-center gap-2 pt-2">
        <Checkbox
          id="viewing"
          checked={!!form.is_viewing_requested}
          onCheckedChange={(v) => set("is_viewing_requested", !!v)}
        />
        <Label htmlFor="viewing" className="cursor-pointer">
          I'd like to schedule a viewing
        </Label>
      </div>

      {form.is_viewing_requested && (
        <div className="grid gap-4 sm:grid-cols-2 rounded-lg bg-secondary/50 p-4">
          <Field label="Preferred date">
            <Input
              type="date"
              value={form.preferred_viewing_date || ""}
              onChange={(e) => set("preferred_viewing_date", e.target.value)}
            />
          </Field>
          <Field label="Preferred time">
            <Input
              type="time"
              value={form.preferred_viewing_time ? form.preferred_viewing_time.slice(0, 5) : ""}
              onChange={(e) => set("preferred_viewing_time", e.target.value)}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Notes for the viewing">
              <Textarea
                rows={2}
                value={form.viewing_notes || ""}
                onChange={(e) => set("viewing_notes", e.target.value)}
              />
            </Field>
          </div>
        </div>
      )}

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? "Sending…" : "Send enquiry"}
      </Button>
    </form>
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
