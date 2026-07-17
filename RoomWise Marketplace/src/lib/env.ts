const LOCAL_API_BASE_URL = "http://localhost:8000";
const LOCAL_KEYCLOAK_ISSUER = "http://localhost:8080/realms/marketplace";
const LOCAL_KEYCLOAK_TOKEN_URL =
  "http://localhost:8080/realms/marketplace/protocol/openid-connect/token";
const LOCAL_KEYCLOAK_CLIENT_ID = "marketplace-api";

function readRequiredEnv(name: string, fallback: string): string {
  const value = import.meta.env[name];
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  if (import.meta.env.DEV) {
    return fallback;
  }
  throw new Error(`${name} must be set for non-development builds.`);
}

function normalizeOriginLikeUrl(name: string, value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid absolute URL.`);
  }

  if (!import.meta.env.DEV && isLocalHostname(parsed.hostname)) {
    throw new Error(`${name} must not point at localhost for non-development builds.`);
  }

  return value.replace(/\/+$/, "");
}

function isLocalHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0";
}

function normalizeClientId(name: string, value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${name} must not be empty.`);
  }
  return normalized;
}

export const API_BASE_URL = normalizeOriginLikeUrl(
  "VITE_API_BASE_URL",
  readRequiredEnv("VITE_API_BASE_URL", LOCAL_API_BASE_URL),
);
export const KEYCLOAK_ISSUER = normalizeOriginLikeUrl(
  "VITE_KEYCLOAK_ISSUER",
  readRequiredEnv("VITE_KEYCLOAK_ISSUER", LOCAL_KEYCLOAK_ISSUER),
);
export const KEYCLOAK_TOKEN_URL = normalizeOriginLikeUrl(
  "VITE_KEYCLOAK_TOKEN_URL",
  readRequiredEnv("VITE_KEYCLOAK_TOKEN_URL", LOCAL_KEYCLOAK_TOKEN_URL),
);
export const KEYCLOAK_CLIENT_ID = normalizeClientId(
  "VITE_KEYCLOAK_CLIENT_ID",
  readRequiredEnv("VITE_KEYCLOAK_CLIENT_ID", LOCAL_KEYCLOAK_CLIENT_ID),
);
