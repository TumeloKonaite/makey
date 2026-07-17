import type { KeycloakTokenResponse } from "@/types";
import { KEYCLOAK_CLIENT_ID, KEYCLOAK_TOKEN_URL } from "./env";

const TOKEN_KEY = "mr.access_token";
const REFRESH_KEY = "mr.refresh_token";
const EXPIRY_KEY = "mr.token_expiry";
const USER_KEY = "mr.username";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  const expiry = window.localStorage.getItem(EXPIRY_KEY);
  if (expiry && Number(expiry) < Date.now()) return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function getUsername(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(USER_KEY);
}

export function isAuthenticated(): boolean {
  return !!getAccessToken();
}

export async function login(username: string, password: string): Promise<void> {
  const body = new URLSearchParams({
    client_id: KEYCLOAK_CLIENT_ID,
    grant_type: "password",
    username,
    password,
  });
  const res = await fetch(KEYCLOAK_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    let msg = "Invalid username or password";
    try {
      const j = (await res.json()) as { error_description?: string; error?: string };
      msg = j.error_description || j.error || msg;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  const tok = (await res.json()) as KeycloakTokenResponse;
  window.localStorage.setItem(TOKEN_KEY, tok.access_token);
  if (tok.refresh_token) window.localStorage.setItem(REFRESH_KEY, tok.refresh_token);
  window.localStorage.setItem(EXPIRY_KEY, String(Date.now() + (tok.expires_in - 30) * 1000));
  window.localStorage.setItem(USER_KEY, username);
  window.dispatchEvent(new Event("mr-auth-change"));
}

export function logout(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_KEY);
  window.localStorage.removeItem(EXPIRY_KEY);
  window.localStorage.removeItem(USER_KEY);
  window.dispatchEvent(new Event("mr-auth-change"));
}
