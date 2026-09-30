import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Listing, ListingInput } from "@/types";
import { AdminListingForm, buildListingPayload } from "./OwnerListingForm";

const savedLocation = {
  address_line: "10 Long Street",
  area: "City Bowl",
  city: "Cape Town",
  province: "Western Cape",
  postal_code: "8001",
  country_code: "ZA",
  latitude: "-33.924900",
  longitude: "18.424100",
  geocoding_provider: "nominatim",
  geocoding_place_id: "place-123",
} as const;

const initial: Partial<Listing> = {
  category_id: "rooms",
  title: "Sunny room",
  price: "6500",
  rent_amount: "6500",
  is_furnished: false,
  utilities_included: true,
  parking_available: false,
  currency: "ZAR",
  status: "published",
  location: "Cape Town",
  ...savedLocation,
};

describe("AdminListingForm location regression", () => {
  it("does not render payload implementation text and populates saved location values", () => {
    const markup = renderToStaticMarkup(
      <AdminListingForm
        categories={[{ id: "rooms", name: "Rooms", slug: "rooms" }]}
        initial={initial}
        submitLabel="Save"
        onSubmit={vi.fn()}
      />,
    );

    expect(markup).not.toContain("address_line: f.address_line");
    expect(markup).not.toContain("longitude: f.longitude");
    expect(markup).toContain("Basics");
    expect(markup).toContain('value="10 Long Street"');
    expect(markup).toContain('value="Cape Town"');
    expect(markup).toContain('value="-33.924900"');
    expect(markup).toContain('value="18.424100"');
  });

  it("keeps every saved location field in the submission payload", () => {
    const formState: ListingInput = {
      category_id: "rooms",
      title: "Sunny room (updated)",
      description: "Only a non-location field changed",
      price: "6500",
      rent_amount: "6500",
      deposit_amount: "",
      agent_fee: "",
      available_date: "",
      is_furnished: false,
      utilities_included: true,
      parking_available: false,
      max_occupants: 1,
      currency: "ZAR",
      status: "published",
      location: "Cape Town",
      ...savedLocation,
    };

    const payload = buildListingPayload(formState);

    expect(payload).toMatchObject(savedLocation);
  });
});
