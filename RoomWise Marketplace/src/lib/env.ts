const LOCAL_API_BASE_URL = "http://localhost:8000";

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

export const API_BASE_URL = normalizeOriginLikeUrl(
  "VITE_API_BASE_URL",
  readRequiredEnv("VITE_API_BASE_URL", LOCAL_API_BASE_URL),
);
