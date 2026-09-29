export type ListingStatus = "draft" | "published" | "archived";

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
}

export interface ListingImage {
  id: string;
  url: string;
  content_type?: string;
  size_bytes?: number;
  display_order: number;
  is_cover: boolean;
}

export interface Listing {
  id: string;
  provider_id?: string;
  provider_name?: string;
  owner_id?: string;
  owner_name?: string;
  category_id: string;
  title: string;
  slug?: string | null;
  description?: string | null;
  price: string;
  rent_amount: string;
  deposit_amount?: string | null;
  agent_fee?: string | null;
  available_date?: string | null;
  is_furnished: boolean;
  utilities_included: boolean;
  parking_available: boolean;
  max_occupants?: number | null;
  area?: string | null;
  address_line?: string | null;
  city?: string | null;
  province?: string | null;
  postal_code?: string | null;
  country_code?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  geocoding_provider?: string | null;
  geocoding_place_id?: string | null;
  currency: string;
  location?: string | null;
  contact_phone?: string | null;
  is_verified?: boolean;
  status: ListingStatus;
  images: ListingImage[];
}

export interface ListingInput {
  category_id: string;
  title: string;
  slug?: string | null;
  description?: string | null;
  price: string;
  rent_amount: string;
  deposit_amount?: string | null;
  agent_fee?: string | null;
  available_date?: string | null;
  is_furnished: boolean;
  utilities_included: boolean;
  parking_available: boolean;
  max_occupants?: number | null;
  area?: string | null;
  address_line?: string | null;
  city?: string | null;
  province?: string | null;
  postal_code?: string | null;
  country_code?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  geocoding_provider?: string | null;
  geocoding_place_id?: string | null;
  currency: string;
  location?: string | null;
  status: ListingStatus;
}

export interface FastApiFieldError {
  loc: (string | number)[];
  msg: string;
  type: string;
}

export interface ApiErrorPayload {
  detail?: string | FastApiFieldError[];
}
export interface LocationResult {
  display_name: string;
  address_line?: string | null;
  area?: string | null;
  city?: string | null;
  province?: string | null;
  postal_code?: string | null;
  country_code?: string | null;
  latitude: string;
  longitude: string;
  provider: string;
  place_id: string;
}
