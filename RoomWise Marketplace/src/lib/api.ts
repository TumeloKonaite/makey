import { API_BASE_URL } from "./env";
import { getAccessToken, logout } from "./auth";
import type {
  ApiErrorPayload,
  Category,
  Enquiry,
  EnquiryInput,
  FastApiFieldError,
  Listing,
  ListingImage,
  ListingInput,
} from "@/types";

export class ApiError extends Error {
  status: number;
  fieldErrors: Record<string, string> = {};
  detail?: string;

  constructor(status: number, payload: ApiErrorPayload | string) {
    let msg = `Request failed (${status})`;
    const fieldErrors: Record<string, string> = {};
    let detail: string | undefined;
    if (typeof payload === "string") {
      msg = payload || msg;
    } else if (payload && typeof payload === "object") {
      if (Array.isArray(payload.detail)) {
        for (const e of payload.detail as FastApiFieldError[]) {
          const key = e.loc?.slice(1).join(".") || e.loc?.join(".") || "form";
          fieldErrors[key] = e.msg;
        }
        msg = payload.detail.map((e) => e.msg).join(", ") || msg;
      } else if (typeof payload.detail === "string") {
        msg = payload.detail;
        detail = payload.detail;
      }
    }
    super(msg);
    this.status = status;
    this.fieldErrors = fieldErrors;
    this.detail = detail;
  }
}

interface RequestOpts {
  method?: string;
  body?: unknown;
  auth?: boolean;
  formData?: FormData;
  signal?: AbortSignal;
}

async function request<T>(path: string, opts: RequestOpts = {}): Promise<T> {
  const headers: Record<string, string> = {};
  let body: BodyInit | undefined;

  if (opts.formData) {
    body = opts.formData;
  } else if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }

  if (opts.auth) {
    const token = getAccessToken();
    if (!token) throw new ApiError(401, { detail: "Not signed in" });
    headers["Authorization"] = `Bearer ${token}`;
  }

  const url = `${API_BASE_URL}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method || (body ? "POST" : "GET"),
      headers,
      body,
      signal: opts.signal,
    });
  } catch (err) {
    if (import.meta.env.DEV) {
      console.error(`[api] network error: ${opts.method || "GET"} ${url}`, err);
    }
    throw new ApiError(0, {
      detail: "We couldn't reach the server. Please check your connection and try again.",
    });
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let parsed: unknown = undefined;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!res.ok) {
    if (res.status === 401 && opts.auth) {
      logout();
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
        window.location.replace("/login");
      }
    }
    if (import.meta.env.DEV) {
      console.error(`[api] ${res.status} ${opts.method || "GET"} ${url}`, parsed);
    }
    throw new ApiError(res.status, (parsed as ApiErrorPayload | string) ?? `HTTP ${res.status}`);
  }
  return parsed as T;
}

// Public
export const getCategories = () => request<Category[]>("/categories");
export const getListings = () => request<Listing[]>("/listings");
export const getListing = (id: string) => request<Listing>(`/listings/${id}`);
export const createEnquiry = (listingId: string, input: EnquiryInput) =>
  request<Enquiry>(`/listings/${listingId}/enquiries`, { body: input });

// Owner (protected)
export const getMyListings = () => request<Listing[]>("/me/listings", { auth: true });
export const getMyListing = (id: string) => request<Listing>(`/me/listings/${id}`, { auth: true });
export const createListing = (input: ListingInput) =>
  request<Listing>("/listings", { body: input, auth: true });
export const updateListing = (id: string, input: Partial<ListingInput>) =>
  request<Listing>(`/listings/${id}`, {
    method: "PATCH",
    body: input,
    auth: true,
  });
export const deleteListing = (id: string) =>
  request<void>(`/listings/${id}`, { method: "DELETE", auth: true });
export const uploadListingImage = (
  listingId: string,
  file: File,
  display_order: number,
  is_cover: boolean,
) => {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("display_order", String(display_order));
  fd.append("is_cover", String(is_cover));
  return request<ListingImage>(`/listings/${listingId}/images`, {
    method: "POST",
    formData: fd,
    auth: true,
  });
};
export const getOwnerEnquiries = () => request<Enquiry[]>("/me/owner-enquiries", { auth: true });
