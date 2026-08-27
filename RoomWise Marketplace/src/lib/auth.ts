export type AppRole = "admin" | "renter";
type TokenGetter = () => Promise<string | null>;

let tokenGetter: TokenGetter | null = null;

export function setClerkTokenGetter(getToken: TokenGetter | null): void {
  tokenGetter = getToken;
}

export async function getAccessToken(): Promise<string | null> {
  return tokenGetter ? tokenGetter() : null;
}

export function roleFromClaims(claims: object | null | undefined): AppRole {
  return claims && "role" in claims && claims.role === "admin" ? "admin" : "renter";
}
