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
  currency: string;
  location?: string | null;
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
